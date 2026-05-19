/**
 * Detects candlestick patterns from the last 3 candles.
 * Pure JS implementation.
 * @param {Array<{time, open, high, low, close, volume}>} candles
 * @returns {{ pattern: string|null, direction: "LONG"|"SHORT"|"NEUTRAL", strength: number, description: string }}
 */
export function detectPatterns(candles) {
  if (!candles || candles.length < 3) {
    return { pattern: null, direction: 'NEUTRAL', strength: 0, description: 'Not enough data' };
  }

  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1]; // current/last closed candle

  // Helpers
  const body = (c) => Math.abs(c.close - c.open);
  const range = (c) => c.high - c.low;
  const isBullish = (c) => c.close > c.open;
  const isBearish = (c) => c.close < c.open;
  const upperShadow = (c) => c.high - Math.max(c.open, c.close);
  const lowerShadow = (c) => Math.min(c.open, c.close) - c.low;
  
  const b1 = body(c1), r1 = range(c1);
  const b2 = body(c2), r2 = range(c2);
  const b3 = body(c3), r3 = range(c3);

  // 1. Engulfing
  if (isBearish(c2) && isBullish(c3) && c3.close > c2.open && c3.open < c2.close) {
    return { pattern: 'Bullish Engulfing', direction: 'LONG', strength: 90, description: 'Strong bullish reversal' };
  }
  if (isBullish(c2) && isBearish(c3) && c3.close < c2.open && c3.open > c2.close) {
    return { pattern: 'Bearish Engulfing', direction: 'SHORT', strength: 90, description: 'Strong bearish reversal' };
  }

  // 2. Hammer & Shooting Star
  // Hammer: lower shadow >= 2x body, tiny upper shadow
  if (lowerShadow(c3) >= 2 * b3 && upperShadow(c3) <= b3 * 0.2) {
    return { pattern: 'Hammer', direction: 'LONG', strength: 80, description: 'Bullish rejection of lower prices' };
  }
  // Shooting Star: upper shadow >= 2x body, tiny lower shadow
  if (upperShadow(c3) >= 2 * b3 && lowerShadow(c3) <= b3 * 0.2) {
    return { pattern: 'Shooting Star', direction: 'SHORT', strength: 80, description: 'Bearish rejection of higher prices' };
  }

  // 3. Doji
  if (b3 <= r3 * 0.1) {
    return { pattern: 'Doji', direction: 'NEUTRAL', strength: 50, description: 'Market indecision' };
  }

  // 4. Morning / Evening Star (3-candle)
  // Morning Star: Bearish, Doji/Small body, Bullish (closes past midpoint of c1)
  if (isBearish(c1) && r1 > b1 && b2 <= r2 * 0.3 && isBullish(c3) && c3.close > (c1.open + c1.close) / 2) {
    return { pattern: 'Morning Star', direction: 'LONG', strength: 85, description: '3-candle bullish reversal' };
  }
  // Evening Star: Bullish, Doji/Small body, Bearish (closes past midpoint of c1)
  if (isBullish(c1) && r1 > b1 && b2 <= r2 * 0.3 && isBearish(c3) && c3.close < (c1.open + c1.close) / 2) {
    return { pattern: 'Evening Star', direction: 'SHORT', strength: 85, description: '3-candle bearish reversal' };
  }

  // 5. Harami
  // Bullish Harami: Large Bearish, Small Bullish contained within c2 body
  if (isBearish(c2) && isBullish(c3) && c3.open > c2.close && c3.close < c2.open && b3 < b2 * 0.5) {
    return { pattern: 'Bullish Harami', direction: 'LONG', strength: 70, description: 'Inside bar indicating potential bullish reversal' };
  }
  // Bearish Harami: Large Bullish, Small Bearish contained within c2 body
  if (isBullish(c2) && isBearish(c3) && c3.open < c2.close && c3.close > c2.open && b3 < b2 * 0.5) {
    return { pattern: 'Bearish Harami', direction: 'SHORT', strength: 70, description: 'Inside bar indicating potential bearish reversal' };
  }

  // 6. Three White Soldiers / Black Crows
  if (isBullish(c1) && isBullish(c2) && isBullish(c3) && 
      c2.close > c1.close && c3.close > c2.close && 
      c2.open > c1.open && c3.open > c2.open) {
    return { pattern: 'Three White Soldiers', direction: 'LONG', strength: 95, description: 'Strong sustained bullish momentum' };
  }
  if (isBearish(c1) && isBearish(c2) && isBearish(c3) && 
      c2.close < c1.close && c3.close < c2.close && 
      c2.open < c1.open && c3.open < c2.open) {
    return { pattern: 'Three Black Crows', direction: 'SHORT', strength: 95, description: 'Strong sustained bearish momentum' };
  }

  // 7. Marubozu
  if (isBullish(c3) && b3 >= r3 * 0.95 && r3 > 0) {
    return { pattern: 'Marubozu Bullish', direction: 'LONG', strength: 85, description: 'Extreme bullish conviction' };
  }
  if (isBearish(c3) && b3 >= r3 * 0.95 && r3 > 0) {
    return { pattern: 'Marubozu Bearish', direction: 'SHORT', strength: 85, description: 'Extreme bearish conviction' };
  }

  // 8. Tweezer Top/Bottom
  const threshold = r3 * 0.05; // 5% tolerance
  if (Math.abs(c2.high - c3.high) <= threshold && isBullish(c2) && isBearish(c3)) {
    return { pattern: 'Tweezer Top', direction: 'SHORT', strength: 75, description: 'Matching highs indicating resistance' };
  }
  if (Math.abs(c2.low - c3.low) <= threshold && isBearish(c2) && isBullish(c3)) {
    return { pattern: 'Tweezer Bottom', direction: 'LONG', strength: 75, description: 'Matching lows indicating support' };
  }

  return { pattern: null, direction: 'NEUTRAL', strength: 0, description: 'No pattern detected' };
}
