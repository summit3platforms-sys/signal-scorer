import express from 'express';
import { broadcastMessage } from '../../lib/telegram.js';

const router = express.Router();

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

export default router;
