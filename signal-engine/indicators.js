import {
  EMA, SMA, RSI, MACD, Stochastic, ADX, BollingerBands, ATR, CCI, WilliamsR, KeltnerChannels, IchimokuCloud
} from 'technicalindicators';

/**
 * Calculates a comprehensive suite of technical indicators for a given symbol.
 * @param {Array<{time, open, high, low, close, volume}>} candles
 * @returns {Object} Enriched object with all indicators at the last bar
 */
export function calculateIndicators(candles) {
  if (!candles || candles.length < 200) {
    return null; // Not enough data
  }

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const lastClose = closes[closes.length - 1];
  const lastVolume = volumes[volumes.length - 1];

  // Moving Averages
  const ema9 = EMA.calculate({ period: 9, values: closes }).pop();
  const ema21 = EMA.calculate({ period: 21, values: closes }).pop();
  const ema50 = EMA.calculate({ period: 50, values: closes }).pop();
  const ema200 = EMA.calculate({ period: 200, values: closes }).pop();
  const sma20 = SMA.calculate({ period: 20, values: closes }).pop();
  const sma50 = SMA.calculate({ period: 50, values: closes }).pop();

  // Oscillators
  const rsi14 = RSI.calculate({ period: 14, values: closes }).pop();
  const rsi7 = RSI.calculate({ period: 7, values: closes }).pop();
  
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const macd = macdValues.pop();

  const stochValues = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3
  });
  const stoch = stochValues.pop();

  const adxValues = ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  });
  const adx = adxValues.pop();

  const cciValues = CCI.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 20
  });
  const cci = cciValues.pop();

  const williamsRValues = WilliamsR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  });
  const williamsR = williamsRValues.pop();

  // Volatility & Bands
  const bbValues = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2
  });
  const bbRaw = bbValues.pop();
  const bb = bbRaw ? {
    upper: bbRaw.upper,
    middle: bbRaw.middle,
    lower: bbRaw.lower,
    width: (bbRaw.upper - bbRaw.lower) / bbRaw.middle,
    percentB: (lastClose - bbRaw.lower) / (bbRaw.upper - bbRaw.lower)
  } : null;

  const atrValues = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  });
  const atr = atrValues.pop();

  const keltnerValues = KeltnerChannels.calculate({
    high: highs,
    low: lows,
    close: closes,
    maPeriod: 20,
    atrPeriod: 10,
    multiplier: 2
  });
  const keltner = keltnerValues.pop();

  // Volume
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }

  // CMF (Chaikin Money Flow) manually calculated
  let cmf = 0;
  let sumMFV = 0;
  let sumVol = 0;
  const periodCMF = 20;
  for (let i = closes.length - periodCMF; i < closes.length; i++) {
    const c = candles[i];
    if (c.high !== c.low) {
      const mfm = ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low);
      const mfv = mfm * c.volume;
      sumMFV += mfv;
    }
    sumVol += c.volume;
  }
  cmf = sumVol > 0 ? sumMFV / sumVol : 0;

  // MFI (Money Flow Index) manually calculated
  const periodMFI = 14;
  let posMF = 0;
  let negMF = 0;
  for (let i = closes.length - periodMFI; i < closes.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const prevTp = (candles[i-1].high + candles[i-1].low + candles[i-1].close) / 3;
    const mf = tp * candles[i].volume;
    if (tp > prevTp) posMF += mf;
    else if (tp < prevTp) negMF += mf;
  }
  const mfiRatio = negMF === 0 ? 100 : posMF / negMF;
  const mfi = 100 - (100 / (1 + mfiRatio));

  // VWAP (simple rolling over the provided candles, typically session based but we'll use all provided)
  let sumVP = 0;
  let totalVol = 0;
  for (let i = 0; i < candles.length; i++) {
    const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
    sumVP += typicalPrice * candles[i].volume;
    totalVol += candles[i].volume;
  }
  const vwap = totalVol > 0 ? sumVP / totalVol : lastClose;

  // Ichimoku Cloud
  const ichimokuValues = IchimokuCloud.calculate({
    high: highs,
    low: lows,
    conversionPeriod: 9,
    basePeriod: 26,
    spanPeriod: 52,
    displacement: 26
  });
  const ichimoku = ichimokuValues.length > 0 ? ichimokuValues.pop() : null;
  const formattedIchimoku = ichimoku ? {
    tenkan: ichimoku.conversion,
    kijun: ichimoku.base,
    senkouA: ichimoku.spanA,
    senkouB: ichimoku.spanB,
    chikou: lastClose // Simplified chikou
  } : null;

  // Pivot Points (Classic)
  // Typically calculated from previous day's HLC, but we'll use the last completed candle (index - 2) for current candle (index - 1)
  const prevCandle = candles[candles.length - 2] || candles[candles.length - 1];
  const P = (prevCandle.high + prevCandle.low + prevCandle.close) / 3;
  const R1 = (P * 2) - prevCandle.low;
  const R2 = P + (prevCandle.high - prevCandle.low);
  const R3 = prevCandle.high + 2 * (P - prevCandle.low);
  const S1 = (P * 2) - prevCandle.high;
  const S2 = P - (prevCandle.high - prevCandle.low);
  const S3 = prevCandle.low - 2 * (prevCandle.high - P);

  const pivots = { P, R1, R2, R3, S1, S2, S3 };

  return {
    ema9, ema21, ema50, ema200, sma20, sma50,
    rsi14, rsi7, macd, stoch, adx, bb, atr,
    obv, cmf, mfi, cci, williamsR, keltner,
    vwap, ichimoku: formattedIchimoku, pivots,
    price: lastClose,
    volume: lastVolume
  };
}
