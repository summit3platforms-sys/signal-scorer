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
      tp1Hit INTEGER DEFAULT 0,
      reasons TEXT,
      subScores TEXT,
      historicalWinRate REAL,
      historicalSampleSize INTEGER
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
    CREATE INDEX IF NOT EXISTS idx_symbol_status ON signals(symbol, status);
    CREATE INDEX IF NOT EXISTS idx_created_at ON signals(createdAt);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON error_logs(timestamp);
  `);

  // Gracefully migrate existing schemas if they don't have these columns
  try {
    db.exec(`ALTER TABLE signals ADD COLUMN historicalWinRate REAL`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE signals ADD COLUMN historicalSampleSize INTEGER`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE signals ADD COLUMN tp1Hit INTEGER DEFAULT 0`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE signals ADD COLUMN atr REAL`);
  } catch (err) {}

  // Seed settings if missing
  const seedSettings = {
    emaAlignment: '0.25',
    rsiZone: '0.20',
    macdMomentum: '0.20',
    volumeSurge: '0.15',
    bollingerPos: '0.10',
    atrFilter: '0.10',
    minScore: '60',
    cooldownMinutes: '30',
    atrStopLoss: '2.0',
    atrTakeProfit1: '2.5',
    atrTakeProfit2: '4.5',
    capital: '1000',
    subscriptionPrice: '29',
    subscriptionDays: '30',
    tronAddress: '',
    riskPct: '2',
    leverage: '5'
  };

  const insert = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(seedSettings)) insert.run(k, v);
  });
  tx();

  console.log('[Database] SQLite initialized at:', dbPath);
  
  // Run automatic startup cleanup of expired signals (older than 7 days)
  try {
    deleteExpiredSignals(7);
  } catch (err) {
    console.error('[Database] Startup cleanup failed:', err.message);
  }

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
  // Hard defaults — returned when a key has never been saved to DB yet
  const DEFAULTS = {
    entryWindowMinutes: 30,
    entryValidationAtr: 0.3,
    softExpiryHours:    4,
    hardExpiryHours:    8,
  };
  const settings = { ...DEFAULTS };
  // String-typed keys that must NOT be coerced to float
  const STRING_KEYS = new Set(['tronAddress']);
  for (const row of rows) {
    settings[row.key] = STRING_KEYS.has(row.key) ? row.value : parseFloat(row.value);
  }
  return settings;
}

export function updateSettings(newSettings) {
  const conn = getDB();
  const update = conn.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  const tx = conn.transaction(() => {
    for (const [k, v] of Object.entries(newSettings)) update.run(k, v.toString());
  });
  tx();
}

// ── Signal Operations ────────────────────────────────────────────────────

export function insertSignals(signalsArray) {
  const conn = getDB();
  const settings = getSettings();

  // Block the same symbol from re-firing within the configured cooldown minutes
  const cooldownMinutes = settings.cooldownMinutes ?? 30;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const cutoff = Date.now() - cooldownMs;

  const recentSymbols = new Set(
    conn.prepare(`
      SELECT symbol FROM signals
      WHERE createdAt > ?
    `).all(cutoff).map(r => r.symbol)
  );

  const deduplicated = signalsArray.filter(sig => !recentSymbols.has(sig.symbol));

  if (deduplicated.length === 0) {
    console.log('[Database] insertSignals: all signals within 30min cooldown, nothing to insert.');
    return 0;
  }

  // Attach empirical win-rate from last 30 days to each signal
  for (const sig of deduplicated) {
    const hist = getSymbolWinRate(sig.symbol, sig.direction);
    sig.historicalWinRate = hist ? hist.winRate : null;
    sig.historicalSampleSize = hist ? hist.sampleSize : null;
  }

  const insert = conn.prepare(`
    INSERT OR REPLACE INTO signals 
    (id, symbol, direction, score, confidence, entry, tp1, tp2, stopLoss, status, createdAt, reasons, subScores, historicalWinRate, historicalSampleSize, tp1Hit)
    VALUES (@id, @symbol, @direction, @score, @confidence, @entry, @tp1, @tp2, @stopLoss, @status, @createdAt, @reasons, @subScores, @historicalWinRate, @historicalSampleSize, @tp1Hit)
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
        subScores: JSON.stringify(sig.subScores),
        historicalWinRate: sig.historicalWinRate ?? null,
        historicalSampleSize: sig.historicalSampleSize ?? null,
        tp1Hit: 0,
        atr: sig.atrWeighted ?? sig.atr ?? null,
      });
    }
  });

  insertMany(deduplicated);
  invalidateActiveSignalsCache();

  console.log(`[Database] Inserted ${deduplicated.length} new signals (${signalsArray.length - deduplicated.length} within cooldown, skipped).`);
  return deduplicated.length;
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

  if (status === 'WIN_TP1') {
    // TP1 hit — mark tp1Hit, move stopLoss to entry (breakeven), do NOT close
    const signal = conn.prepare(`SELECT entry FROM signals WHERE id = ?`).get(id);
    if (signal) {
      conn.prepare(`
        UPDATE signals
        SET tp1Hit = 1,
            stopLoss = entry,
            maxProfitPct = ?
        WHERE id = ?
      `).run(maxProfitPct, id);
    }
  } else if (status === 'LOSS_SL') {
    // TP1-hit guard: a signal that already hit TP1 can NEVER be a full loss.
    // The SL was moved to breakeven, so record it as breakeven WIN_TP1 instead.
    const sig = conn.prepare(`SELECT tp1Hit FROM signals WHERE id = ?`).get(id);
    if (sig?.tp1Hit === 1) {
      conn.prepare(`
        UPDATE signals
        SET status = 'WIN_TP1', closedAt = ?, maxProfitPct = 0
        WHERE id = ?
      `).run(closedAt, id);
    } else {
      conn.prepare(`
        UPDATE signals
        SET status = ?, closedAt = ?, maxProfitPct = ?
        WHERE id = ?
      `).run(status, closedAt, maxProfitPct, id);
    }
  } else {
    // WIN_TP2, INVALIDATED, EXPIRED — fully close the signal
    conn.prepare(`
      UPDATE signals
      SET status = ?, closedAt = ?, maxProfitPct = ?
      WHERE id = ?
    `).run(status, closedAt, maxProfitPct, id);
  }

  invalidateActiveSignalsCache();
}

export function getHistoricalStats() {
  const conn = getDB();

  const row = conn.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'WIN_TP2' THEN 1 ELSE 0 END) as tp2Hits,
      SUM(CASE WHEN status = 'LOSS_SL' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN tp1Hit = 1 THEN 1 ELSE 0 END) as tp1Touches
    FROM signals
    WHERE status != 'ACTIVE'
  `).get();

  if (!row || row.total === 0) {
    return {
      totalSignals: 0,
      accuracy: 0,
      tp1TouchRate: 0,
      tp2HitRate: 0,
      stopLosses: 0,
      expectancy: 0,
      invalidatedCount,
    };
  }

  // Weighted Accuracy: TP2 = 1.0, TP1-only = 0.5, SL = 0.0
  const score = (row.tp2Hits * 1.0) + ((row.tp1Touches - row.tp2Hits) * 0.5);
  const accuracy = Math.round((score / row.total) * 100);

  const tp1TouchRate = Math.round((row.tp1Touches / row.total) * 100);
  const tp2HitRate = Math.round((row.tp2Hits / row.total) * 100);

  // Calculate empirical mathematical expectancy based on closed signal profit percentages
  const resolved = conn.prepare(`
    SELECT maxProfitPct 
    FROM signals 
    WHERE status NOT IN ('ACTIVE', 'EXPIRED', 'INVALIDATED')
  `).all();

  let winCount = 0;
  let lossCount = 0;
  let totalWinPct = 0;
  let totalLossPct = 0;

  for (const t of resolved) {
    const pct = t.maxProfitPct || 0;
    if (pct > 0) {
      winCount++;
      totalWinPct += pct;
    } else if (pct < 0) {
      lossCount++;
      totalLossPct += pct;
    }
  }

  const wRate = winCount / row.total;
  const lRate = lossCount / row.total;
  const avgWin = winCount > 0 ? (totalWinPct / winCount) : 0;
  const avgLoss = lossCount > 0 ? Math.abs(totalLossPct / lossCount) : 0;

  const expectancy = parseFloat(((wRate * avgWin) - (lRate * avgLoss)).toFixed(2));

  return {
    totalSignals: row.total,
    accuracy,
    tp1TouchRate,
    tp2HitRate,
    stopLosses: row.losses,
    expectancy,
    invalidatedCount,
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
    conn.prepare(`DELETE FROM settings`).run();

    const seedSettings = {
      emaAlignment: '0.25',
      rsiZone: '0.20',
      macdMomentum: '0.20',
      volumeSurge: '0.15',
      bollingerPos: '0.10',
      atrFilter: '0.10',
      minScore: '60',
      cooldownMinutes: '30',
      atrStopLoss: '2.0',
      atrTakeProfit1: '2.5',
      atrTakeProfit2: '4.5',
    capital: '1000',
    subscriptionPrice: '29',
    subscriptionDays: '30',
    tronAddress: '',
    riskPct: '2',
    leverage: '5'
    };
    const insert = conn.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
    for (const [k, v] of Object.entries(seedSettings)) insert.run(k, v);

    console.log('[Database] ⚠️ ALL data purged (signals + error logs + settings reset to defaults).');
  });
  tx();
  invalidateActiveSignalsCache();
}

export function deleteExpiredSignals(olderThanDays = 7) {
  const conn = getDB();
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  const result = conn.prepare(`
    DELETE FROM signals 
    WHERE status = 'EXPIRED' 
    AND createdAt < ?
  `).run(cutoff);
  if (result.changes > 0) {
    console.log(`[Database] Cleaned up ${result.changes} expired signals older than ${olderThanDays} days.`);
    invalidateActiveSignalsCache();
  }
  return result.changes;
}

export function getSymbolWinRate(symbol, direction) {
  const conn = getDB();
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // last 30 days

  const row = conn.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('WIN_TP1', 'WIN_TP2') THEN 1 ELSE 0 END) as wins
    FROM signals
    WHERE symbol = ?
      AND direction = ?
      AND status NOT IN ('ACTIVE', 'EXPIRED')
      AND createdAt > ?
  `).get(symbol, direction, cutoff);

  if (!row || row.total < 5) return null; // not enough history to be meaningful

  return {
    winRate: Math.round((row.wins / row.total) * 100),
    sampleSize: row.total
  };
}