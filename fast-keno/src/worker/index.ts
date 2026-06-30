import { PrismaClient } from "@prisma/client";
import { DrawEngine } from "../keno/drawEngine";
import { TicketService } from "../keno/ticketService";
import { AnalyticsService } from "../keno/analyticsService";
import { createKenoApiServer } from "./apiServer";
import { startKenoWebSocketServer } from "../ws/kenoSocket";
import { RealWalletAdapter, WalletAdapter } from "../keno/walletAdapter";

const HTTP_PORT = parseInt(process.env.KENO_HTTP_PORT ?? "8090", 10);
const WS_PORT = parseInt(process.env.KENO_WS_PORT ?? "8091", 10);

async function main() {
  const prisma = new PrismaClient();

  // Use the RealWalletAdapter wired to Prisma and existing transactions
  const wallet: WalletAdapter = new RealWalletAdapter();

  const drawEngine = new DrawEngine(prisma, wallet, { countdownSeconds: 4 });
  const ticketService = new TicketService(prisma, drawEngine, wallet);
  const analytics = new AnalyticsService(prisma);

  const app = createKenoApiServer(prisma, drawEngine, ticketService, analytics);
  app.listen(HTTP_PORT, () => console.log(`[KenoWorker] HTTP API listening on :${HTTP_PORT}`));

  startKenoWebSocketServer(drawEngine, WS_PORT);

  drawEngine.start();
  console.log("[KenoWorker] DrawEngine started — fast rounds running.");

  process.on("SIGTERM", async () => {
    drawEngine.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[KenoWorker] fatal startup error", err);
  process.exit(1);
});
