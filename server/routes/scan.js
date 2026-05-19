import express from 'express';
import { runFullScan } from '../cronJobs.js';

const router = express.Router();

// POST /api/scan
// Triggers an immediate manual scan
router.post('/', async (req, res) => {
  try {
    const io = req.app.get('io'); // get socket.io instance
    // Note: runFullScan is async and returns the result
    const result = await runFullScan(io);
    res.json({
      status: 'success',
      ...result
    });
  } catch (err) {
    console.error('[Scan Route] Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
