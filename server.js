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

    await redis.set("markets:active", JSON.stringify(data));

    await redis.publish("markets:update", JSON.stringify(data));

    broadcast(data);

    console.log(`✅ Markets updated (${data.active_count})`);

  } catch (err) {

    console.error("Market update error:", err);

  }

}

setInterval(updateMarkets, 15000);

updateMarkets();

app.get("/markets", async (req, res) => {

  const data = await redis.get("markets:active");

  res.json(JSON.parse(data || "{}"));

});

server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
