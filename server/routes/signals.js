import express from 'express';
import { getSignals } from '../cache.js';
import { requireActiveUser } from '../middleware/auth.js';
import { getClosedSignals, getDB } from '../services/database.js';

const router = express.Router();

// GET /api/signals/stats
router.get('/stats', (req, res) => {
  try {
    const conn = getDB();
    const buckets = conn.prepare(`
      SELECT
        (score / 10) * 10 as bucket,
        COUNT(*) as count,
        SUM(CASE WHEN direction = 'LONG' THEN 1 ELSE 0 END) as longs,
        SUM(CASE WHEN direction = 'SHORT' THEN 1 ELSE 0 END) as shorts,
        SUM(CASE WHEN confidence = 'HIGH' THEN 1 ELSE 0 END) as highs,
        SUM(CASE WHEN confidence = 'MEDIUM' THEN 1 ELSE 0 END) as mediums,
        SUM(CASE WHEN confidence = 'LOW' THEN 1 ELSE 0 END) as lows
      FROM signals
      GROUP BY bucket
      ORDER BY bucket ASC
    `).all();
    res.json({ buckets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch signal statistics histogram', message: err.message });
  }
});

// GET /api/signals
router.get('/', (req, res) => {
  const { direction, minScore, limit } = req.query;
  const data = getSignals({ direction, minScore, limit });
  res.json(data);
});

// GET /api/signals/history?limit=50&offset=0
router.get('/history', requireActiveUser, (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200);
  const offset = parseInt(req.query.offset ?? '0', 10);
  try {
    const { rows, total } = getClosedSignals(limit, 3, offset);
    res.json({ history: rows, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history', message: err.message });
  }
});

export default router;
