import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import { redis } from "./redis.js";
import { buildMarkets } from "./marketBuilder.js";
import { startWebsocket, broadcast } from "./websocket.js";

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);

startWebsocket(server);

const PORT = process.env.PORT || 3000;

async function updateMarkets() {

  try {

    const data = await buildMarkets();

    if (!data) {
      console.log("⚠️ No market data generated");
      return;
    }

    const json = JSON.stringify(data);

    await redis.set(
      "markets:active",
      json,
      "EX",
      60
    );

    await redis.publish("markets:update", json);

    broadcast(data);

    console.log(`✅ Markets updated (${data.active_count})`);

  } catch (err) {

    console.error("❌ Market update error:", err);

  }

}

setInterval(updateMarkets, 15000);

updateMarkets();

app.get("/", (req, res) => {

  res.json({
    service: "Musical Market API",
    status: "running",
    endpoint: "/api/markets"
  });

});

app.get("/api/markets", async (req, res) => {

  try {

    const data = await redis.get("markets:active");

    if (!data) {
      return res.json({
        timestamp: Date.now(),
        active_count: 0,
        markets: []
      });
    }

    res.setHeader("Content-Type", "application/json");

    res.send(data);

  } catch (err) {

    console.error("❌ Markets route error:", err);

    res.status(500).json({
      error: "markets_fetch_failed"
    });

  }

});

server.listen(PORT, () => {

  console.log(`🚀 Backend running on port ${PORT}`);

});
