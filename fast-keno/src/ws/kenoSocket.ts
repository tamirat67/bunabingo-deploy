import { WebSocketServer, WebSocket } from "ws";
import { DrawEngine, RoundUpdate } from "../keno/drawEngine";

/**
 * Plain `ws` WebSocket server. Your Next.js frontend (Mini App) connects
 * directly to this (e.g. ws://your-domain:8081 or behind a reverse proxy
 * at wss://your-domain/keno-ws), separate from Next.js's own server.
 */
export function startKenoWebSocketServer(drawEngine: DrawEngine, port: number) {
  const wss = new WebSocketServer({ port });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  drawEngine.on("update", (update: RoundUpdate) => {
    const payload = JSON.stringify({ type: "ROUND_UPDATE", data: update });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

  console.log(`[KenoWS] WebSocket server listening on port ${port}`);
  return wss;
}
