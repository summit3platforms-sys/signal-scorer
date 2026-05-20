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
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uniqueId TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('master', 'user', 'pending')) NOT NULL,
      status TEXT CHECK(status IN ('active', 'pending')) NOT NULL,
      referral TEXT,
      createdAt INTEGER NOT NULL,
      lastLogin INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_uniqueId ON users(uniqueId);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

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

export function getUserByCredentials(email, uniqueId) {
  const db = getDB();
  const normalizedEmail = email.toLowerCase().trim();
  const formattedId = uniqueId.toUpperCase().trim();

  const user = db.prepare(`
    SELECT * FROM users
    WHERE email = ? AND uniqueId = ? AND status = 'active'
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
