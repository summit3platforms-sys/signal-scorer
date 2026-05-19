/**
 * Binance Futures WebSocket Price Stream.
 * 
 * Replaces the 10-second REST polling loop with a single persistent WebSocket
 * connection to `!miniTicker@arr`. This stream pushes ALL USDT-margined futures
 * prices every ~1 second with zero HTTP overhead and zero rate-limit cost.
 * 
 * Architecture:
 *   Server boot → startPriceStream(callback) → ws connects → on each message,
 *   updates an in-memory Map and invokes the callback with the full price map.
 */
import WebSocket from 'ws';
import { logError } from '../server/services/database.js';

const STREAM_URL = 'wss://fstream.binance.com/market/ws/!miniTicker@arr';

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 60_000;

// Shared price cache — always up-to-date, readable from anywhere
const priceCache = new Map();

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Closing WebSocket...');
  if (ws && ws.readyState === WebSocket.OPEN) ws.terminate();
  process.exit(0);
});
process.on('SIGINT', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.terminate();
  process.exit(0);
});

export function getStreamReadyState() {
  return ws ? ws.readyState : null;
}

/**
 * Starts the persistent WebSocket price stream.
 * @param {Function} onPriceUpdate  Called with the full Map<symbol, {price, change24h}> on each tick.
 */
export function startPriceStream(onPriceUpdate) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return; // Already running
  }

  console.log('[PriceStream] Connecting to Binance Futures WebSocket...');
  ws = new WebSocket(STREAM_URL);

  ws.on('open', () => {
    reconnectAttempts = 0;
    console.log('[PriceStream] ✅ Connected to wss://fstream.binance.com');
  });

  ws.on('message', (raw) => {
    try {
      const tickers = JSON.parse(raw);
      for (const t of tickers) {
        // Only track USDT-margined pairs
        if (!t.s.endsWith('USDT')) continue;
        const closePrice = parseFloat(t.c);
        const openPrice = parseFloat(t.o);
        const changePercent = openPrice > 0 ? ((closePrice - openPrice) / openPrice) * 100 : 0;
        
        priceCache.set(t.s, {
          price: closePrice,
          change24h: changePercent,
        });
      }
      // Notify caller with the latest complete map
      if (onPriceUpdate) {
        onPriceUpdate(priceCache);
      }
    } catch (err) {
      // JSON parse failures are non-fatal — skip this tick
      console.error('[PriceStream] Parse error:', err.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.warn(`[PriceStream] Connection closed (code: ${code}). Scheduling reconnect...`);
    scheduleReconnect(onPriceUpdate);
  });

  ws.on('error', (err) => {
    console.error('[PriceStream] WebSocket error:', err.message);
    logError('PriceStream', `WebSocket error: ${err.message}`, err.stack);
    // 'close' event will fire next, triggering reconnect
  });
}

function scheduleReconnect(onPriceUpdate) {
  if (reconnectTimer) clearTimeout(reconnectTimer);

  // Exponential backoff: 2s, 4s, 8s, 16s ... capped at 60s
  const delayMs = Math.min(2000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_MS);
  reconnectAttempts++;

  console.log(`[PriceStream] Reconnecting in ${Math.round(delayMs / 1000)}s (attempt #${reconnectAttempts})...`);
  reconnectTimer = setTimeout(() => startPriceStream(onPriceUpdate), delayMs);
}

/**
 * Returns the current price map (synchronous, zero cost).
 * This is what the signal tracker uses instead of REST calls.
 */
export function getLivePrices() {
  const prices = {};
  for (const [sym, data] of priceCache) {
    prices[sym] = data;
  }
  return prices;
}

/**
 * Gracefully close the WebSocket (for clean shutdown).
 */
export function stopPriceStream() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }
  console.log('[PriceStream] Stopped.');
}
