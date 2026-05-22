import express from 'express';
import { broadcastMessage, sendAlert } from '../../lib/telegram.js';
import { requireMaster } from '../middleware/auth.js';

const router = express.Router();

// All telegram routes require master admin access
router.use(requireMaster);

router.post('/broadcast', async (req, res) => {
  const { message } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    // Format message to HTML for telegram
    const formattedMessage = `📢 <b>System Announcement:</b>\n\n${message}`;
    await broadcastMessage(formattedMessage);
    res.json({ success: true, message: 'Broadcast successfully sent to Telegram!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send broadcast', message: err.message });
  }
});

router.post('/send-signal', async (req, res) => {
  const { signal } = req.body;
  if (!signal) {
    return res.status(400).json({ error: 'Signal data is required' });
  }

  try {
    // force = true to bypass the 12-hour deduplication since this is manual
    await sendAlert(signal, true);
    res.json({ success: true, message: 'Signal sent to Telegram' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send signal', message: err.message });
  }
});

export default router;
