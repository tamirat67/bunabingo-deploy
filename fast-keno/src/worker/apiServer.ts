import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { DrawEngine } from "../keno/drawEngine";
import { TicketService, TicketServiceError } from "../keno/ticketService";
import { AnalyticsService } from "../keno/analyticsService";

export function createKenoApiServer(
  prisma: PrismaClient,
  drawEngine: DrawEngine,
  ticketService: TicketService,
  analytics: AnalyticsService
) {
  const app = express();
  app.use(express.json());

  // BigInt doesn't JSON.stringify natively — convert for all responses.
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value
  );

  /**
   * SECURITY: this worker should NOT be exposed directly to the internet.
   * Run it on an internal network/port and only let your Next.js API
   * routes call it server-to-server (see nextjs-integration/), so that
   * YOUR existing auth/session checks happen in Next.js before any
   * request reaches here. Optionally also check a shared internal
   * secret header below as defense in depth.
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const internalSecret = process.env.KENO_INTERNAL_SECRET;
    if (internalSecret && req.header("x-internal-secret") !== internalSecret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  });

  app.get("/keno/round/current", (req, res) => {
    const round = drawEngine.getCurrentRound();
    if (!round) return res.json({ status: "NO_ACTIVE_ROUND" });
    res.json({
      roundCode: round.roundCode,
      status: round.status,
      serverSeedHash: round.serverSeedHash,
      bettingClosesAt: round.bettingClosesAt,
    });
  });

  app.post("/keno/ticket", async (req, res) => {
    try {
      // userId MUST come from a value Next.js already verified via your
      // existing auth (session/JWT) — never trust a userId in the body
      // without that upstream check. See nextjs-integration route example.
      const { userId, picks, stakeCents } = req.body;
      const ticket = await ticketService.placeTicket({ userId, picks, stakeCents });
      res.json(ticket);
    } catch (err) {
      if (err instanceof TicketServiceError) {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      console.error("[KenoAPI] placeTicket error", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/keno/history/:userId", async (req, res) => {
    const userId = req.params.userId; // string UUID — no parseInt needed
    const history = await ticketService.getHistory(userId);
    res.json(history);
  });

  app.get("/keno/analytics/hot-cold", async (req, res) => {
    const sample = parseInt(String(req.query.sampleRounds ?? "100"), 10);
    res.json(await analytics.getHotColdNumbers(sample));
  });

  app.get("/keno/analytics/history", async (req, res) => {
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    res.json(await analytics.getRecentDrawHistory(limit));
  });

  app.get("/keno/verify/:roundCode", async (req, res) => {
    const roundCode = req.params.roundCode;
    const round = await prisma.kenoRound.findUnique({ where: { roundCode } });
    if (!round) return res.status(404).json({ error: "Round not found" });
    if (round.status !== "COMPLETED") return res.status(400).json({ error: "Round not yet completed" });
    
    res.json({
      roundCode: round.roundCode,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      drawnNumbers: round.drawnNumbers,
    });
  });

  // ---- Admin endpoints: secure with your existing admin auth in Next.js ----

  app.get("/keno/admin/payout-table", async (req, res) => {
    res.json(await prisma.kenoPayoutRule.findMany());
  });

  app.post("/keno/admin/payout-table", async (req, res) => {
    const { spotCount, hits, multiplier } = req.body;
    const rule = await prisma.kenoPayoutRule.upsert({
      where: { spotCount_hits: { spotCount, hits } },
      create: { spotCount, hits, multiplier },
      update: { multiplier },
    });
    res.json(rule);
  });

  app.put("/keno/admin/config/:key", async (req, res) => {
    const config = await prisma.kenoConfig.upsert({
      where: { configKey: req.params.key },
      create: { configKey: req.params.key, configValue: req.body.value },
      update: { configValue: req.body.value },
    });
    res.json(config);
  });

  app.get("/keno/admin/reports/summary", async (req, res) => {
    const tickets = await prisma.kenoTicket.findMany({ select: { stakeCents: true, payoutCents: true } });
    let totalStake = 0;
    let totalPayout = 0;
    for (const t of tickets) {
      totalStake += t.stakeCents;
      totalPayout += (t.payoutCents ?? 0);
    }
    const realizedRtp = totalStake === 0 ? 0 : totalPayout / totalStake;
    res.json({
      totalTickets: tickets.length,
      totalStakeCents: totalStake,
      totalPayoutCents: totalPayout,
      realizedRtp,
    });
  });

  return app;
}
