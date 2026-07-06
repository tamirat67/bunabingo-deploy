import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { DrawEngine } from "./drawEngine";
import { WalletAdapter } from "./walletAdapter";

export interface PlaceTicketInput {
  userId: string; // UUID string from session
  picks: number[];
  stakeCents: number;
}

export class TicketServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export class TicketService {
  constructor(private prisma: PrismaClient, private drawEngine: DrawEngine, private wallet: WalletAdapter) {}

  async placeTicket(input: PlaceTicketInput) {
    this.validatePicks(input.picks);
    await this.validateStake(input.stakeCents);

    const round = this.drawEngine.getCurrentRound();
    if (!round || round.status !== "BETTING") {
      throw new TicketServiceError("Betting is closed for this round", "ROUND_CLOSED");
    }

    const ticketUuid = randomUUID();
    const idempotencyKey = `keno:debit:${ticketUuid}`;

    // Debit FIRST. If this throws/fails, no ticket row is ever created —
    // money and game state can never drift apart.
    const debitResult = await this.wallet.debit({
      userId: input.userId,
      amountCents: input.stakeCents,
      idempotencyKey,
      reason: "Fast Keno bet",
    });

    if (!debitResult.ok) {
      throw new TicketServiceError("Insufficient balance", "INSUFFICIENT_FUNDS");
    }

    try {
      const ticket = await this.prisma.kenoTicket.create({
        data: {
          roundId: round.id,
          userId: input.userId,       // string UUID matches schema
          numbers: input.picks,
          stakeCents: input.stakeCents,  // Int in schema
          status: "PLACED",
          idempotencyKey: ticketUuid,
          walletDebitRef: debitResult.reference,
        },
      });

      await this.prisma.kenoAuditLog.create({
        data: {
          ticketId: ticket.id,
          roundId: round.id,
          userId: input.userId,
          action: "BET_PLACED",
          amountCents: input.stakeCents,
          detail: { picks: input.picks },
        },
      });

      // Fetch user to get username for broadcast
      const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
      const username = user?.telegramUsername || user?.firstName || 'User';

      // Broadcast live ticket to all connected clients
      try {
        const { getIO } = await import("../lib/socket");
        getIO().emit("keno:TICKET_UPDATE", {
          id: ticket.id,
          userId: ticket.userId,
          username,
          picks: ticket.numbers,
          stakeCents: ticket.stakeCents,
          status: ticket.status
        });
      } catch (err) {
        console.error("[TicketService] Failed to broadcast ticket update", err);
      }

      return { ticket, newBalanceCents: debitResult.newBalanceCents };
    } catch (dbErr) {
      // The debit already succeeded but the ticket insert failed.
      // Refund immediately rather than leaving the player short.
      console.error("[TicketService] ticket insert failed after debit, refunding", dbErr);
      await this.wallet.credit({
        userId: input.userId,
        amountCents: input.stakeCents,
        idempotencyKey: `keno:refund:${ticketUuid}`,
        reason: "Fast Keno bet refund (insert failure)",
      });
      throw new TicketServiceError("Failed to place ticket, stake refunded", "INTERNAL_ERROR");
    }
  }

  async getHistory(userId: string, limit = 50) {
    return this.prisma.kenoTicket.findMany({
      where: { userId },
      include: { round: { select: { roundCode: true, drawnNumbers: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  private validatePicks(picks: number[]) {
    if (!Array.isArray(picks) || picks.length < 1 || picks.length > 10) {
      throw new TicketServiceError("Pick between 1 and 10 numbers", "INVALID_PICKS");
    }
    const unique = new Set(picks);
    if (unique.size !== picks.length) {
      throw new TicketServiceError("Duplicate picks are not allowed", "INVALID_PICKS");
    }
    for (const p of picks) {
      if (!Number.isInteger(p) || p < 1 || p > 80) {
        throw new TicketServiceError("Picks must be integers between 1 and 80", "INVALID_PICKS");
      }
    }
  }

  private async validateStake(stakeCents: number) {
    if (!Number.isInteger(stakeCents) || stakeCents <= 0) {
      throw new TicketServiceError("Invalid stake amount", "INVALID_STAKE");
    }

    const rows = await this.prisma.kenoConfig.findMany({
      where: { configKey: { in: ["round.min_stake_cents", "round.max_stake_cents"] } },
    });
    const map: Record<string, number> = {};
    for (const r of rows) map[r.configKey] = parseInt(r.configValue, 10);

    const min = map["round.min_stake_cents"] ?? 50;
    const max = map["round.max_stake_cents"] ?? 50000;

    if (stakeCents < min || stakeCents > max) {
      throw new TicketServiceError(`Stake must be between ${min} and ${max} cents`, "INVALID_STAKE");
    }
  }
}
