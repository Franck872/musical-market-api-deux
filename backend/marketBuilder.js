import { pool } from "./db.js";

export async function buildMarkets() {
  const client = await pool.connect();

  try {

    const res = await client.query(`
      SELECT 
        e.id,
        e.title,
        e.source,
        e.type,
        e.current_views,
        e.target_views,
        e.interval_upper,
        e.deadline,
        o.type AS offer_type,
        o.probability,
        o.odds,
        o.blocked
      FROM events e
      JOIN offers o ON o.event_id = e.id
      WHERE e.status='active'
      ORDER BY e.deadline ASC
    `);

    const marketsMap = {};

    for (const row of res.rows) {

      if (!marketsMap[row.id]) {

        marketsMap[row.id] = {
          id: row.id,
          title: row.title,
          source: row.source,
          type: row.type,
          views: Number(row.current_views),
          target: Number(row.target_views),
          interval_upper: Number(row.interval_upper),
          deadline: row.deadline,
          offers: []
        };

      }

      marketsMap[row.id].offers.push({
        type: row.offer_type,
        probability: Number(row.probability),
        odds: Number(row.odds),
        blocked: row.blocked
      });

    }

    const markets = Object.values(marketsMap);

    return {
      timestamp: Date.now(),
      active_count: markets.length,
      markets
    };

  } finally {
    client.release();
  }
}
