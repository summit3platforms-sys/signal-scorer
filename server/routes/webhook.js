import express from 'express';
const router = express.Router();

// Currently not used as we rely on telegraf polling in dev,
// but stubbed for production webhook usage.
router.post('/', (req, res) => {
  // In production, you would attach telegraf's webhook callback here:
  // bot.webhookCallback('/api/webhook')(req, res);
  res.sendStatus(200);
});

export default router;
