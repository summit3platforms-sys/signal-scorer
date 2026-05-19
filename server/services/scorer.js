/**
 * Multi-factor signal scoring engine.
 * Scores each symbol 0–100 for LONG and SHORT separately,
 * returns the dominant direction with metadata.
 */

/**
 * Score a symbol given its indicator snapshot.
 * @param {object} ind - output from computeIndicators()
 * @param {object} ticker - { price, priceChange, volume }
 * @param {object} settings - Engine weights from DB
 * @returns {object} signal result
 */
export function scoreSignal(ind, ticker, settings) {
  if (!ind) return null;

  // Fallback to default weights if settings are not provided
  const W = settings || {
    emaAlignment: 0.25,
    rsiZone: 0.20,
    macdMomentum: 0.20,
    volumeSurge: 0.15,
    bollingerPos: 0.10,
    atrFilter: 0.10
  };

  const { ema, rsi, macd, atr, bb, volume, price } = ind;

  // ── EMA Alignment ─────────────────────────────────────────────────────────
  // LONG:  price > ema9 > ema21 > ema50 > ema200 + fresh cross
  // SHORT: price < ema9 < ema21 < ema50 < ema200
  let emaLong  = 0;
  let emaShort = 0;

  if (price > ema.e9 && ema.e9 > ema.e21 && ema.e21 > ema.e50 && ema.e50 > ema.e200) {
    emaLong = 100;
    // Bonus for fresh crossover (ema9 just crossed ema21)
    if (ema.prev9 <= ema.prev21 && ema.e9 > ema.e21) emaLong = 100;
  } else if (price > ema.e9 && ema.e9 > ema.e21 && ema.e21 > ema.e50) {
    emaLong = 75;
  } else if (price > ema.e9 && ema.e9 > ema.e21) {
    emaLong = 50;
  } else if (price > ema.e9) {
    emaLong = 25;
  }

  if (price < ema.e9 && ema.e9 < ema.e21 && ema.e21 < ema.e50 && ema.e50 < ema.e200) {
    emaShort = 100;
  } else if (price < ema.e9 && ema.e9 < ema.e21 && ema.e21 < ema.e50) {
    emaShort = 75;
  } else if (price < ema.e9 && ema.e9 < ema.e21) {
    emaShort = 50;
  } else if (price < ema.e9) {
    emaShort = 25;
  }

  // ── RSI Zone ──────────────────────────────────────────────────────────────
  let rsiLong  = 0;
  let rsiShort = 0;
  const r = rsi.current;
  if (r < 30) rsiLong  = 100;
  else if (r < 40) rsiLong  = 70;
  else if (r < 50) rsiLong  = 40;
  else if (r < 55) rsiLong  = 20;

  if (r > 70) rsiShort = 100;
  else if (r > 60) rsiShort = 70;
  else if (r > 50) rsiShort = 40;
  else if (r > 45) rsiShort = 20;

  // ── MACD Momentum ─────────────────────────────────────────────────────────
  let macdLong  = 0;
  let macdShort = 0;
  const hist     = macd.histogram;
  const prevHist = macd.prevHistogram;

  // LONG: histogram positive and growing OR fresh bullish cross
  if (hist > 0 && hist > prevHist) macdLong = 100;
  else if (hist > 0) macdLong = 60;
  else if (macd.macd > macd.signal) macdLong = 30; // approaching cross

  // SHORT: histogram negative and falling OR fresh bearish cross
  if (hist < 0 && hist < prevHist) macdShort = 100;
  else if (hist < 0) macdShort = 60;
  else if (macd.macd < macd.signal) macdShort = 30;

  // ── Volume Surge ──────────────────────────────────────────────────────────
  const vr = volume.ratio;
  const volScore = vr >= 3.0 ? 100 : vr >= 2.0 ? 80 : vr >= 1.5 ? 60 : vr >= 1.2 ? 40 : vr >= 1.0 ? 20 : 0;

  // ── Bollinger Position ────────────────────────────────────────────────────
  let bbLong  = 0;
  let bbShort = 0;
  const bbRange = bb.upper - bb.lower;

  if (bbRange > 0) {
    const pos = (price - bb.lower) / bbRange; // 0 = at lower, 1 = at upper
    // LONG: price near lower band
    if (pos < 0.15) bbLong  = 100;
    else if (pos < 0.30) bbLong  = 60;
    // SHORT: price near upper band
    if (pos > 0.85) bbShort = 100;
    else if (pos > 0.70) bbShort = 60;
    // Squeeze bonus — low bandwidth = breakout incoming
    if (bb.bandwidth < 0.02) {
      bbLong  += 20;
      bbShort += 20;
    }
  }

  // ── ATR Confirmation ──────────────────────────────────────────────────────
  // Ensure meaningful volatility (ATR as % of price should be between 0.3% and 5%)
  const atrPct  = atr.current / price;
  const atrScore = (atrPct >= 0.003 && atrPct <= 0.05) ? 100 : (atrPct >= 0.001) ? 50 : 0;

  // ── Composite Scores ──────────────────────────────────────────────────────
  const longScore = Math.min(100, Math.round(
    emaLong   * W.emaAlignment  +
    rsiLong   * W.rsiZone       +
    macdLong  * W.macdMomentum  +
    volScore  * W.volumeSurge   +
    bbLong    * W.bollingerPos  +
    atrScore  * W.atrFilter
  ));

  const shortScore = Math.min(100, Math.round(
    emaShort  * W.emaAlignment  +
    rsiShort  * W.rsiZone       +
    macdShort * W.macdMomentum  +
    volScore  * W.volumeSurge   +
    bbShort   * W.bollingerPos  +
    atrScore  * W.atrFilter
  ));

  const direction = longScore >= shortScore ? 'LONG' : 'SHORT';
  const score     = direction === 'LONG' ? longScore : shortScore;

  const confidence = score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';

  // ── SL / TP Calculation (ATR-based) ──────────────────────────────────────
  const atrVal = atr.current;
  let entry, stopLoss, takeProfit;

  if (direction === 'LONG') {
    entry      = price;
    stopLoss   = parseFloat((price - atrVal * 1.5).toFixed(6));
    takeProfit = [
      parseFloat((price + atrVal * 2.0).toFixed(6)),
      parseFloat((price + atrVal * 3.5).toFixed(6)),
    ];
  } else {
    entry      = price;
    stopLoss   = parseFloat((price + atrVal * 1.5).toFixed(6));
    takeProfit = [
      parseFloat((price - atrVal * 2.0).toFixed(6)),
      parseFloat((price - atrVal * 3.5).toFixed(6)),
    ];
  }

  return {
    score,
    direction,
    confidence,
    entry,
    stopLoss,
    takeProfit,
    breakdown: {
      emaScore:  direction === 'LONG' ? emaLong  : emaShort,
      rsiScore:  direction === 'LONG' ? rsiLong  : rsiShort,
      macdScore: direction === 'LONG' ? macdLong : macdShort,
      volScore,
      bbScore:   direction === 'LONG' ? bbLong   : bbShort,
      atrScore,
    },
    indicators: {
      rsi:       parseFloat(rsi.current.toFixed(2)),
      ema9:      parseFloat(ema.e9.toFixed(6)),
      ema21:     parseFloat(ema.e21.toFixed(6)),
      ema50:     parseFloat(ema.e50.toFixed(6)),
      ema200:    parseFloat(ema.e200.toFixed(6)),
      macd:      parseFloat(macd.macd.toFixed(6)),
      macdSignal:parseFloat(macd.signal.toFixed(6)),
      histogram: parseFloat(macd.histogram.toFixed(6)),
      atr:       parseFloat(atrVal.toFixed(6)),
      bbUpper:   parseFloat(bb.upper.toFixed(6)),
      bbLower:   parseFloat(bb.lower.toFixed(6)),
      bbMiddle:  parseFloat(bb.middle.toFixed(6)),
      volRatio:  parseFloat(volume.ratio.toFixed(2)),
    },
  };
}
