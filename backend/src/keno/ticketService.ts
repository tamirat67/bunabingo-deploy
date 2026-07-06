import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { DrawEngine } from "./drawEngine";
import { WalletAdapter } from "./walletAdapter";

export interface PlaceTicketInput {
  userId: string; // UUID string from session
  picks: number[];
  stakeCents: number;
}

/* ─── Per-spot maximum stake (cents) ───────────────────────────────
   Higher multipliers → lower stake cap to bound worst-case payout.
   Example: 10-spot max = 50 ETB × 10,000x = 500,000 ETB raw,
   already hard-capped at 30,000 ETB by drawEngine — but we still
   limit 10-spot bets to 100 ETB so a single lucky ticket can't
   expose the house to more than 30,000 ETB.
──────────────────────────────────────────────────────────────────── */
const SPOT_MAX_STAKE_CENTS: Record<number, number> = {
  1:  50000, // 500 ETB — 2.8x max, low risk
  2:  50000, // 500 ETB — 5x max
  3:  50000, // 500 ETB — 35x max
  4:  30000, // 300 ETB — 60x max
  5:  20000, // 200 ETB — 250x max
  6:  10000, // 100 ETB — 500x max
  7:  10000, // 100 ETB — 1000x max
  8:   5000, //  50 ETB — 2000x max
  9:   5000, //  50 ETB — 5000x max
  10:  3000, //  30 ETB — 10000x max
};

export class TicketServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export class TicketService {
  constructor(private prisma: PrismaClient, private drawEngine: DrawEngine, private wallet: WalletAdapter) {}

  async placeTicket(input: PlaceTicketInput) {
    this.validatePicks(input.picks);
    await this.validateStake(input.stakeCents, input.picks.length);

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

  private async validateStake(stakeCents: number, spotCount: number) {
    if (!Number.isInteger(stakeCents) || stakeCents <= 0) {
      throw new TicketServiceError("Invalid stake amount", "INVALID_STAKE");
    }

    const rows = await this.prisma.kenoConfig.findMany({
      where: { configKey: { in: ["round.min_stake_cents", "round.max_stake_cents"] } },
    });
    const map: Record<string, number> = {};
    for (const r of rows) map[r.configKey] = parseInt(r.configValue, 10);

    const min = map["round.min_stake_cents"] ?? 50;
    const globalMax = map["round.max_stake_cents"] ?? 50000;

    if (stakeCents < min) {
      throw new TicketServiceError(`Minimum stake is ${min / 100} ETB`, "INVALID_STAKE");
    }

    // Apply per-spot stake cap (protects house from high-multiplier jackpot exposure)
    const spotMax = SPOT_MAX_STAKE_CENTS[spotCount] ?? globalMax;
    const effectiveMax = Math.min(globalMax, spotMax);

    if (stakeCents > effectiveMax) {
      throw new TicketServiceError(
        `Max stake for ${spotCount}-spot is ${effectiveMax / 100} ETB`,
        "INVALID_STAKE"
      );
    }
  }
}
