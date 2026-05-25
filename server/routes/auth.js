import express from 'express';
import { getUserByCredentials } from '../services/auth.js';

const router = express.Router();

router.post('/login', (req, res) => {
  try {
    const { email, uniqueId } = req.body;
    if (!email || !uniqueId) {
      return res.status(400).json({ error: 'Email and Unique ID are required' });
    }

    const user = getUserByCredentials(email, uniqueId);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials or access not yet granted. If you just submitted a request, please wait for approval.' 
      });
    }

    res.json({
      success: true,
      user: {
        uniqueId: user.uniqueId,
        email: user.email,
        role: user.role,
        status: user.status,          // approved | payment_pending | active | expired
        expiresAt: user.expiresAt,
        subscriptionDays: user.subscriptionDays
      }
    });
  } catch (err) {
    console.error('[AuthRoute] Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
