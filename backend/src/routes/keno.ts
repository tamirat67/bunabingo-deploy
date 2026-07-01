import { Router, Request, Response, NextFunction } from "express";
import { telegramAuthMiddleware } from "../middleware/auth";
import { DrawEngine } from "../keno/drawEngine";
import { TicketService, TicketServiceError } from "../keno/ticketService";
import { AnalyticsService } from "../keno/analyticsService";
import prisma from "../lib/prisma";

export function createKenoRouter(
  drawEngine: DrawEngine,
  ticketService: TicketService,
  analytics: AnalyticsService
) {
  const router = Router();

  // BigInt replacer for Keno
  router.use((_req, res, next) => {
    const originalJson = res.json;
    res.json = function (obj) {
      return originalJson.call(
        this,
        JSON.parse(
          JSON.stringify(obj, (_, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        )
      );
    };
    next();
  });

  // Public stats routes (no auth required)
  router.get("/round/current", (req, res) => {
    const round = drawEngine.getCurrentRound();
    if (!round) return res.json({ status: "NO_ACTIVE_ROUND" });
    const liveState = drawEngine.getLiveState();
    res.json({
      roundCode: round.roundCode,
      phase: round.status,
      status: round.status,
      serverSeedHash: round.serverSeedHash,
      bettingClosesAt: round.bettingClosesAt,
      drawnNumbers: liveState?.drawnNumbers ?? [],
      secondsRemaining: liveState?.secondsRemaining ?? 0,
    });
  });

  router.get("/analytics/hot-cold", async (req, res) => {
    const sample = parseInt(String(req.query.sampleRounds ?? "100"), 10);
    res.json(await analytics.getHotColdNumbers(sample));
  });

  router.get("/analytics/history", async (req, res) => {
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    res.json(await analytics.getRecentDrawHistory(limit));
  });

  router.get("/verify/:roundCode", async (req, res) => {
    const roundCode = req.params.roundCode;
    const round = await prisma.kenoRound.findUnique({ where: { roundCode } });
    if (!round) return res.status(404).json({ error: "Round not found" });
    if (round.status !== "COMPLETED")
      return res.status(400).json({ error: "Round not yet completed" });

    res.json({
      roundCode: round.roundCode,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      drawnNumbers: round.drawnNumbers,
    });
  });

  // ---- Authenticated Routes ----
  router.use(telegramAuthMiddleware);

  router.post("/ticket", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { picks, stakeCents } = req.body;
      const ticket = await ticketService.placeTicket({
        userId: user.id,
        picks,
        stakeCents,
      });
      res.json(ticket);
    } catch (err) {
      if (err instanceof TicketServiceError) {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      console.error("[KenoAPI] placeTicket error", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  router.get("/history", async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const history = await ticketService.getHistory(user.id);
    res.json(history);
  });

  return router;
}
