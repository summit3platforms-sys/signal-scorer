import express from 'express';
import { 
  createUserFromWaitlist, 
  getAllUsers, 
  updateUserRole, 
  deleteUser,
  approveUser,
  submitPayment,
  confirmPayment
} from '../services/auth.js';
import { requireMaster } from '../middleware/auth.js';
import { getSettings } from '../services/database.js';
import { sendTelegramToMaster } from '../../lib/telegram.js';

const router = express.Router();

// POST /api/waitlist — Register a new signup from waitlist (public)
router.post('/', (req, res) => {
  try {
    const { email, referral } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const uniqueId = createUserFromWaitlist(email, referral);
    res.json({ success: true, uniqueId });
  } catch (err) {
    console.error('[WaitlistRoute] POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/waitlist — Get all users (admin only)
router.get('/', requireMaster, (req, res) => {
  try {
    const users = getAllUsers();
    res.json({ total: users.length, entries: users });
  } catch (err) {
    console.error('[WaitlistRoute] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/waitlist/:uniqueId/role — Update user role (admin only)
router.patch('/:uniqueId/role', requireMaster, (req, res) => {
  try {
    const { uniqueId } = req.params;
    const { role } = req.body;

    if (!role || !['master', 'user', 'pending'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    updateUserRole(uniqueId, role);
    res.json({ success: true });
  } catch (err) {
    console.error('[WaitlistRoute] PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/waitlist/:uniqueId/approve — Master approves a pending user
router.post('/:uniqueId/approve', requireMaster, (req, res) => {
  try {
    approveUser(req.params.uniqueId);
    res.json({ success: true });
  } catch (err) {
    console.error('[WaitlistRoute] Approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/waitlist/:uniqueId/payment-submitted — User clicks "I have paid"
router.post('/:uniqueId/payment-submitted', async (req, res) => {
  try {
    const user = submitPayment(req.params.uniqueId);

    // Notify master via Telegram (personal DM, not broadcast)
    try {
      const msg = `💰 <b>Payment Submitted!</b>\n\nUser: <code>${user.uniqueId}</code>\nEmail: ${user.email}\n\nVerify on-chain and confirm in the Users tab.`;
      await sendTelegramToMaster(msg);
    } catch(e) {
      console.warn('[Payment] Telegram notify failed:', e.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[WaitlistRoute] Payment submitted error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/waitlist/:uniqueId/confirm-payment — Master confirms payment received
router.post('/:uniqueId/confirm-payment', requireMaster, async (req, res) => {
  try {
    const settings = getSettings();
    const days = parseInt(req.body.subscriptionDays) || settings.subscriptionDays || 30;
    confirmPayment(req.params.uniqueId, days);

    // Notify user via Telegram if possible
    try {
      const msg = `✅ <b>Payment Confirmed!</b>\n\nYour <b>${days}-day</b> subscription is now active.\n\nLog in at your platform URL to access the dashboard.`;
      await sendTelegramToMaster(msg);
    } catch(e) {}

    res.json({ success: true });
  } catch (err) {
    console.error('[WaitlistRoute] Confirm payment error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/waitlist/:uniqueId — Delete user (admin only)
router.delete('/:uniqueId', requireMaster, (req, res) => {
  try {
    const { uniqueId } = req.params;
    deleteUser(uniqueId);
    res.json({ success: true });
  } catch (err) {
    console.error('[WaitlistRoute] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
