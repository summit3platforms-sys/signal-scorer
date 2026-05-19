import cron from 'node-cron';
import { startPriceStream } from '../lib/priceStream.js';
import { getTopSymbolsByVolume, getMultipleKlines, getAllTickers, getCurrentWeight } from '../lib/binance.js';
import { SignalScoringEngine } from '../signal-engine/SignalScoringEngine.js';
import { validateSignal } from '../lib/gemini.js';
import { sendAlert } from '../lib/telegram.js';
import { setSignals, getSignals } from './cache.js';
import { getSettings, getActiveSignals, updateSignalStatus, logError, getRecentSignalKeys, deleteExpiredSignals } from './services/database.js';

let isScanning = false;

// How many top-volume pairs to scan (keeps weight usage safe)
// 150 pairs × 2 intervals × 1 weight = ~300 weight per scan
const SCAN_LIMIT = 150;
// Kline batch size — 5 at a time with 200ms delay
const BATCH_SIZE = 5;

export async function runFullScan(io) {
  if (isScanning) {
    console.log('[Scanner] Scan already in progress, skipping.');
    return null;
  }
  isScanning = true;
  const t0 = Date.now();

  if (io) io.emit('scan:started', { timestamp: t0 });
  console.log(`[Scanner] Starting scan (top ${SCAN_LIMIT} pairs by volume)...`);

  try {
    const dbSettings = getSettings();
    const engine = new SignalScoringEngine({}, dbSettings);

    // Step 1: Get top N symbols by 24h quote volume (single ticker bulk call)
    const symbols = await getTopSymbolsByVolume(SCAN_LIMIT);
    const totalPairs = symbols.length;

    if (io) io.emit('scan:progress', { scanned: 0, total: totalPairs, percent: 0 });

    // Step 2: Fetch 15m candles for all (batched with delays)
    const k15m = await getMultipleKlines(symbols, '15m', 200, BATCH_SIZE);

    if (io) io.emit('scan:progress', { scanned: totalPairs / 2, total: totalPairs, percent: 50 });

    // Step 3: Fetch 1h candles for all (batched with delays)
    const k1h = await getMultipleKlines(symbols, '1h', 200, BATCH_SIZE);

    // Step 3b: Fetch 4h candles for confluence filter (batched, same pattern)
    const k4h = await getMultipleKlines(symbols, '4h', 100, BATCH_SIZE);

    if (io) io.emit('scan:progress', { scanned: totalPairs, total: totalPairs, percent: 100 });

    // Step 4: Score all pairs
    const candleMap = new Map();
    for (const sym of symbols) {
      if (k15m.has(sym) && k1h.has(sym)) {
        candleMap.set(sym, {
          '15m': k15m.get(sym),
          '1h': k1h.get(sym),
          '4h': k4h.get(sym) || null  // optional — engine handles null gracefully
        });
      }
    }

    const rawResults = engine.scoreMultiple(symbols, candleMap);
    const scored = rawResults.filter(s => s && s.score >= engine.getConfig().thresholds.minScore);

    const actionable = [...scored];
    actionable.sort((a, b) => b.score - a.score);

    // Step 5: Get tickers for price/volume enrichment (single bulk call — already cached)
    const tickers = await getAllTickers();
    for (const sig of actionable) {
      const t = tickers.get(sig.symbol);
      if (t) {
        sig.priceChange = t.change24h;
        sig.volume24h = t.quoteVolume;
        sig.entry = t.price || sig.entry;
      }
    }

    // Step 6: Async Gemini validation for high-confidence signals (non-blocking)
    const highConf = actionable.filter(s => s.score >= engine.getConfig().thresholds.highConfidence);
    if (highConf.length > 0) {
      // Fire and forget — update signals in cache as verdicts come in
      (async () => {
        for (const signal of highConf) {
          try {
            const verdict = await validateSignal(signal);
            signal.geminiVerdict = verdict.verdict ? verdict : null;
            // Send Telegram alert for alert-worthy signals
            if (signal.score >= engine.getConfig().thresholds.alertScore) {
              await sendAlert(signal);
            }
          } catch (err) {
            console.error(`[Gemini] Validation failed for ${signal.symbol}: ${err.message}`);
            logError('Gemini AI', `Validation failed for ${signal.symbol}: ${err.message}`, err.stack);
          }
        }
      })();
    }

    const scanDurationMs = Date.now() - t0;
    const meta = {
      scannedAt: new Date().toISOString(),
      totalPairs,
      scanDurationMs
    };

    setSignals(actionable, meta);

    // Emit final update to all connected clients
    if (io) {
      const { signals, stats } = getSignals();
      io.emit('signals:update', { signals, scannedAt: meta.scannedAt, totalPairs, stats });
    }

    const weight = getCurrentWeight();
    console.log(`[Scanner] ✅ Done in ${Math.round(scanDurationMs / 1000)}s | ${actionable.length} signals | Weight used: ${weight.used}/2400`);

    return { signals: actionable, ...meta };

  } catch (err) {
    console.error('[Scanner] Scan failed:', err.message);
    logError('Scanner', err.message, err.stack);
    if (io) io.emit('scan:error', { error: err.message });
    throw err;
  } finally {
    isScanning = false;
  }
}

// ---------------------------------------------------------
// PRICE TRACKING via centralized WebSocket module
// ---------------------------------------------------------

let lastEmitTime = 0;

function processPriceUpdate(io, prices) {
  try {
    const activeSignals = getActiveSignals();
    const now = Date.now();
    let statsChanged = false;

    for (const sig of activeSignals) {
      const priceData = prices.get(sig.symbol);
      if (!priceData) continue;
      const livePrice = priceData.price;

      // Expire signals older than 24 hours
      if (now - sig.createdAt > 24 * 60 * 60 * 1000) {
        updateSignalStatus(sig.id, 'EXPIRED', now, 0);
        statsChanged = true;
        continue;
      }

      // Check hits
      if (sig.direction === 'LONG') {
        if (livePrice >= sig.tp2) {
          updateSignalStatus(sig.id, 'WIN_TP2', now, ((livePrice - sig.entry) / sig.entry) * 100);
          statsChanged = true;
        } else if (livePrice >= sig.tp1) {
          updateSignalStatus(sig.id, 'WIN_TP1', now, ((livePrice - sig.entry) / sig.entry) * 100);
          statsChanged = true;
        } else if (livePrice <= sig.stopLoss) {
          updateSignalStatus(sig.id, 'LOSS_SL', now, ((livePrice - sig.entry) / sig.entry) * 100);
          statsChanged = true;
        }
      } else {
        // SHORT
        if (livePrice <= sig.tp2) {
          updateSignalStatus(sig.id, 'WIN_TP2', now, ((sig.entry - livePrice) / sig.entry) * 100);
          statsChanged = true;
        } else if (livePrice <= sig.tp1) {
          updateSignalStatus(sig.id, 'WIN_TP1', now, ((sig.entry - livePrice) / sig.entry) * 100);
          statsChanged = true;
        } else if (livePrice >= sig.stopLoss) {
          updateSignalStatus(sig.id, 'LOSS_SL', now, ((sig.entry - livePrice) / sig.entry) * 100);
          statsChanged = true;
        }
      }
    }

    if (io) {
      // Throttle front-end emissions to ~2 seconds to avoid flooding UI clients
      if (now - lastEmitTime >= 2000) {
        const pricesObj = {};
        for (const [sym, data] of prices.entries()) {
          pricesObj[sym] = data;
        }
        io.emit('price:update', pricesObj);
        lastEmitTime = now;
      }

      // If TP/SL was hit, immediately emit signal update
      if (statsChanged) {
        const { signals, stats, meta } = getSignals();
        io.emit('signals:update', { signals, scannedAt: meta.scannedAt, totalPairs: meta.totalPairs, stats });
      }
    }
  } catch (err) {
    console.error('[PriceTracker] Failed:', err.message);
    logError('PriceTracker', err.message, err.stack);
  }
}

export function initCronJobs(io) {
  // Full scan every 5 minutes
  // 150 pairs × 2 intervals @ 1 weight each ≈ 300 weight per scan (safe).
  cron.schedule('*/5 * * * *', () => {
    runFullScan(io).catch(err => console.error('[Cron] Scan error:', err.message));
  });

  console.log('[Cron] Scheduled: 5-min full scan.');

  // Run cleanup once per day at 03:00 AM
  cron.schedule('0 3 * * *', () => {
    deleteExpiredSignals(7);
  });
  console.log('[Cron] Scheduled: daily expired signal cleanup at 03:00.');

  // Initialize zero-cost WebSocket pricing via the centralized module
  console.log('[Stream] Starting WebSocket live price stream...');
  startPriceStream((priceMap) => processPriceUpdate(io, priceMap));

  // Initial scan after a 5-second delay to let the server fully start
  setTimeout(() => {
    runFullScan(io).catch(err => console.error('[Cron] Initial scan error:', err.message));
  }, 5000);
}