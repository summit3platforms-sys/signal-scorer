import { getDB } from './database.js';

function generateUniqueId(db) {
  for (let i = 0; i < 1000; i++) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000).toString();
    const uniqueId = `QC${randomDigits}`;
    const exists = db.prepare(`SELECT 1 FROM users WHERE uniqueId = ?`).get(uniqueId);
    if (!exists) {
      return uniqueId;
    }
  }
  throw new Error('Failed to generate a unique ID after 1000 attempts');
}

export function initAuthTables() {
  const db = getDB();

  // Rebuild users table if the old restricted CHECK constraint is present
  try {
    const schemaRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (schemaRow && schemaRow.sql && schemaRow.sql.includes("CHECK(status IN ('active', 'pending'))")) {
      console.log('[Auth] Detected old restricted CHECK constraint on users.status. Rebuilding table...');
      db.transaction(() => {
        db.exec(`
          PRAGMA foreign_keys=OFF;
          
          CREATE TABLE users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uniqueId TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT CHECK(role IN ('master', 'user', 'pending')) NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            referral TEXT,
            createdAt INTEGER NOT NULL,
            lastLogin INTEGER,
            paidAt INTEGER,
            expiresAt INTEGER,
            subscriptionDays INTEGER,
            paymentNotifiedAt INTEGER
          );
          
          INSERT INTO users_new (id, uniqueId, email, role, status, referral, createdAt, lastLogin)
          SELECT id, uniqueId, email, role, status, referral, createdAt, lastLogin FROM users;
          
          DROP TABLE users;
          
          ALTER TABLE users_new RENAME TO users;
          
          CREATE INDEX IF NOT EXISTS idx_users_uniqueId ON users(uniqueId);
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);
      })();
      console.log('[Auth] Users table successfully rebuilt and migrated without the restricted CHECK constraint.');
    }
  } catch (err) {
    console.error('[Auth] Failed to rebuild users table schema:', err.message);
  }

  // Create users table — status CHECK constraint broadened to support all subscription states
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uniqueId TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('master', 'user', 'pending')) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      referral TEXT,
      createdAt INTEGER NOT NULL,
      lastLogin INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_uniqueId ON users(uniqueId);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // Safe migration — add new subscription columns if they don't already exist
  const migrate = (sql) => { try { db.exec(sql); } catch(e) {} };
  migrate(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'pending'`);
  migrate(`ALTER TABLE users ADD COLUMN paidAt INTEGER`);
  migrate(`ALTER TABLE users ADD COLUMN expiresAt INTEGER`);
  migrate(`ALTER TABLE users ADD COLUMN subscriptionDays INTEGER`);
  migrate(`ALTER TABLE users ADD COLUMN paymentNotifiedAt INTEGER`);

  // Auto-insert or update master user to ensure agentkuldeeps@gmail.com has access
  const exists = db.prepare(`SELECT * FROM users WHERE uniqueId = ?`).get('QC25101');
  if (!exists) {
    db.prepare(`
      INSERT INTO users (uniqueId, email, role, status, referral, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('QC25101', 'agentkuldeeps@gmail.com', 'master', 'active', 'SYSTEM', Date.now());
    console.log('[Auth] Master admin account QC25101 initialized with agentkuldeeps@gmail.com.');
  } else {
    // Keep master email verified & up to date
    db.prepare(`
      UPDATE users 
      SET email = ?, role = 'master', status = 'active'
      WHERE uniqueId = ?
    `).run('agentkuldeeps@gmail.com', 'QC25101');
    console.log('[Auth] Master admin account QC25101 verified and updated to agentkuldeeps@gmail.com.');
  }
}

export function createUserFromWaitlist(email, referral) {
  const db = getDB();
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existing = db.prepare(`SELECT uniqueId FROM users WHERE email = ?`).get(normalizedEmail);
  if (existing) {
    return existing.uniqueId;
  }

  const uniqueId = generateUniqueId(db);
  db.prepare(`
    INSERT INTO users (uniqueId, email, role, status, referral, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uniqueId, normalizedEmail, 'pending', 'pending', referral || null, Date.now());

  console.log(`[Auth] User created from waitlist: ${normalizedEmail} (ID: ${uniqueId})`);
  return uniqueId;
}

// ── Subscription lifecycle functions ────────────────────────────────────────

/**
 * Master approves a pending user — status transitions to 'approved',
 * allowing them to log in and reach the payment page.
 */
export function approveUser(uniqueId) {
  const conn = getDB();
  conn.prepare(`
    UPDATE users SET status = 'approved', role = 'user' WHERE uniqueId = ?
  `).run(uniqueId);
}

/**
 * User clicks "I have paid" — transitions status to 'payment_pending'
 * and records the notification timestamp. Returns the full user record
 * so the caller can fire a Telegram alert.
 */
export function submitPayment(uniqueId) {
  const conn = getDB();
  conn.prepare(`
    UPDATE users SET status = 'payment_pending', paymentNotifiedAt = ? WHERE uniqueId = ?
  `).run(Date.now(), uniqueId);
  return conn.prepare(`SELECT * FROM users WHERE uniqueId = ?`).get(uniqueId);
}

/**
 * Master confirms payment on-chain — grants 'active' status and sets
 * expiry date based on configured subscription duration.
 */
export function confirmPayment(uniqueId, subscriptionDays) {
  const conn = getDB();
  const now = Date.now();
  const expiresAt = now + (subscriptionDays * 24 * 60 * 60 * 1000);
  conn.prepare(`
    UPDATE users 
    SET status = 'active',
        paidAt = ?,
        expiresAt = ?,
        subscriptionDays = ?,
        role = 'user'
    WHERE uniqueId = ?
  `).run(now, expiresAt, subscriptionDays, uniqueId);
}

/**
 * Runs periodically — expires any active subscriptions whose expiresAt
 * timestamp has passed. Master (QC25101) is explicitly excluded.
 */
export function checkExpiredSubscriptions() {
  const conn = getDB();
  const now = Date.now();
  const result = conn.prepare(`
    UPDATE users 
    SET status = 'expired'
    WHERE status = 'active' 
      AND expiresAt IS NOT NULL 
      AND expiresAt < ?
      AND uniqueId != 'QC25101'
  `).run(now);
  if (result.changes > 0) {
    console.log(`[Auth] Expired ${result.changes} subscriptions`);
  }
}

/**
 * Login — allows any status except 'pending' to authenticate.
 * The frontend then routes the user to the correct page based on status:
 *   approved / payment_pending → /payment
 *   active                     → /dashboard
 *   expired                    → /expired
 */
export function getUserByCredentials(email, uniqueId) {
  const db = getDB();
  const normalizedEmail = email.toLowerCase().trim();
  const formattedId = uniqueId.toUpperCase().trim();

  const user = db.prepare(`
    SELECT * FROM users
    WHERE email = ? AND uniqueId = ? AND status != 'pending'
  `).get(normalizedEmail, formattedId);

  if (user) {
    db.prepare(`UPDATE users SET lastLogin = ? WHERE uniqueId = ?`).run(Date.now(), user.uniqueId);
    user.lastLogin = Date.now();
  }

  return user;
}

export function getAllUsers() {
  const db = getDB();
  return db.prepare(`SELECT * FROM users ORDER BY createdAt DESC`).all();
}

export function updateUserRole(uniqueId, role) {
  const db = getDB();
  const formattedId = uniqueId.toUpperCase().trim();

  let status = 'pending';
  if (role === 'user' || role === 'master') {
    status = 'active';
  }

  const result = db.prepare(`
    UPDATE users
    SET role = ?, status = ?
    WHERE uniqueId = ?
  `).run(role, status, formattedId);

  if (result.changes === 0) {
    throw new Error(`User not found: ${uniqueId}`);
  }
}

export function deleteUser(uniqueId) {
  const formattedId = uniqueId.toUpperCase().trim();
  if (formattedId === 'QC25101') {
    throw new Error('Cannot delete the master admin user QC25101');
  }

  const db = getDB();
  const result = db.prepare(`DELETE FROM users WHERE uniqueId = ?`).run(formattedId);
  if (result.changes === 0) {
    throw new Error(`User not found: ${uniqueId}`);
  }
}
