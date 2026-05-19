import axios from 'axios';
import crypto from 'crypto';

const BASE = 'https://fapi.binance.com';

const API_KEY = process.env.BINANCE_API_KEY || '';
const API_SECRET = process.env.BINANCE_API_SECRET || '';

const client = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: {
    'X-MBX-APIKEY': API_KEY,
  },
});

/**
 * Helper to generate HMAC SHA256 signature for private endpoints.
 * @param {string} queryString
 * @returns {string} signature
 */
export function generateSignature(queryString) {
  return crypto
    .createHmac('sha256', API_SECRET)
    .update(queryString)
    .digest('hex');
}

/**
 * Fetch all active USDT-margined futures symbols.
 * @returns {Promise<string[]>} e.g. ['BTCUSDT', 'ETHUSDT', ...]
 */
export async function fetchUsdtFuturesSymbols() {
  const { data } = await client.get('/fapi/v1/exchangeInfo');
  return data.symbols
    .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.contractType === 'PERPETUAL')
    .map(s => s.symbol);
}

/**
 * Fetch OHLCV klines for a symbol.
 * @param {string} symbol
 * @param {string} interval - '5m' | '15m' | '1h'
 * @param {number} limit    - number of candles (max 500)
 * @returns {Promise<Array>} array of { open, high, low, close, volume, timestamp }
 */
export async function fetchKlines(symbol, interval = '5m', limit = 200) {
  const { data } = await client.get('/fapi/v1/klines', {
    params: { symbol, interval, limit },
  });
  return data.map(k => ({
    timestamp: k[0],
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

/**
 * Fetch 24h ticker statistics for all symbols.
 * @returns {Promise<Map<string, object>>} keyed by symbol
 */
export async function fetchTickers() {
  const { data } = await client.get('/fapi/v1/ticker/24hr');
  const map = new Map();
  for (const t of data) {
    map.set(t.symbol, {
      price:       parseFloat(t.lastPrice),
      priceChange: parseFloat(t.priceChangePercent),
      volume:      parseFloat(t.quoteVolume),
      high24h:     parseFloat(t.highPrice),
      low24h:      parseFloat(t.lowPrice),
    });
  }
  return map;
}

/**
 * Fetch latest prices for all symbols.
 * @returns {Promise<Map<string, number>>} keyed by symbol
 */
export async function fetchLivePrices() {
  const { data } = await client.get('/fapi/v1/ticker/price');
  const map = new Map();
  for (const t of data) {
    map.set(t.symbol, parseFloat(t.price));
  }
  return map;
}
