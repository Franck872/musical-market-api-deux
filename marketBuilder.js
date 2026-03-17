// buildMarkets.js
import { pool } from "./db.js";

// ------------------------------------------------------------
// Calcul de cotes et probabilités pour 6 intervalles
// ------------------------------------------------------------
function calculateIntervalOffers(event) {
  const now = Date.now();
  const deadline = new Date(event.deadline).getTime();
  const totalTime = deadline - new Date(event.created_at ?? now - 3600000).getTime(); // fallback 1h
  const remainingTime = Math.max(deadline - now, 0);
  const elapsedPercent = 1 - remainingTime / (totalTime || 1);

  const current = Number(event.current_views ?? 0);
  const target = Number(event.target_views ?? current * 2 || 1000);
  const speed = Number(event.speed ?? 0);
  const trend = Number(event.trend ?? 0);

  // On découpe en 6 intervalles proportionnels
  const intervals = [];
  for (let i = 0; i < 6; i++) {
    const min = Math.floor((i / 6) * target);
    const max = Math.floor(((i + 1) / 6) * target);

    // probabilité basique
    let prob = (current >= max) ? 0 : Math.min(1, ((max - current) / target) + speed / 1000 + trend / target);

    // blocage selon règles
    const blocked = prob >= 0.7 || (prob >= 0.5 && elapsedPercent > 0.25);

    // cote proportionnelle
    const odds = blocked ? 0 : Number((3 * (1 - prob)).toFixed(2));

    intervals.push({
      interval_index: i,
      min_views: min,
      max_views: max,
      probability: Number(prob.toFixed(2)),
      odds: odds,
      blocked
    });
  }

  return intervals;
}

// ------------------------------------------------------------
// Fonction principale : construction des marchés avec 6 offres
// ------------------------------------------------------------
export async function buildMarkets() {
  const client = await pool.connect();

  try {
    const res = await client.query(`
      SELECT id, title, external_id AS video_id,
             current_views, views_n1, views_n2,
             target_views, expected_speed AS speed,
             deadline, created_at
      FROM events
      WHERE status='active'
      ORDER BY deadline ASC
    `);

    const markets = res.rows.map(ev => {
      const current = Number(ev.current_views ?? 0);
      const targetRaw = Number(ev.target_views ?? current * 2 || 1000);
      const target = Math.max(current + 10, targetRaw); // minimum +10 pour éviter 0

      return {
        id: ev.id,
        title: ev.title,
        video_id: ev.video_id,
        current_views: current,
        target_views: target,
        deadline: ev.deadline,
        timestamp: Date.now(),
        offers: calculateIntervalOffers({
          ...ev,
          current_views: current,
          target_views: target,
          trend: current - Number(ev.views_n1 ?? 0),
          speed: Number(ev.speed ?? 0)
        })
      };
    });

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
