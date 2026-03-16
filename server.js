import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import { redis } from "./redis.js";
import { buildMarkets } from "./marketBuilder.js";
import { startWebsocket, broadcast } from "./websocket.js";

import { updateViews, fetchVideos } from "./fetcher.js";
import { generateEvents } from "./generator.js";
import { resolveEvents } from "./resolver.js";

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
      30
    );

    await redis.publish("markets:update", json);

    broadcast(data);

    console.log(`✅ Markets updated (${data.active_events})`);

  } catch (err) {

    console.error("❌ Market update error:", err);

  }

}

/* ---------------------- */
/* MOTEURS DU BACKEND */
/* ---------------------- */

setInterval(updateMarkets, 15000);      // API cache
setInterval(updateViews, 60000);        // fetcher vues
setInterval(resolveEvents, 60000);      // calcul marchés
setInterval(generateEvents, 600000);    // créer événements

// recherche YouTube une fois par jour
setInterval(fetchVideos, 86400000);

/* lancement immédiat */

updateMarkets();
updateViews();
resolveEvents();
generateEvents();

/* ---------------------- */
/* ROUTES API */
/* ---------------------- */

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
        events: []
      });

    }

    const parsed = JSON.parse(data);

    res.json({
      timestamp: parsed.timestamp,
      active_count: parsed.active_events,
      events: parsed.markets
    });

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
