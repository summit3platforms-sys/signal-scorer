import express from 'express';
import { getSignals } from '../cache.js';
import { getClosedSignals } from '../services/database.js';

const router = express.Router();

// GET /api/signals
router.get('/', (req, res) => {
  const { direction, minScore, limit } = req.query;
  const data = getSignals({ direction, minScore, limit });
  res.json(data);
});

// GET /api/signals/history
router.get('/history', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
  try {
    const closed = getClosedSignals(limit);
    res.json({ history: closed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history', message: err.message });
  }
});

export default router;
