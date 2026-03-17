// buildMarkets.js
import { pool } from "./db.js";

// fonction utilitaire pour calculer des cotes réalistes
function calculateOdds(current, min, max, speed = 0) {
  const distance = Math.max(min - current, 0);
  const base = 1 + (distance / (max - min + 1 || 1)) * 5; // jamais division par 0
  // ajustement selon vitesse: si speed rapide, cote plus faible
  const adjusted = speed > 0 ? base / Math.min(speed / 1000, 3) : base;
  return Math.max(1.01, Number(adjusted.toFixed(2)));
}

// Fonction principale
export async function buildMarkets() {
  const client = await pool.connect();

  try {
    const res = await client.query(`
      SELECT
        e.id,
        e.title,
        e.external_id AS video_id,
        e.current_views,
        e.views_n1,
        e.views_n2,
        e.target_views,
        e.expected_speed AS speed,
        e.deadline,
        i.idx AS interval_index,
        i.min_value,
        i.max_value,
        o.probability,
        o.odds,
        o.blocked
      FROM events e
      LEFT JOIN intervals i ON i.event_id = e.id
      LEFT JOIN offers o ON o.interval_id = i.id
      WHERE e.status = 'active'
      ORDER BY e.deadline ASC, i.idx ASC
    `);

    const marketsMap = {};

    for (const row of res.rows) {
      // création de l'événement
      if (!marketsMap[row.id]) {
        const currentViews = Number(row.current_views ?? 0);
        const targetViewsRaw = Number(row.target_views ?? currentViews * 2 || 1000);
        const targetViews = Math.max(currentViews + 10, targetViewsRaw); // minimum +10 pour pas zéro

        marketsMap[row.id] = {
          id: row.id,
          title: row.title,
          video_id: row.video_id,
          current_views: currentViews,
          views_n1: Number(row.views_n1 ?? 0),
          views_n2: Number(row.views_n2 ?? 0),
          speed: Number(row.speed ?? 0),
          trend: (Number(row.current_views ?? 0) - Number(row.views_n1 ?? 0)),
          target_views: targetViews,
          deadline: row.deadline,
          offers: []
        };
      }

      // ajout des offres si elles existent
      if (row.interval_index !== null) {
        const ev = marketsMap[row.id];

        // si la cote n'est pas définie, on calcule
        const odds = Number(row.odds ?? calculateOdds(ev.current_views, row.min_value, row.max_value, ev.speed));

        ev.offers.push({
          interval_index: row.interval_index,
          min_views: Number(row.min_value),
          max_views: Number(row.max_value),
          probability: Number(row.probability ?? 0.1),
          odds: odds,
          blocked: row.blocked ?? false
        });
      }
    }

    const markets = Object.values(marketsMap);

    return {
      timestamp: Date.now(),
      active_count: markets.length,
      events: markets
    };

  } catch (err) {
    console.error("❌ buildMarkets error:", err);
    throw err;
  } finally {
    client.release();
  }
}
