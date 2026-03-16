import { WebSocketServer } from "ws";
import { redis } from "./redis.js";

export let wss;

export function startWebsocket(server) {

  wss = new WebSocketServer({ server });

  console.log("🟢 WebSocket server started");

  wss.on("connection", async (ws, req) => {

    console.log(`Client connected from ${req.socket.remoteAddress}`);

    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    /* envoyer les marchés immédiatement */

    try {

      const cached = await redis.get("markets:active");

      if (cached) {
        ws.send(cached);
      }

    } catch (err) {
      console.error("Initial market send error:", err);
    }

    ws.on("message", (msg) => {

      try {

        const data = JSON.parse(msg.toString());

        /* futur : gérer actions joueur */

        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }

      } catch (err) {
        console.warn("Invalid WS message");
      }

    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });

  });

  /* vérification des connexions mortes */

  const interval = setInterval(() => {

    wss.clients.forEach(ws => {

      if (!ws.isAlive) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();

    });

  }, 30000);

  wss.on("close", () => clearInterval(interval));

}

export function broadcast(data) {

  if (!wss) return;

  const message = JSON.stringify(data);

  wss.clients.forEach(client => {

    if (client.readyState === 1) {

      try {

        client.send(message);

      } catch (err) {

        console.error("Broadcast error:", err);

      }

    }

  });

}
