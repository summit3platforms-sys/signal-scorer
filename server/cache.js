import { insertSignals, getHistoricalStats, getActiveSignals, getSettings } from './services/database.js';

const store = {
  signals: [],
  lastScanAt: null,
  totalPairs: 0,
  scanDurationMs: 0,
  stats: {
    totalSignals: 0,
    winRate: 0,
    tp2HitRate: 0,
    stopLosses: 0
  }
};

export function getSignals({ direction, minScore = 60, limit = 200 } = {}) {
  // 1. Get active database signals (long-term persistent trades)
  const dbActiveRaw = getActiveSignals();
  
  // Format DB signals to match the in-memory engine result structure
  const dbActive = dbActiveRaw.map(s => ({
    symbol: s.symbol,
    direction: s.direction,
    score: s.score,
    confidence: s.confidence,
    entry: s.entry,
    tp1: s.tp1,
    tp2: s.tp2,
    stopLoss: s.stopLoss,
    riskReward: s.riskReward,
    reasons: JSON.parse(s.reasons || '[]'),
    subScores: JSON.parse(s.subScores || '{}'),
    regime: s.regime,
    geminiVerdict: s.geminiVerdict ? JSON.parse(s.geminiVerdict) : null,
    timestamp: s.createdAt,
    fromDb: true // flag to identify persistent signals
  }));

  // 2. Combine with in-memory scan results, prioritizing active DB signals (persistent)
  const mergedMap = new Map();
  
  // First, add all in-memory scan results
  for (const s of store.signals) {
    mergedMap.set(`${s.symbol}_${s.direction}`, s);
  }
  
  // Overwrite or append with active persistent DB signals
  for (const s of dbActive) {
    mergedMap.set(`${s.symbol}_${s.direction}`, s);
  }

  let mergedSignals = Array.from(mergedMap.values());
  
  // Sort descending by score
  mergedSignals.sort((a, b) => b.score - a.score);

  // Apply filters
  if (direction && direction !== 'ALL') {
    mergedSignals = mergedSignals.filter(s => s.direction === direction.toUpperCase());
  }
  
  if (minScore !== undefined) {
    mergedSignals = mergedSignals.filter(s => s.score >= Number(minScore));
  }
  
  return {
    signals: mergedSignals.slice(0, Number(limit)),
    meta: {
      scannedAt: store.lastScanAt,
      totalPairs: store.totalPairs,
      scanDurationMs: store.scanDurationMs
    },
    stats: getHistoricalStats()
  };
}

export function setSignals(results, meta) {
  // Sort descending by score
  store.signals = results.sort((a, b) => b.score - a.score);
  
  store.lastScanAt = meta.scannedAt;
  store.totalPairs = meta.totalPairs;
  store.scanDurationMs = meta.scanDurationMs;

  // Persist signals above configured minScore directly into the database
  const dbSettings = getSettings();
  const minPersistenceScore = dbSettings.minScore ?? 60;

  const actionableSignals = results.filter(s => s.score >= minPersistenceScore);
  if (actionableSignals.length > 0) {
    insertSignals(actionableSignals);
  }

  // Update in-memory stats wrapper
  store.stats = getHistoricalStats();
}

export function updateStats(newStats) {
  store.stats = { ...store.stats, ...newStats };
}

export function getStats() {
  return getHistoricalStats();
}
