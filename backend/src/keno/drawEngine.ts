import type { PrismaClient } from "@prisma/client";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { generateServerSeed, hashSeed, drawNumbers } from "./generator";
import { countMatches, getMultiplier } from "./payoutEngine";
import { WalletAdapter } from "./walletAdapter";
import { ghostBotEmitter } from "./ghostBots";

export type RoundPhase = "BETTING" | "DRAWING" | "COMPLETED";

export interface RoundUpdate {
  roundCode: string;
  phase: RoundPhase;
  secondsRemaining: number;
  drawnNumbers: number[];
  serverSeedHash: string;
  serverSeed?: string;
}

interface ActiveRound {
  id: bigint;
  roundCode: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  bettingClosesAt: Date;
  status: RoundPhase;
}

/**
 * Runs the BETTING -> DRAWING -> COMPLETED loop for fast rounds.
 *
 * IMPORTANT — run this as a standalone long-lived Node process
 * (e.g. `node dist/keno-worker.js`, managed by pm2/systemd/Docker),
 * NOT inside a Next.js API route or serverless function. Serverless
 * functions don't stay alive between requests, so setInterval-based
 * timing and in-memory round state would break / duplicate rounds.
 *
 * Next.js talks to this engine over plain HTTP/WebSocket (see
 * nextjs-integration/ for the API routes that proxy to it), or you
 * can run it in the same long-lived process as your existing Telegraf
 * bot if that process is already always-on.
 */
export class DrawEngine extends EventEmitter {
  private current: ActiveRound | null = null;
  private tickHandle: NodeJS.Timeout | null = null;
  private countdownSeconds: number;
  private _lastDrawn: number[] = [];

  constructor(private prisma: PrismaClient, private wallet: WalletAdapter, opts?: { countdownSeconds?: number }) {
    super();
    this.countdownSeconds = opts?.countdownSeconds ?? 4;
  }

  start() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick().catch((e) => console.error("[DrawEngine] tick error", e)), 1000);
  }

  stop() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  getCurrentRound() {
    return this.current;
  }

  getLiveState(): { drawnNumbers: number[]; secondsRemaining: number } | null {
    if (!this.current) return null;
    const secondsLeft = Math.max(0, Math.ceil((this.current.bettingClosesAt.getTime() - Date.now()) / 1000));
    return {
      drawnNumbers: this._lastDrawn ?? [],
      secondsRemaining: this.current.status === 'BETTING' ? secondsLeft : 0,
    };
  }

  private async tick() {
    if (!this.current) {
      await this.startNewRound();
      return;
    }

    const secondsLeft = Math.ceil((this.current.bettingClosesAt.getTime() - Date.now()) / 1000);

    if (secondsLeft > 0) {
      this.emitUpdate("BETTING", secondsLeft, []);
      return;
    }

    if (this.current.status === "BETTING") {
      await this.drawAndSettle();
    }
  }

  private async startNewRound() {
    const countdownConfig = await this.getConfigInt("round.countdown_seconds", this.countdownSeconds);
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashSeed(serverSeed);
    const roundCode = randomUUID().slice(0, 8).toUpperCase();
    const clientSeed = "public-seed";
    const nonce = Date.now();
    const bettingClosesAt = new Date(Date.now() + countdownConfig * 1000);

    const round = await this.prisma.kenoRound.create({
      data: {
        roundCode,
        status: "BETTING",
        serverSeedHash,
        serverSeed,
        clientSeed,
        nonce,
        bettingClosesAt,
      },
    });

    this.current = {
      id: round.id,
      roundCode,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      bettingClosesAt,
      status: "BETTING",
    };

    this._lastDrawn = [];

    console.log(`[DrawEngine] 🎰 Round #${round.id} started (code: ${roundCode}) — betting open for ${countdownConfig}s`);
    this.emitUpdate("BETTING", countdownConfig, []);

    // ── Ghost bots: schedule fake players to drip into the live feed ──
    ghostBotEmitter.scheduleForRound(roundCode, countdownConfig);
  }

  private async drawAndSettle() {
    const round = this.current!;
    round.status = "DRAWING";

    // ── House Protection (Company Security) ──
    // Simulate multiple possible draws and pick the one that pays out the least.
    let bestNonce = round.nonce;
    let bestDrawn = drawNumbers(round.serverSeed, round.clientSeed, bestNonce);
    
    try {
      // 1. Fetch real player tickets
      // NOTE: Ghost bots never insert rows into the DB — they only emit socket events.
      // Do NOT filter by userId here because "GHOST_BOT" is not a valid UUID and would
      // crash Prisma with a UUID parse error (P2023).
      const tickets = await this.prisma.kenoTicket.findMany({
        where: { roundId: round.id, status: "PLACED" }
      });

      if (tickets.length > 0) {
        let lowestPayout = Infinity;
        const { countMatches, getMultiplier } = await import("./payoutEngine");

        // Test up to 10 different nonces
        for (let i = 0; i < 10; i++) {
          const testNonce = round.nonce + i;
          const testDrawn = drawNumbers(round.serverSeed, round.clientSeed, testNonce);
          
          let totalPayoutForTest = 0;
          for (const t of tickets) {
            const hits = countMatches(t.numbers, testDrawn);
            const multiplier = getMultiplier(t.numbers.length, hits);
            totalPayoutForTest += t.stakeCents * multiplier;
          }

          if (totalPayoutForTest < lowestPayout) {
            lowestPayout = totalPayoutForTest;
            bestDrawn = testDrawn;
            bestNonce = testNonce;
          }

          // If we found a draw where players win 0, stop searching (Max company profit)
          if (lowestPayout === 0) break;
        }
      }
    } catch (err) {
      console.error("[DrawEngine] Error in house protection simulation:", err);
    }

    const drawn = bestDrawn;
    if (bestNonce !== round.nonce) {
      round.nonce = bestNonce;
    }

    await this.prisma.kenoRound.update({
      where: { id: round.id },
      data: { status: "DRAWING", drawnNumbers: drawn, drawnAt: new Date(), nonce: bestNonce },
    });

    console.log(`[DrawEngine] 🎲 Round #${round.id} drawing: [${drawn.join(", ")}] (Nonce: ${bestNonce})`);
    
    // Trickle out the balls one by one (1 second per ball) so frontend animates them
    for (let i = 1; i <= 20; i++) {
      const partialDrawn = drawn.slice(0, i);
      this._lastDrawn = partialDrawn;
      this.emitUpdate("DRAWING", 0, partialDrawn);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.settleTickets(round.id, drawn);

    // ── Ghost bots: settle all fake tickets as WON/LOST ──────────────
    ghostBotEmitter.settleForRound(round.roundCode, drawn).catch(() => {});

    await this.prisma.kenoRound.update({ where: { id: round.id }, data: { status: "COMPLETED" } });

    console.log(`[DrawEngine] ✅ Round #${round.id} completed.`);
    this.emitUpdate("COMPLETED", 0, drawn, round.serverSeed);

    // Give players 5 seconds to review the results board before starting the next round
    await new Promise(resolve => setTimeout(resolve, 5000));

    this.current = null;
  }

  private async settleTickets(roundId: bigint, drawn: number[]) {
    const tickets = await this.prisma.kenoTicket.findMany({
      where: { roundId, status: "PLACED" },
    });

    if (tickets.length === 0) {
      console.log(`[DrawEngine] Round #${roundId} — no tickets, nothing to settle.`);
      return;
    }
    console.log(`[DrawEngine] Round #${roundId} — settling ${tickets.length} ticket(s)...`);

    let totalStakeCents = 0;
    let totalPayoutCents = 0;

    const scoredTickets = await Promise.all(tickets.map(async (t) => {
      totalStakeCents += t.stakeCents;
      const hits = countMatches(t.numbers, drawn);
      const multiplier = await this.getPayoutMultiplier(t.numbers.length, hits);
      
      // Fixed odds calculation with 30,000 ETB max win cap
      const rawPayout = t.stakeCents * multiplier;
      const maxPayoutCents = 30000 * 100; // 30,000 ETB
      const payoutCents = Math.floor(Math.min(rawPayout, maxPayoutCents));
      
      totalPayoutCents += payoutCents;
      return { ...t, hits, multiplier, payoutCents };
    }));

    // Calculate house edge effectively
    const houseRakeCents = Math.max(0, totalStakeCents - totalPayoutCents);
    const prizePoolCents = totalPayoutCents;
    const totalShares = 0; // Not used in fixed odds

    await this.prisma.kenoRound.update({
      where: { id: roundId },
      data: { 
        totalStakeCents, 
        houseRakeCents, 
        prizePoolCents, 
        totalShares 
      }
    });

    console.log(`[DrawEngine] Pool: totalStake=${totalStakeCents}¢  totalPayout=${totalPayoutCents}¢  houseDiff=${houseRakeCents}¢`);
    for (const ticket of scoredTickets) {
      console.log(`[DrawEngine]   ticket #${ticket.id} user=${ticket.userId} hits=${ticket.hits} payout=${ticket.payoutCents}¢ (${(ticket.payoutCents/100).toFixed(2)} ETB)`);
      await this.settleSingleTicket(ticket, ticket.payoutCents);
    }
  }

  private async settleSingleTicket(
    ticket: { id: bigint; userId: string; numbers: number[]; stakeCents: number; hits: number; multiplier: number },
    payoutCents: number
  ) {
    const won = payoutCents > 0;

    // Compare-and-swap guard
    const result = await this.prisma.kenoTicket.updateMany({
      where: { id: ticket.id, status: "PLACED" },
      data: { hits: ticket.hits, payoutCents, status: won ? "WON" : "LOST" },
    });
    if (result.count === 0) return; // already settled

    // Fetch username for broadcast
    let username = "User";
    try {
      const user = await this.prisma.user.findUnique({ where: { id: ticket.userId }, select: { telegramUsername: true, firstName: true } });
      username = user?.telegramUsername || user?.firstName || "User";
    } catch (_) {}

    // Broadcast the settled ticket status to all connected clients
    try {
      const { getIO } = await import("../lib/socket");
      getIO().emit("keno:TICKET_UPDATE", {
        id: ticket.id.toString(),
        userId: ticket.userId,
        username,
        picks: ticket.numbers,
        stakeCents: ticket.stakeCents,
        status: won ? "WON" : "LOST",
        hits: ticket.hits,
        payoutCents,
      });
    } catch (_) {}

    if (won) {
      const idempotencyKey = `keno:payout:${ticket.id}`;
      try {
        const creditResult = await this.creditWithRetry(
          {
            userId: ticket.userId,
            amountCents: payoutCents,
            idempotencyKey,
            reason: `Fast Keno payout (ticket #${ticket.id})`,
          },
          ticket.id
        );

        await this.prisma.kenoTicket.update({
          where: { id: ticket.id },
          data: { walletCreditRef: creditResult.reference },
        });

        await this.prisma.kenoAuditLog.create({
          data: {
            ticketId: ticket.id,
            userId: ticket.userId,
            action: "PAYOUT_CREDITED",
            amountCents: payoutCents,
            detail: { hits: ticket.hits, multiplier: ticket.multiplier },
          },
        });

        console.log(`[DrawEngine] ✅ Payout credited: ticket #${ticket.id} → user ${ticket.userId} → ${payoutCents / 100} ETB`);
      } catch (err) {
        console.error(`[DrawEngine] ⚠️ PAYOUT CREDIT FAILED after all retries for ticket ${ticket.id}`, err);
        // Log for mandatory manual recovery — player WON but money was not credited
        await this.prisma.kenoAuditLog.create({
          data: {
            ticketId: ticket.id,
            userId: ticket.userId,
            action: "PAYOUT_CREDIT_FAILED",
            amountCents: payoutCents,
            detail: {
              error: String(err),
              requiresManualReview: true,
              message: "Player won but credit failed — manual refund required",
            },
          },
        });
      }
    }
  }

  /**
   * Retry wallet credit up to maxRetries times with exponential backoff.
   * Uses the same idempotencyKey on every attempt so duplicate credits
   * are safe (the wallet adapter deduplicates by key).
   */
  private async creditWithRetry(
    params: { userId: string; amountCents: number; idempotencyKey: string; reason: string },
    ticketId: bigint,
    maxRetries = 3
  ): Promise<{ ok: boolean; reference: string; newBalanceCents?: number }> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.wallet.credit(params);
        if (result.ok) return result;
        // credit returned ok:false (user not found, etc.) — no point retrying
        console.warn(`[DrawEngine] credit returned ok:false for ticket ${ticketId} (attempt ${attempt})`);
        return result;
      } catch (err) {
        lastErr = err;
        console.warn(`[DrawEngine] credit attempt ${attempt}/${maxRetries} failed for ticket ${ticketId}`, err);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 1500)); // 1.5s → 3s → 4.5s
        }
      }
    }
    throw lastErr;
  }

  private async getPayoutMultiplier(picksCount: number, matches: number): Promise<number> {
    const rule = await this.prisma.kenoPayoutRule.findUnique({
      where: { spotCount_hits: { spotCount: picksCount, hits: matches } },
    });
    if (rule) return Number(rule.multiplier);
    return getMultiplier(picksCount, matches);
  }

  private async getConfigInt(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.kenoConfig.findUnique({ where: { configKey: key } });
    if (!row) return fallback;
    const n = parseInt(row.configValue, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  private emitUpdate(phase: RoundPhase, secondsRemaining: number, drawnNumbers: number[], revealSeed?: string) {
    if (!this.current) return;
    const update: RoundUpdate = {
      roundCode: this.current.roundCode,
      phase,
      secondsRemaining,
      drawnNumbers,
      serverSeedHash: this.current.serverSeedHash,
      serverSeed: revealSeed,
    };
    this.emit("update", update);
  }
}
