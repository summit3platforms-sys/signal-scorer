import axios from 'axios';
import { binanceBreaker } from './circuitBreaker.js';

const BASE_URL = 'https://fapi.binance.com';

// ── Rate Limit Tracker ─────────────────────────────────────────────────────
// Binance Futures: 2400 weight/minute. We target staying below 60% = 1440.
let usedWeight = 0;
let weightResetAt = Date.now() + 60_000;

function trackWeight(w) {
  if (Date.now() > weightResetAt) {
    usedWeight = 0;
    weightResetAt = Date.now() + 60_000;
  }
  usedWeight += w;
  if (usedWeight > 1200) {
    console.warn(`[Binance] Weight usage high: ${usedWeight}/2400`);
  }
}

function getAvailableWeight() {
  if (Date.now() > weightResetAt) {
    usedWeight = 0;
    weightResetAt = Date.now() + 60_000;
  }
  return 2400 - usedWeight;
}

// ── Semaphore (max concurrent requests) ───────────────────────────────────
class Semaphore {
  constructor(max) {
    this.max = max;
    this.active = 0;
    this.queue = [];
  }
  acquire() {
    return new Promise(resolve => {
      if (this.active < this.max) { this.active++; resolve(); }
      else this.queue.push(resolve);
    });
  }
  release() {
    if (this.queue.length > 0) { this.queue.shift()(); }
    else this.active--;
  }
}

// CONSERVATIVE: only 5 parallel requests to stay well within rate limits
const sem = new Semaphore(5);

// Helper: sleep ms
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Cache ──────────────────────────────────────────────────────────────────
const cache = {
  exchangeInfo: null,                // persists for 10 minutes
  exchangeInfoExpires: 0,
  klines: new Map(),                 // TTL: 90s (klines change slowly)
  tickers: { data: new Map(), expires: 0 }  // TTL: 10s
};

// ── Retry with Retry-After support ────────────────────────────────────────
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;

      const status = err?.response?.status;
      let delay;

      if (status === 418 || status === 429) {
        // IP banned or rate limited — honour Retry-After
        const ra = err?.response?.headers?.['retry-after'];
        if (ra) {
          const val = parseInt(ra, 10);
          // Binance sometimes sends a Unix ms timestamp
          delay = val > 1_000_000_000 ? val - Date.now() : val * 1000;
          delay = Math.min(Math.max(delay, 2000), 60_000); // clamp 2s–60s
        } else {
          delay = 10_000; // default 10s if no header
        }
        console.warn(`[Binance] ${status === 418 ? 'IP Banned' : 'Rate limited'} — waiting ${delay}ms...`);
      } else {
        delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s for other errors
        console.warn(`[Binance] Request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms`);
      }

      await sleep(delay);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Get all USDT perpetual pairs, sorted by 24h quote volume (highest first).
 * Caches exchange info for 10 minutes to save weight.
 */
export async function getAllUSDTFuturesPairs() {
  if (cache.exchangeInfo && cache.exchangeInfoExpires > Date.now()) {
    return cache.exchangeInfo;
  }
  return binanceBreaker.call(() => withRetry(async () => {
    const res = await axios.get(`${BASE_URL}/fapi/v1/exchangeInfo`);
    trackWeight(40); // exchangeInfo costs 40 weight
    const symbols = res.data.symbols
      .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL')
      .map(s => s.symbol);
    // Cache for 10 minutes — symbol list changes rarely
    cache.exchangeInfo = symbols;
    cache.exchangeInfoExpires = Date.now() + 10 * 60_000;
    return symbols;
  }));
}

/**
 * Get top N symbols by 24h quote volume.
 * This is the recommended way to scan — avoids wasting weight on low-volume pairs.
 */
export async function getTopSymbolsByVolume(limit = 150) {
  const tickers = await getAllTickers();
  return Array.from(tickers.values())
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, limit)
    .map(t => t.symbol);
}

/**
 * Fetch klines for a single symbol. Cached with 90s TTL.
 */
export async function getKlines(symbol, interval, limit = 200) {
  const cacheKey = `${symbol}_${interval}`;
  const cached = cache.klines.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  await sem.acquire();
  try {
    return await binanceBreaker.call(() => withRetry(async () => {
      const res = await axios.get(`${BASE_URL}/fapi/v1/klines`, {
        params: { symbol, interval, limit }
      });
      trackWeight(1); // klines = 1 weight per request
      const data = res.data.map(k => ({
        time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5]
      }));
      cache.klines.set(cacheKey, { data, expires: Date.now() + 90_000 }); // 90s TTL
      return data;
    }));
  } finally {
    sem.release();
  }
}

/**
 * Batch-fetch klines for multiple symbols with inter-batch delay.
 * Respects rate limits by pausing between batches.
 */
export async function getMultipleKlines(symbols, interval, limit = 200, batchSize = 5) {
  const result = new Map();

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);

    // If weight is running low, wait for the window to reset
    if (getAvailableWeight() < 100) {
      const waitMs = Math.max(weightResetAt - Date.now(), 1000);
      console.warn(`[Binance] Low weight (${usedWeight}/2400). Waiting ${Math.round(waitMs / 1000)}s...`);
      await sleep(waitMs);
    }

    await Promise.allSettled(
      batch.map(async symbol => {
        try {
          const data = await getKlines(symbol, interval, limit);
          result.set(symbol, data);
        } catch (err) {
          console.error(`[Binance] klines failed for ${symbol}: ${err.message}`);
        }
      })
    );

    // Conservative: 200ms pause between batches
    if (i + batchSize < symbols.length) {
      await sleep(200);
    }
  }

  return result;
}

/**
 * Get all tickers in a single bulk call (1 request = all symbols).
 * Cached with 10s TTL.
 */
export async function getAllTickers() {
  if (cache.tickers.expires > Date.now()) return cache.tickers.data;

  return binanceBreaker.call(() => withRetry(async () => {
    const res = await axios.get(`${BASE_URL}/fapi/v1/ticker/24hr`);
    trackWeight(40); // bulk ticker = 40 weight
    const map = new Map();
    for (const t of res.data) {
      if (!t.symbol.endsWith('USDT')) continue;
      map.set(t.symbol, {
        symbol: t.symbol,
        price: +t.lastPrice,
        change24h: +t.priceChangePercent,
        volume: +t.volume,
        quoteVolume: +t.quoteVolume
      });
    }
    cache.tickers = { data: map, expires: Date.now() + 10_000 };
    return map;
  }));
}

/**
 * Lightweight price-only fetch for the live ticker strip.
 * Uses the already-cached getAllTickers to avoid extra requests.
 */
export async function fetchLivePrices() {
  const tickers = await getAllTickers();
  const prices = {};
  for (const [sym, t] of tickers) {
    prices[sym] = { price: t.price, change24h: t.change24h };
  }
  return prices;
}

export function getCurrentWeight() {
  return { used: usedWeight, limit: 2400, resetsAt: weightResetAt };
}
