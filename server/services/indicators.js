import {
  EMA,
  RSI,
  MACD,
  ATR,
  BollingerBands,
} from 'technicalindicators';

/**
 * Compute all technical indicators from candle data.
 * @param {Array} candles - [{open, high, low, close, volume, timestamp}]
 * @returns {object} indicator snapshot
 */
export function computeIndicators(candles) {
  if (candles.length < 210) return null;

  const closes  = candles.map(c => c.close);
  const highs   = candles.map(c => c.high);
  const lows    = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // ── EMAs ──────────────────────────────────────────────────────────────────
  const ema9   = EMA.calculate({ period: 9,   values: closes });
  const ema21  = EMA.calculate({ period: 21,  values: closes });
  const ema50  = EMA.calculate({ period: 50,  values: closes });
  const ema200 = EMA.calculate({ period: 200, values: closes });

  const last = arr => arr[arr.length - 1];
  const prev = arr => arr[arr.length - 2];

  // ── RSI ───────────────────────────────────────────────────────────────────
  const rsiArr = RSI.calculate({ period: 14, values: closes });

  // ── MACD ──────────────────────────────────────────────────────────────────
  const macdArr = MACD.calculate({
    fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    values: closes, SimpleMAOscillator: false, SimpleMASignal: false,
  });

  // ── ATR ───────────────────────────────────────────────────────────────────
  const atrArr = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });

  // ── Bollinger Bands ───────────────────────────────────────────────────────
  const bbArr = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });

  // ── Volume SMA (20-period) ─────────────────────────────────────────────
  const volSlice = volumes.slice(-20);
  const volAvg   = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const volRatio = volumes[volumes.length - 1] / volAvg;

  const currentPrice = closes[closes.length - 1];
  const currentMacd  = last(macdArr);
  const prevMacd     = prev(macdArr);
  const currentBb    = last(bbArr);

  return {
    ema: {
      e9:   last(ema9),
      e21:  last(ema21),
      e50:  last(ema50),
      e200: last(ema200),
      prev9:  prev(ema9),
      prev21: prev(ema21),
    },
    rsi: {
      current: last(rsiArr),
      prev:    prev(rsiArr),
    },
    macd: {
      macd:      currentMacd?.MACD    ?? 0,
      signal:    currentMacd?.signal  ?? 0,
      histogram: currentMacd?.histogram ?? 0,
      prevHistogram: prevMacd?.histogram ?? 0,
    },
    atr: {
      current: last(atrArr),
    },
    bb: {
      upper:  currentBb?.upper  ?? 0,
      middle: currentBb?.middle ?? 0,
      lower:  currentBb?.lower  ?? 0,
      bandwidth: currentBb ? (currentBb.upper - currentBb.lower) / currentBb.middle : 0,
    },
    volume: {
      current: volumes[volumes.length - 1],
      avg20:   volAvg,
      ratio:   volRatio,
    },
    price: currentPrice,
  };
}
