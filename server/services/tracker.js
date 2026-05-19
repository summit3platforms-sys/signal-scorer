import { fetchLivePrices } from './binance.js';

// In-memory store
// Key: string (symbol), Value: signal object with tracking state
const activeSignals = new Map();
const closedSignals = []; // Store completed signals for stats history

let trackerInterval = null;

// Track overall stats
const stats = {
  totalTracked: 0,
  tp1Hits: 0,
  tp2Hits: 0,
  slHits: 0,
};

/**
 * Add a newly generated signal to the tracker if it isn't already being tracked
 * (or if it's a completely new signal for that pair).
 */
export function trackSignal(signal) {
  if (!signal || !signal.symbol) return;
  
  // To avoid spamming, we only track the highest confidence ones, or all.
  // For now, let's track everything passed in.
  // We use symbol as key. If a new signal comes in for the same symbol, we replace it.
  
  const existing = activeSignals.get(signal.symbol);
  
  // If we already have an active signal for this symbol in the same direction,
  // we might want to just keep tracking the old one, but for simplicity, we'll
  // replace it with the freshest indicator levels.
  
  const trackedSignal = {
    ...signal,
    status: 'ACTIVE', // ACTIVE, TP1_HIT, TP2_HIT, SL_HIT
    highestPrice: signal.price,
    lowestPrice: signal.price,
    trackedAt: Date.now(),
  };

  if (!existing) {
    stats.totalTracked++;
  }
  
  activeSignals.set(signal.symbol, trackedSignal);
}

/**
 * Replace all currently tracked signals. Useful for full rescans.
 */
export function setTrackedSignals(signals) {
  activeSignals.clear();
  signals.forEach(trackSignal);
}

/**
 * The 5-second polling loop to evaluate active signals against live prices.
 */
async function evaluatePrices() {
  if (activeSignals.size === 0) return;

  try {
    const livePrices = await fetchLivePrices();

    for (const [symbol, sig] of activeSignals.entries()) {
      const livePrice = livePrices.get(symbol);
      if (!livePrice) continue;

      // Update extremes
      if (livePrice > sig.highestPrice) sig.highestPrice = livePrice;
      if (livePrice < sig.lowestPrice) sig.lowestPrice = livePrice;

      // Evaluate logic
      const isLong = sig.direction === 'LONG';
      let stateChanged = false;

      if (isLong) {
        if (livePrice <= sig.stopLoss) {
          sig.status = 'SL_HIT';
          stateChanged = true;
          stats.slHits++;
        } else if (livePrice >= sig.takeProfit[1]) {
          sig.status = 'TP2_HIT';
          stateChanged = true;
          stats.tp2Hits++;
          // If it hits TP2, it also implies it hit TP1 if it hadn't already
          if (sig.status !== 'TP1_HIT' && sig.status !== 'TP2_HIT') {
             stats.tp1Hits++; // Retroactively count TP1
          }
        } else if (livePrice >= sig.takeProfit[0] && sig.status === 'ACTIVE') {
          sig.status = 'TP1_HIT';
          stats.tp1Hits++;
          // We don't remove from active yet, wait for TP2 or SL
        }
      } else {
        // SHORT
        if (livePrice >= sig.stopLoss) {
          sig.status = 'SL_HIT';
          stateChanged = true;
          stats.slHits++;
        } else if (livePrice <= sig.takeProfit[1]) {
          sig.status = 'TP2_HIT';
          stateChanged = true;
          stats.tp2Hits++;
          if (sig.status !== 'TP1_HIT' && sig.status !== 'TP2_HIT') {
             stats.tp1Hits++;
          }
        } else if (livePrice <= sig.takeProfit[0] && sig.status === 'ACTIVE') {
          sig.status = 'TP1_HIT';
          stats.tp1Hits++;
        }
      }

      // If SL or TP2 is hit, it's fully closed
      if (sig.status === 'SL_HIT' || sig.status === 'TP2_HIT') {
        sig.closedAt = Date.now();
        closedSignals.push(sig);
        activeSignals.delete(symbol);
      }
    }
  } catch (err) {
    console.error('[tracker] Error fetching live prices:', err.message);
  }
}

export function startTracker() {
  if (trackerInterval) clearInterval(trackerInterval);
  trackerInterval = setInterval(evaluatePrices, 5000);
  console.log('[tracker] Started 5s price polling loop.');
}

export function stopTracker() {
  if (trackerInterval) clearInterval(trackerInterval);
}

/**
 * Returns combined list of active signals and calculated win rates.
 */
export function getTrackerData() {
  const activeList = Array.from(activeSignals.values());
  
  // Calculate win rates based on total closed signals OR total tracked?
  // Usually win rate is (Winning Trades) / (Total Resolved Trades).
  // Resolved = (TP2 + SL). But what about trades stopped out at breakeven after TP1?
  // For simplicity: Win Rate = (TP1 Hits) / (Total Tracked).
  // Let's provide both definitions.
  
  const resolvedCount = stats.tp2Hits + stats.slHits; // Fully closed
  
  const tp1WinRate = stats.totalTracked > 0 ? (stats.tp1Hits / stats.totalTracked) * 100 : 0;
  const tp2WinRate = resolvedCount > 0 ? (stats.tp2Hits / resolvedCount) * 100 : 0;
  
  // Overall Win Rate (Hit at least TP1)
  const overallWinRate = tp1WinRate;

  return {
    activeSignals: activeList,
    closedSignals,
    stats: {
      ...stats,
      resolvedCount,
      overallWinRate: parseFloat(overallWinRate.toFixed(1)),
      tp1WinRate: parseFloat(tp1WinRate.toFixed(1)),
      tp2WinRate: parseFloat(tp2WinRate.toFixed(1)),
    }
  };
}
