import { WebSocketServer } from "ws";

export let wss;

export function startWebsocket(server) {
  wss = new WebSocketServer({ server });

  console.log("🟢 WebSocket server started");

  wss.on("connection", (ws, req) => {
    console.log(`Client connected from ${req.socket.remoteAddress}`);

    // Ping/Pong pour garder la connexion active et détecter les déconnexions
    ws.isAlive = true;
    ws.on("pong", () => ws.isAlive = true);

    ws.on("close", () => {
      console.log("Client disconnected");
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });

  // Intervalle pour checker les connexions mortes toutes les 30s
  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
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
    if (client.readyState === client.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error("Broadcast error:", err);
      }
    }
  });
}
