import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', '..', 'signal-scorer.db');

let db;

// ── In-memory cache for hot-path query ──────────────────────────────────
let _activeSignalsCache = null;
let _activeSignalsCacheTime = 0;
const ACTIVE_CACHE_TTL = 10_000;

function invalidateActiveSignalsCache() {
  _activeSignalsCache = null;
}

export function initDB() {
  if (db) return db;

  db = new Database(dbPath);

  // Performance pragmas — order matters
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456');

  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      score INTEGER NOT NULL,
      confidence TEXT NOT NULL,
      entry REAL NOT NULL,
      tp1 REAL NOT NULL,
      tp2 REAL NOT NULL,
      stopLoss REAL NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      createdAt INTEGER NOT NULL,
      closedAt INTEGER,
      maxProfitPct REAL DEFAULT 0,
      reasons TEXT,
      subScores TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      context TEXT NOT NULL,
      message TEXT NOT NULL,
      stack TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_status ON signals(status);
    CREATE INDEX IF NOT EXISTS idx_created_at ON signals(createdAt);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON error_logs(timestamp);
  `);

  const hasSettings = db.prepare(`SELECT COUNT(*) as c FROM settings`).get().c;
  if (hasSettings === 0) {
    const defaults = {
      emaAlignment: '0.25',
      rsiZone: '0.20',
      macdMomentum: '0.20',
      volumeSurge: '0.15',
      bollingerPos: '0.10',
      atrFilter: '0.10',
      minScore: '60'
    };
    const insert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(defaults)) insert.run(k, v);
    });
    tx();
  }

  console.log('[Database] SQLite initialized at:', dbPath);
  return db;
}

export function getDB() {
  if (!db) return initDB();
  return db;
}

// ── Settings Operations ──────────────────────────────────────────────────

export function getSettings() {
  const conn = getDB();
  const rows = conn.prepare(`SELECT * FROM settings`).all();
  const settings = {};
  for (const row of rows) settings[row.key] = parseFloat(row.value);
  return settings;
}

export function updateSettings(newSettings) {
  const conn = getDB();
  const update = conn.prepare(`UPDATE settings SET value = ? WHERE key = ?`);
  const tx = conn.transaction(() => {
    for (const [k, v] of Object.entries(newSettings)) update.run(v.toString(), k);
  });
  tx();
}

// ── Signal Operations ────────────────────────────────────────────────────

export function insertSignals(signalsArray) {
  const conn = getDB();
  const insert = conn.prepare(`
    INSERT OR REPLACE INTO signals 
    (id, symbol, direction, score, confidence, entry, tp1, tp2, stopLoss, status, createdAt, reasons, subScores)
    VALUES (@id, @symbol, @direction, @score, @confidence, @entry, @tp1, @tp2, @stopLoss, @status, @createdAt, @reasons, @subScores)
  `);

  const insertMany = conn.transaction((signals) => {
    for (const sig of signals) {
      insert.run({
        id: `${sig.symbol}_${sig.timestamp}`,
        symbol: sig.symbol,
        direction: sig.direction,
        score: sig.score,
        confidence: sig.confidence,
        entry: sig.entry,
        tp1: sig.tp1,
        tp2: sig.tp2,
        stopLoss: sig.stopLoss,
        status: 'ACTIVE',
        createdAt: sig.timestamp,
        reasons: JSON.stringify(sig.reasons),
        subScores: JSON.stringify(sig.subScores)
      });
    }
  });

  insertMany(signalsArray);
  invalidateActiveSignalsCache();
}

/**
 * Returns a Set of "SYMBOL" keys for all signals created within `cooldownMs`.
 * Used to deduplicate — if a symbol exists in this set, the scanner skips it
 * for the next 12 hours. This prevents both duplicate signals and whipsaw 
 * (LONG then SHORT) signals on volatile pairs.
 */
export function getRecentSignalKeys(cooldownMs = 12 * 60 * 60 * 1000) {
  const conn = getDB();
  const cutoff = Date.now() - cooldownMs;
  const rows = conn.prepare(
    `SELECT DISTINCT symbol FROM signals WHERE createdAt > ?`
  ).all(cutoff);

  const keys = new Set();
  for (const row of rows) {
    keys.add(row.symbol);
  }
  return keys;
}

export function getActiveSignals() {
  const now = Date.now();
  if (_activeSignalsCache && (now - _activeSignalsCacheTime) < ACTIVE_CACHE_TTL) {
    return _activeSignalsCache;
  }
  const conn = getDB();
  _activeSignalsCache = conn.prepare(`SELECT * FROM signals WHERE status = 'ACTIVE'`).all();
  _activeSignalsCacheTime = now;
  return _activeSignalsCache;
}

export function updateSignalStatus(id, status, closedAt, maxProfitPct = 0) {
  const conn = getDB();
  conn.prepare(`
    UPDATE signals 
    SET status = ?, closedAt = ?, maxProfitPct = ?
    WHERE id = ?
  `).run(status, closedAt, maxProfitPct, id);
  invalidateActiveSignalsCache();
}

export function getHistoricalStats() {
  const conn = getDB();

  const row = conn.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('WIN_TP1', 'WIN_TP2') THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN status = 'WIN_TP2' THEN 1 ELSE 0 END) as tp2Hits,
      SUM(CASE WHEN status = 'LOSS_SL' THEN 1 ELSE 0 END) as losses
    FROM signals
    WHERE status != 'ACTIVE'
  `).get();

  if (!row || row.total === 0) {
    return { totalSignals: 0, winRate: 0, tp2HitRate: 0, stopLosses: 0, accuracy: 0 };
  }

  const resolvedTrades = row.wins + row.losses;

  return {
    totalSignals: row.total,
    winRate: Math.round((row.wins / row.total) * 100),
    tp2HitRate: Math.round((row.tp2Hits / row.total) * 100),
    stopLosses: row.losses,
    accuracy: resolvedTrades > 0 ? Math.round((row.wins / resolvedTrades) * 100) : 0
  };
}

export function getClosedSignals(limit = 100) {
  const conn = getDB();
  return conn.prepare(`
    SELECT * FROM signals
    WHERE status != 'ACTIVE'
    ORDER BY closedAt DESC
    LIMIT ?
  `).all(limit);
}

// ── Error Logging Operations ─────────────────────────────────────────────

export function logError(context, message, stack = null) {
  try {
    const conn = getDB();
    conn.prepare(`
      INSERT INTO error_logs (timestamp, context, message, stack)
      VALUES (?, ?, ?, ?)
    `).run(Date.now(), context, message, stack);
    console.log(`[ErrorLogged] [${context}] ${message}`);
  } catch (err) {
    console.error('[Database] Failed to write error log:', err.message);
  }
}

export function getErrorLogs(limit = 100) {
  try {
    const conn = getDB();
    return conn.prepare(`
      SELECT * FROM error_logs
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
  } catch (err) {
    console.error('[Database] Failed to fetch error logs:', err.message);
    return [];
  }
}

export function clearErrorLogs() {
  try {
    const conn = getDB();
    conn.prepare(`DELETE FROM error_logs`).run();
    console.log('[Database] Error logs cleared.');
  } catch (err) {
    console.error('[Database] Failed to clear error logs:', err.message);
  }
}

/**
 * Purges ALL data from the database: signals, error logs, and resets settings
 * to factory defaults. This is a destructive, irreversible operation.
 */
export function purgeAllData() {
  const conn = getDB();
  const tx = conn.transaction(() => {
    conn.prepare(`DELETE FROM signals`).run();
    conn.prepare(`DELETE FROM error_logs`).run();
    console.log('[Database] ⚠️ ALL data purged (signals + error logs).');
  });
  tx();
  invalidateActiveSignalsCache();
}