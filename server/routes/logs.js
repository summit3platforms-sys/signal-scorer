import express from 'express';
import { getErrorLogs, clearErrorLogs, logError } from '../services/database.js';
import { scannerLogBuffer } from '../cronJobs.js';
import { requireMaster } from '../middleware/auth.js';

const router = express.Router();

// All logs routes require master admin access
router.use(requireMaster);

// GET /api/logs/scanner - Fetch current background scanner steps
router.get('/scanner', (req, res) => {
  res.json({ logs: scannerLogBuffer });
});

// GET /api/logs - Fetch all system errors
router.get('/', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
  try {
    const logs = getErrorLogs(limit);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch error logs', message: err.message });
  }
});

// DELETE /api/logs - Clear all system errors
router.delete('/', (req, res) => {
  try {
    clearErrorLogs();
    res.json({ success: true, message: 'System error logs cleared successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear logs', message: err.message });
  }
});

// POST /api/logs/test - Force create a test error for demonstration
router.post('/test', (req, res) => {
  try {
    logError('Diagnostics', 'This is a test system error manually triggered from the UI.', new Error('DiagnosticsTest: Simulated failure.').stack);
    res.json({ success: true, message: 'Test system error logged!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create test log', message: err.message });
  }
});

export default router;
