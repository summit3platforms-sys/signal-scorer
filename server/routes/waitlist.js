import express from 'express';
import { getDB } from '../services/database.js';

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { email, referral } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    const conn = getDB();

    // Create table if not exists
    conn.exec(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        referral TEXT,
        createdAt INTEGER NOT NULL
      )
    `);

    // Insert — ignore duplicate emails silently
    conn.prepare(`
      INSERT OR IGNORE INTO waitlist (email, referral, createdAt)
      VALUES (?, ?, ?)
    `).run(email.toLowerCase().trim(), referral || null, Date.now());

    console.log(`[Waitlist] New signup: ${email} referral: ${referral || 'none'}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Waitlist] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/waitlist — master only, returns all signups
router.get('/', (req, res) => {
  try {
    const conn = getDB();
    const rows = conn.prepare(`SELECT * FROM waitlist ORDER BY createdAt DESC`).all();
    res.json({ total: rows.length, entries: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
