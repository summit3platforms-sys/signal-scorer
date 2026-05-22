import express from 'express';
import { 
  createUserFromWaitlist, 
  getAllUsers, 
  updateUserRole, 
  deleteUser 
} from '../services/auth.js';
import { requireMaster } from '../middleware/auth.js';

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
