import express from 'express';
import { getSettings, updateSettings, purgeAllData } from '../services/database.js';
import { setSignals } from '../cache.js';
import { requireMaster } from '../middleware/auth.js';

const router = express.Router();

// Public route to fetch subscription details for payment page
router.get('/public', (req, res) => {
  try {
    const settings = getSettings();
    res.json({
      subscriptionPrice: settings.subscriptionPrice ?? 29,
      subscriptionDays: settings.subscriptionDays ?? 30,
      tronAddress: settings.tronAddress ?? ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch public settings', message: err.message });
  }
});

// All settings routes require master admin access
router.use(requireMaster);

router.get('/', (req, res) => {
  try {
    const settings = getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings', message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    updateSettings(req.body);
    res.json({ success: true, settings: getSettings() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings', message: err.message });
  }
});

/**
 * POST /api/settings/purge
 * Nuclear option: wipes ALL signals, error logs from the database
 * and clears the in-memory cache. Settings are preserved.
 */
router.post('/purge', (req, res) => {
  console.log('[API] Purge requested via POST /api/settings/purge');
  try {
    purgeAllData();
    // Clear in-memory signal cache so the UI updates immediately
    setSignals([], { scannedAt: null, totalPairs: 0, scanDurationMs: 0 });
    // Push empty state to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('signals:update', { signals: [], scannedAt: null, totalPairs: 0, stats: { totalSignals: 0, winRate: 0, tp2HitRate: 0, stopLosses: 0, accuracy: 0 } });
    }
    console.log('[API] Purge successful.');
    res.json({ success: true, message: 'All data purged successfully.' });
  } catch (err) {
    console.error('[API] Purge failed:', err);
    res.status(500).json({ error: 'Purge failed', message: err.message });
  }
});

export default router;
