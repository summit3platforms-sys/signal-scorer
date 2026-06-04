import { insertSignals, getHistoricalStats, getActiveSignals, getSettings, getRecentSignalKeys } from './services/database.js';

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

export function getSignals({ direction, minScore, limit = 200 } = {}) {
  const dbSettings = getSettings();
  const effectiveMinScore = minScore !== undefined ? Number(minScore) : (dbSettings.minScore ?? 60);

  // 1. Get active database signals (long-term persistent trades)
  const dbActiveRaw = getActiveSignals();
  
  // Format DB signals to match the in-memory engine result structure
  const dbActive = dbActiveRaw.map(s => {
    const risk = Math.abs(s.entry - s.stopLoss);
    const riskReward = risk === 0 ? 0 : parseFloat((Math.abs(s.tp2 - s.entry) / risk).toFixed(2));
    return {
      symbol: s.symbol,
      direction: s.direction,
      score: s.score,
      confidence: s.confidence,
      entry: s.entry,
      tp1: s.tp1,
      tp2: s.tp2,
      stopLoss: s.stopLoss,
      riskReward: riskReward || 1.5,
      reasons: JSON.parse(s.reasons || '[]'),
      subScores: JSON.parse(s.subScores || '{}'),
      regime: s.regime,
      timestamp: s.createdAt,
      createdAt: s.createdAt,            // EntryCountdownBar reads this field
      tp1Hit: s.tp1Hit ?? 0,             // EntryCountdownBar hides when TP1 already hit
      historicalWinRate: s.historicalWinRate ?? null,   // Fix 9: show symbol win rate pill
      historicalSampleSize: s.historicalSampleSize ?? null,
      // Fix 8: regime is not in DB schema — derive from direction/subScores for border colour
      regime: s.subScores
        ? (() => {
            try {
              const ss = typeof s.subScores === 'string' ? JSON.parse(s.subScores) : s.subScores;
              const trendVote = ss?.trend?.vote;
              if (trendVote === 'LONG') return 'trending_up';
              if (trendVote === 'SHORT') return 'trending_down';
              return 'ranging';
            } catch { return null; }
          })()
        : null,
      fromDb: true // flag to identify persistent signals
    };
  });

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
  
  if (effectiveMinScore !== undefined) {
    mergedSignals = mergedSignals.filter(s => s.score >= effectiveMinScore);
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

  // Persist only NEW signals above configured minScore
  // Skip signals that already exist in the 12h dedup window to avoid unnecessary DB writes
  const dbSettings = getSettings();
  const minPersistenceScore = dbSettings.minScore ?? 60;
  const recentKeys = getRecentSignalKeys(12 * 60 * 60 * 1000);

  const newSignals = results.filter(s => 
    s.score >= minPersistenceScore && !recentKeys.has(s.symbol)
  );

  if (newSignals.length > 0) {
    insertSignals(newSignals);
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
