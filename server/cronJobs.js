import cron from 'node-cron';
import { startPriceStream, getStreamReadyState } from '../lib/priceStream.js';
import { getTopSymbolsByVolume, getMultipleKlines, getAllTickers, getCurrentWeight, getFundingRates } from '../lib/binance.js';
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

export const scannerLogBuffer = [];

function logScanStep(io, message) {
  const formatted = `[${new Date().toLocaleTimeString()}] ${message}`;
  scannerLogBuffer.push(formatted);
  if (scannerLogBuffer.length > 100) {
    scannerLogBuffer.shift();
  }
  console.log(message);
  if (io) {
    io.emit('scan:log', { message: formatted, timestamp: Date.now() });
  }
}

export async function runFullScan(io) {
  if (isScanning) {
    logScanStep(io, '[Scanner] Scan already in progress, skipping.');
    return null;
  }
  isScanning = true;
  const t0 = Date.now();

  if (io) io.emit('scan:started', { timestamp: t0 });
  logScanStep(io, `[Scanner] Starting scan (top ${SCAN_LIMIT} pairs by volume)...`);

  try {
    const dbSettings = getSettings();
    const engine = new SignalScoringEngine({}, dbSettings);

    // Step 1: Get top N symbols by 24h quote volume
    logScanStep(io, `[Scanner] Step 1: Fetching top ${SCAN_LIMIT} symbols by volume...`);
    const symbols = await getTopSymbolsByVolume(SCAN_LIMIT);
    const totalPairs = symbols.length;
    logScanStep(io, `[Scanner] Found ${totalPairs} USDT-margined perpetual pairs.`);

    if (io) io.emit('scan:progress', { scanned: 0, total: totalPairs, percent: 0 });

    // Step 2: Fetch 15m candles
    logScanStep(io, `[Scanner] Step 2: Fetching 15m candles (200 limit, batched)...`);
    const k15m = await getMultipleKlines(symbols, '15m', 200, BATCH_SIZE);
    logScanStep(io, `[Scanner] Successfully fetched 15m candles for ${k15m.size} pairs.`);

    if (io) io.emit('scan:progress', { scanned: totalPairs / 2, total: totalPairs, percent: 50 });

    // Step 3: Fetch 1h candles
    logScanStep(io, `[Scanner] Step 3: Fetching 1h candles (200 limit, batched)...`);
    const k1h = await getMultipleKlines(symbols, '1h', 200, BATCH_SIZE);
    logScanStep(io, `[Scanner] Successfully fetched 1h candles for ${k1h.size} pairs.`);

    // Step 3b: Fetch 4h candles
    logScanStep(io, `[Scanner] Step 3b: Fetching 4h candles (100 limit, batched)...`);
    const k4h = await getMultipleKlines(symbols, '4h', 100, BATCH_SIZE);
    logScanStep(io, `[Scanner] Successfully fetched 4h candles for ${k4h.size} pairs.`);

    if (io) io.emit('scan:progress', { scanned: totalPairs, total: totalPairs, percent: 100 });

    // Step 4: Score all pairs
    logScanStep(io, `[Scanner] Step 4: Scoring pairs using SignalScoringEngine...`);
    const candleMap = new Map();
    for (const sym of symbols) {
      if (k15m.has(sym) && k1h.has(sym)) {
        candleMap.set(sym, {
          '15m': k15m.get(sym),
          '1h': k1h.get(sym),
          '4h': k4h.get(sym) || null
        });
      }
    }

    // Fetch funding rates for all symbols (single bulk call, 5min cached)
    const fundingRates = await getFundingRates().catch(err => {
      console.warn('[Scanner] Funding rates unavailable:', err.message);
      return null;
    });

    const rawResults = engine.scoreMultiple(symbols, candleMap, fundingRates);

    logScanStep(io, `[Debug] Raw scored results count: ${rawResults.length}`);
    logScanStep(io, `[Debug] Null results (filtered by ADX trend threshold or missing data): ${symbols.length - rawResults.length}`);
    logScanStep(io, `[Debug] Current Engine minScore threshold setting: ${engine.getConfig().thresholds.minScore}`);

    const actionable = rawResults.filter(s => s && s.score >= engine.getConfig().thresholds.minScore);

    logScanStep(io, `[Debug] Actionable signals after minScore filter: ${actionable.length}`);
    if (rawResults.length > 0) {
      const sample = rawResults.slice(0, 3).map(s => `${s.symbol} score:${s.score} dir:${s.direction}`);
      logScanStep(io, `[Debug] Sample scores: ${sample.join(' | ')}`);
    }

    actionable.sort((a, b) => b.score - a.score);

    // Step 5: Get tickers
    logScanStep(io, `[Scanner] Step 5: Enforcing ticker prices & quote volumes...`);
    const tickers = await getAllTickers();
    for (const sig of actionable) {
      const t = tickers.get(sig.symbol);
      if (t) {
        sig.priceChange = t.change24h;
        sig.volume24h = t.quoteVolume;
        sig.entry = t.price || sig.entry;
      }
    }

    // Step 6: Gemini Validation
    const highConf = actionable.filter(s => s.score >= engine.getConfig().thresholds.highConfidence);
    logScanStep(io, `[Scanner] Step 6: Async validation. ${highConf.length} signals meet high confidence threshold (${engine.getConfig().thresholds.highConfidence}).`);
    if (highConf.length > 0) {
      (async () => {
        for (const signal of highConf) {
          try {
            logScanStep(io, `[Gemini] Validating signal for ${signal.symbol}...`);
            const verdict = await validateSignal(signal);
            signal.geminiVerdict = verdict.verdict ? verdict : null;
            logScanStep(io, `[Gemini] Result for ${signal.symbol}: ${verdict.verdict}`);
            if (signal.score >= engine.getConfig().thresholds.alertScore) {
              logScanStep(io, `[Telegram] Dispatching alert message for ${signal.symbol}...`);
              await sendAlert(signal);
            }
          } catch (err) {
            logScanStep(io, `[Gemini] Validation failed for ${signal.symbol}: ${err.message}`);
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

    if (io) {
      const { signals, stats } = getSignals();
      io.emit('signals:update', { signals, scannedAt: meta.scannedAt, totalPairs, stats, meta });
    }

    const weight = getCurrentWeight();
    logScanStep(io, `[Scanner] ✅ Done in ${Math.round(scanDurationMs / 1000)}s | ${actionable.length} signals | Weight: ${weight.used}/${weight.limit}`);

    return { signals: actionable, ...meta };

  } catch (err) {
    logScanStep(io, `[Scanner] ❌ Scan failed: ${err.message}`);
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
      const ticker = prices.get(sig.symbol);
      if (!ticker) continue;
      const livePrice = ticker.price;

      // Expire signals older than 24 hours
      if (now - sig.createdAt > 24 * 60 * 60 * 1000) {
        updateSignalStatus(sig.id, 'EXPIRED', now, 0);
        statsChanged = true;
        continue;
      }

      if (sig.direction === 'LONG') {
        const profitPct = ((livePrice - sig.entry) / sig.entry) * 100;

        if (livePrice >= sig.tp2) {
          // Full winner — close completely
          updateSignalStatus(sig.id, 'WIN_TP2', now, profitPct);
          statsChanged = true;
        } else if (livePrice >= sig.tp1 && sig.tp1Hit === 0) {
          // TP1 touched for first time — move SL to breakeven, stay active
          updateSignalStatus(sig.id, 'WIN_TP1', now, profitPct);
          statsChanged = true;
        } else if (livePrice <= sig.stopLoss) {
          // Hit stop loss (either original SL or breakeven after TP1)
          const finalPct = sig.tp1Hit === 1
            ? 0  // breakeven — SL was moved to entry after TP1
            : profitPct;
          updateSignalStatus(sig.id, 'LOSS_SL', now, finalPct);
          statsChanged = true;
        }

      } else {
        // SHORT
        const profitPct = ((sig.entry - livePrice) / sig.entry) * 100;

        if (livePrice <= sig.tp2) {
          updateSignalStatus(sig.id, 'WIN_TP2', now, profitPct);
          statsChanged = true;
        } else if (livePrice <= sig.tp1 && sig.tp1Hit === 0) {
          updateSignalStatus(sig.id, 'WIN_TP1', now, profitPct);
          statsChanged = true;
        } else if (livePrice >= sig.stopLoss) {
          const finalPct = sig.tp1Hit === 1 ? 0 : profitPct;
          updateSignalStatus(sig.id, 'LOSS_SL', now, finalPct);
          statsChanged = true;
        }
      }
    }

    if (io) {
      const now2 = Date.now();
      if (now2 - lastEmitTime >= 2000) {
        const pricesObj = {};
        for (const [sym, ticker] of prices.entries()) {
          pricesObj[sym] = { price: ticker.price };
        }
        io.emit('price:update', pricesObj);
        lastEmitTime = now2;
      }

      if (statsChanged) {
        const { signals, stats, meta } = getSignals();
        io.emit('signals:update', {
          signals,
          scannedAt: meta?.scannedAt,
          totalPairs: meta?.totalPairs,
          stats,
          meta
        });
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

  // Run cleanup once on startup before scanning
  try {
    deleteExpiredSignals(7);
    console.log('[Cron] Startup signal expiry cleanup executed successfully.');
  } catch (err) {
    console.error('[Cron] Startup signal cleanup failed:', err.message);
  }

  // Initial scan after a 5-second delay to let the server fully start
  setTimeout(() => {
    runFullScan(io).catch(err => console.error('[Cron] Initial scan error:', err.message));
  }, 5000);
}

export function getStreamStatus() {
  return getStreamReadyState();
}
