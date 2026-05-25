import { calculateIndicators } from './indicators.js';
import { detectPatterns } from './patternDetector.js';
import { findSRZones } from './srZones.js';

export const SCORING_CONFIG = {
  weights: {
    trend: 0.30,
    momentum: 0.25,
    volume: 0.20,
    structure: 0.15,
    pattern: 0.10
  },
  thresholds: {
    minScore: 60,
    highConfidence: 70,
    veryHighConfidence: 85,
    alertScore: 75
  },
  atrMultipliers: {
    stopLoss: 2.0,
    takeProfit1: 2.5,
    takeProfit2: 4.5
  },
  adxTrendThreshold: 20,  // Lowered from 25 — skip pairs below this (pure chop)
  adxStrongTrend: 30,     // Bonus awarded above this level
  volumeRatioPeriod: 20,
  cmfPeriod: 20,
  mfiPeriod: 14
};

// ── Statistical Helpers ──────────────────────────────────────────────────

/**
 * Computes Volume-Weighted Z-Score for the most recent candle.
 * Z-score > 1.5 = significantly elevated volume → score boost.
 * Z-score < 0   = below-average volume → score penalty.
 */
function volumeZScore(candles, lookback = 20) {
  const vols = candles.slice(-lookback).map(c => c.volume);
  const mean = vols.reduce((a, b) => a + b, 0) / lookback;
  const std = Math.sqrt(vols.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / lookback);
  const currentVol = candles[candles.length - 1].volume;
  return std === 0 ? 0 : (currentVol - mean) / std;
}

/**
 * Decorrelation-adjusted scoring: prevents double-counting when all factors
 * fire simultaneously in a strong trend.
 * 
 * When all sub-scores are high AND agree, variance is low — this IS a genuine signal.
 * When all sub-scores are low AND agree, it's genuine noise — apply a penalty.
 * When sub-scores disagree (high variance), apply modest confidence reduction.
 */
function computeDecorrelatedScore(subScoreValues, weights) {
  const scores = Object.values(subScoreValues);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Raw weighted sum
  const keys = Object.keys(subScoreValues);
  let rawScore = 0;
  for (const key of keys) {
    rawScore += subScoreValues[key] * (weights[key] || 0);
  }

  // Agreement multiplier:
  //   High mean + low stdDev → strong consensus → genuine signal (1.0)
  //   Low mean  + low stdDev → strong consensus it's noise (0.85 penalty)
  //   High stdDev → factors disagree → uncertain (0.90 penalty)
  let multiplier = 1.0;
  if (stdDev > 25) {
    multiplier = 0.90; // High disagreement among factors
  } else if (mean < 40) {
    multiplier = 0.85; // Low-conviction consensus
  }

  return Math.round(rawScore * multiplier);
}

// ── Main Engine ──────────────────────────────────────────────────────────

export class SignalScoringEngine {
  constructor(config = {}, dbSettings = null) {
    this.config = { ...SCORING_CONFIG, ...config };
    
    // Deep-clone weights to avoid mutating the constant
    this.config.weights = { ...SCORING_CONFIG.weights, ...config.weights };
    this.config.thresholds = { ...SCORING_CONFIG.thresholds, ...config.thresholds };
    this.config.atrMultipliers = { ...SCORING_CONFIG.atrMultipliers, ...config.atrMultipliers };

    // Inject dynamic SQLite settings if provided
    if (dbSettings) {
      if (dbSettings.emaAlignment) this.config.weights.trend = parseFloat(dbSettings.emaAlignment);
      if (dbSettings.rsiZone) this.config.weights.momentum = parseFloat(dbSettings.rsiZone);
      if (dbSettings.volumeSurge) this.config.weights.volume = parseFloat(dbSettings.volumeSurge);
      if (dbSettings.bollingerPos) this.config.weights.structure = parseFloat(dbSettings.bollingerPos);
      if (dbSettings.macdMomentum) this.config.weights.pattern = parseFloat(dbSettings.macdMomentum);
      if (dbSettings.minScore) this.config.thresholds.minScore = parseFloat(dbSettings.minScore);

      // Inject dynamic ATR multipliers if present
      if (dbSettings.atrStopLoss) this.config.atrMultipliers.stopLoss = parseFloat(dbSettings.atrStopLoss);
      if (dbSettings.atrTakeProfit1) this.config.atrMultipliers.takeProfit1 = parseFloat(dbSettings.atrTakeProfit1);
      if (dbSettings.atrTakeProfit2) this.config.atrMultipliers.takeProfit2 = parseFloat(dbSettings.atrTakeProfit2);

      // Inject user-configurable capital, risk, and leverage
      if (dbSettings.capital)  this.config.capital  = parseFloat(dbSettings.capital);
      if (dbSettings.riskPct)  this.config.riskPct  = parseFloat(dbSettings.riskPct) / 100;
      if (dbSettings.leverage) this.config.leverage = parseFloat(dbSettings.leverage);
    }
  }

  getConfig() {
    return this.config;
  }

  /**
   * Scores a symbol based on 15m, 1h, and 4h candles.
   * @param {string} symbol 
   * @param {Array} candles15m 
   * @param {Array} candles1h 
   * @param {Array|null} candles4h 
   * @param {Object|null} fundingData Optional premiumIndex data mapping for symbol
   * @returns {Object|null} SignalResult or null if insufficient data / ranging market / counter-trend.
   */
  scoreSymbol(symbol, candles15m, candles1h, candles4h = null, fundingData = null) {
    if (!candles15m || candles15m.length < 200 || !candles1h || candles1h.length < 200) {
      return null;
    }

    const ind15m = calculateIndicators(candles15m);
    const ind1h = calculateIndicators(candles1h);
    const pattern = detectPatterns(candles15m);
    const sr = findSRZones(candles15m);

    if (!ind15m || !ind1h) return null;

    const currentPrice = ind15m.price;
    const atr = ind15m.atr;

    // ── Regime Detection (ADX filter — skip pure chop) ───────────────────
    // ADX < 20 on BOTH timeframes = ranging market = noise. Skip entirely.
    if (ind15m.adx.adx < this.config.adxTrendThreshold && ind1h.adx.adx < this.config.adxTrendThreshold) {
      return null; // Market is ranging — no edge
    }

    // ── Multi-Timeframe Confluence Filter (4h) ───────────────────────────
    // Only signal when 4h trend agrees with the 15m/1h direction.
    // Eliminates the single biggest source of counter-trend false signals.
    let htfBias = 'NEUTRAL'; // will be set if 4h candles available
    if (candles4h && candles4h.length >= 50) {
      const ind4h = calculateIndicators(candles4h);
      if (ind4h) {
        const bullish4h = ind4h.price > ind4h.ema200 && ind4h.ema9 > ind4h.ema21;
        const bearish4h = ind4h.price < ind4h.ema200 && ind4h.ema9 < ind4h.ema21;
        if (bullish4h) htfBias = 'LONG';
        else if (bearish4h) htfBias = 'SHORT';
      }
    }

    let regime = "ranging";
    const atrPct = (ind1h.atr / ind1h.price) * 100;
    if (atrPct > 3) {
      regime = "volatile";
    } else if (ind1h.adx.adx > this.config.adxTrendThreshold) {
      if (ind1h.price > ind1h.ema200 && ind1h.ema9 > ind1h.ema21) {
        regime = "trending_up";
      } else if (ind1h.price < ind1h.ema200 && ind1h.ema9 < ind1h.ema21) {
        regime = "trending_down";
      }
    }

    // ── Volume Z-Score (statistical volume analysis) ─────────────────────
    const volZ = volumeZScore(candles15m);

    // ── Sub-Scores ───────────────────────────────────────────────────────
    const trend = this._evaluateTrend(ind15m, ind1h);
    const momentum = this._evaluateMomentum(ind15m);
    const volume = this._evaluateVolume(ind15m, candles15m, volZ);
    const structure = this._evaluateStructure(ind15m, currentPrice, atr, sr);
    const patternScore = this._evaluatePattern(pattern);

    // ── Direction Voting ─────────────────────────────────────────────────
    const votes = [trend.vote, momentum.vote, volume.vote, structure.vote, patternScore.vote];
    const longVotes = votes.filter(v => v === 'LONG').length;
    const shortVotes = votes.filter(v => v === 'SHORT').length;
    
    let direction = 'NEUTRAL';
    if (longVotes >= 3) direction = 'LONG';
    else if (shortVotes >= 3) direction = 'SHORT';
    else direction = longVotes > shortVotes ? 'LONG' : 'SHORT';

    // ── 4h Confluence Gate ───────────────────────────────────────────────
    // If 4h has a clear bias that conflicts with our signal direction, kill it.
    // If 4h is NEUTRAL (not enough data), allow the signal through.
    if (htfBias !== 'NEUTRAL' && htfBias !== direction) {
      return null; // Counter-trend to 4h — no edge
    }

    // ── Funding Rate Filter ──────────────────────────────────────────────
    // Funding rate is free directional edge:
    //   High positive funding → longs pay shorts → SHORT has cost-of-carry advantage
    //   High negative funding → shorts pay longs → LONG has cost-of-carry advantage
    //   Extreme funding in SAME direction as signal = strong confluence bonus
    //   Extreme funding AGAINST signal = score penalty (fighting the carry)

    let fundingScore = 0;
    let fundingReason = null;

    if (fundingData) {
      const rate = fundingData.rate; // raw 8h rate

      const EXTREME_THRESHOLD  = 0.001;  // 0.1% per 8h = ~109% annualized
      const HIGH_THRESHOLD     = 0.0004; // 0.04% per 8h = ~43% annualized
      const NEGATIVE_EXTREME   = -0.001;
      const NEGATIVE_HIGH      = -0.0004;

      if (direction === 'SHORT') {
        if (rate >= EXTREME_THRESHOLD) {
          fundingScore = 25; // Longs paying heavily — shorts get paid to hold
          fundingReason = `Extreme positive funding (${(rate * 100).toFixed(4)}%) favors SHORT`;
        } else if (rate >= HIGH_THRESHOLD) {
          fundingScore = 12;
          fundingReason = `High positive funding (${(rate * 100).toFixed(4)}%) favors SHORT`;
        } else if (rate <= NEGATIVE_HIGH) {
          fundingScore = -15; // Funding working against SHORT
          fundingReason = `Negative funding penalizes SHORT position`;
        }
      } else if (direction === 'LONG') {
        if (rate <= NEGATIVE_EXTREME) {
          fundingScore = 25; // Shorts paying heavily — longs get paid to hold
          fundingReason = `Extreme negative funding (${(rate * 100).toFixed(4)}%) favors LONG`;
        } else if (rate <= NEGATIVE_HIGH) {
          fundingScore = 12;
          fundingReason = `Negative funding (${(rate * 100).toFixed(4)}%) favors LONG`;
        } else if (rate >= HIGH_THRESHOLD) {
          fundingScore = -15; // Funding working against LONG
          fundingReason = `Positive funding penalizes LONG position`;
        }
      }
    }

    // ── Decorrelated Score Calculation ───────────────────────────────────
    // Only count sub-scores that align with the majority direction
    const alignedScores = {
      trend: direction === trend.vote ? trend.score : 0,
      momentum: direction === momentum.vote ? momentum.score : 0,
      volume: direction === volume.vote ? volume.score : 0,
      structure: direction === structure.vote ? structure.score : 0,
      pattern: direction === patternScore.vote ? patternScore.score : 0
    };

    const totalScore = computeDecorrelatedScore(alignedScores, this.config.weights);

    // Apply funding adjustment directly to final score (not weighted — it's an additive edge)
    const fundingAdjustedScore = Math.min(100, Math.max(0, totalScore + fundingScore));
    const finalScore = fundingAdjustedScore;

    // ── Confidence Label ─────────────────────────────────────────────────
    let confidence = 'LOW';
    if (finalScore >= this.config.thresholds.veryHighConfidence) confidence = 'VERY_HIGH';
    else if (finalScore >= this.config.thresholds.highConfidence) confidence = 'HIGH';
    else if (finalScore >= this.config.thresholds.minScore) confidence = 'MEDIUM';

    // ── Dynamic ATR-Based TP/SL (Multi-Timeframe Weighted) ───────────────
    const { stopLoss, tp1, tp2, atr: finalAtr, positionSizing, tp1IsNetPositive } = this._calculateDynamicTargets(
      candles15m, candles1h, candles4h, direction, currentPrice, regime
    );
    
    const riskReward = Math.abs(tp2 - currentPrice) / Math.abs(currentPrice - stopLoss);

    // ── Compile Reasons ──────────────────────────────────────────────────
    const allReasons = [
      ...trend.reasons, ...momentum.reasons, ...volume.reasons, 
      ...structure.reasons, ...patternScore.reasons,
      ...(fundingReason ? [fundingReason] : [])
    ];
    
    return {
      symbol,
      direction,
      htfBias,  // 'LONG' | 'SHORT' | 'NEUTRAL'
      score: finalScore,
      confidence,
      subScores: { trend, momentum, volume, structure, pattern: patternScore },
      entry: currentPrice,
      stopLoss,
      tp1,
      tp2,
      riskReward: parseFloat(riskReward.toFixed(2)),
      reasons: allReasons.slice(0, 5),
      regime,
      volumeZScore: parseFloat(volZ.toFixed(2)),
      atrWeighted: parseFloat(finalAtr.toFixed(6)),
      timestamp: Date.now(),
      fundingRate: fundingData ? parseFloat((fundingData.rate * 100).toFixed(6)) : null,
      fundingBias: fundingScore > 0 ? 'CONFIRMS' : fundingScore < 0 ? 'OPPOSES' : 'NEUTRAL',
      positionSizing,
      tp1IsNetPositive
    };
  }

  scoreMultiple(symbols, candleMap, fundingRates = null) {
    const results = [];
    for (const symbol of symbols) {
      const c = candleMap.get(symbol);
      if (c && c['15m'] && c['1h']) {
        const funding = fundingRates ? fundingRates.get(symbol) || null : null;
        const res = this.scoreSymbol(symbol, c['15m'], c['1h'], c['4h'] || null, funding);
        if (res) results.push(res);
      }
    }
    return results;
  }

  // ── Multi-Timeframe ATR-Based Dynamic Targets ─────────────────────────

  /**
   * Computes SL/TP using a weighted multi-timeframe ATR across 15m, 1h, and 4h candles.
   * Regime-adaptive multipliers adjust for trending vs volatile vs ranging conditions.
   *
   * Weighting rationale:
   *   1h  (50%) — primary trend confirmation timeframe
   *   4h  (30%) — macro swing sizing for structural targets
   *   15m (20%) — entry precision only, smallest weight to avoid noise
   */
  _calculateDynamicTargets(candles15m, candles1h, candles4h, direction, entry, regime) {
    // Compute exponentially-smoothed ATR(14) for a given candle array
    const calcATR = (candles) => {
      if (!candles || candles.length < 15) return null;
      const trueRanges = candles.slice(1).map((c, i) => {
        const prev = candles[i];
        return Math.max(
          c.high - c.low,
          Math.abs(c.high - prev.close),
          Math.abs(c.low - prev.close)
        );
      });
      const period = 14;
      let atr = trueRanges[trueRanges.length - period];
      for (let i = trueRanges.length - period + 1; i < trueRanges.length; i++) {
        atr = atr * ((period - 1) / period) + trueRanges[i] * (1 / period);
      }
      return atr;
    };

    const atr15m = calcATR(candles15m);
    const atr1h  = calcATR(candles1h);
    const atr4h  = calcATR(candles4h);

    // Weighted multi-timeframe ATR:
    // 1h gets heaviest weight — primary trend confirmation timeframe
    // 4h contributes macro swing sizing
    // 15m is entry precision only — smallest weight
    let weightedATR;
    if (atr1h && atr4h) {
      weightedATR = (atr15m * 0.20) + (atr1h * 0.50) + (atr4h * 0.30);
    } else if (atr1h) {
      weightedATR = (atr15m * 0.35) + (atr1h * 0.65);
    } else {
      weightedATR = atr15m;
    }

    // Regime-adaptive multipliers
    let slMul, tp1Mul, tp2Mul;

    switch (regime) {
      case 'trending_up':
      case 'trending_down':
        // Strong trend — tight SL, wide TP to let momentum run
        slMul  = this.config.atrMultipliers.stopLoss;    // user setting (default 2.0)
        tp1Mul = 4.0;
        tp2Mul = 7.0;
        break;
      case 'volatile':
        // High volatility — wider SL to survive wicks, closer TP to bank profit
        slMul  = Math.max(this.config.atrMultipliers.stopLoss, 3.0);
        tp1Mul = 3.5;
        tp2Mul = 5.5;
        break;
      default:
        // Ranging or unknown — use user-configured settings as-is
        slMul  = this.config.atrMultipliers.stopLoss;
        tp1Mul = this.config.atrMultipliers.takeProfit1;
        tp2Mul = this.config.atrMultipliers.takeProfit2;
    }

    const stopLoss = direction === 'LONG'
      ? entry - (weightedATR * slMul)
      : entry + (weightedATR * slMul);

    const tp1 = direction === 'LONG'
      ? entry + (weightedATR * tp1Mul)
      : entry - (weightedATR * tp1Mul);

    const tp2 = direction === 'LONG'
      ? entry + (weightedATR * tp2Mul)
      : entry - (weightedATR * tp2Mul);

    // ── Fee-Adjusted Break-Even Validation ──────────────────────────────
    // Binance taker fee = 0.05% each side = 0.10% round-trip
    // TP1 must exceed fee cost to be a net-positive trade
    const TAKER_FEE = 0.0005; // 0.05% per side
    const roundTripFeePct = TAKER_FEE * 2;

    const tp1Pct = Math.abs(tp1 - entry) / entry;
    const tp1IsNetPositive = tp1Pct > roundTripFeePct;

    // ── Position Sizing (capital-aware, risk-normalized) ─────────────────
    // Read from engine config with sensible defaults
    const CAPITAL  = this.config.capital  || 1000;
    const RISK_PCT = this.config.riskPct  || 0.02;
    const LEVERAGE = this.config.leverage || 5;

    const riskAmount = CAPITAL * RISK_PCT;                    // e.g. $20
    const slDistPct = Math.abs(entry - stopLoss) / entry;     // e.g. 0.018 = 1.8%
    const positionUsd = Math.min(riskAmount / slDistPct, CAPITAL * LEVERAGE);
    const positionQty = positionUsd / entry;
    const feeUsd = positionUsd * roundTripFeePct;
    const potentialProfitTp1 = (positionUsd * Math.abs(tp1 - entry) / entry) - feeUsd;
    const potentialProfitTp2 = (positionUsd * Math.abs(tp2 - entry) / entry) - feeUsd;
    const potentialLoss = riskAmount + feeUsd;

    return {
      stopLoss, tp1, tp2, atr: weightedATR,
      tp1IsNetPositive,
      positionSizing: {
        positionUsd: parseFloat(positionUsd.toFixed(2)),
        positionQty: parseFloat(positionQty.toFixed(4)),
        riskUsd: parseFloat(riskAmount.toFixed(2)),
        feeUsd: parseFloat(feeUsd.toFixed(3)),
        potentialProfitTp1: parseFloat(potentialProfitTp1.toFixed(2)),
        potentialProfitTp2: parseFloat(potentialProfitTp2.toFixed(2)),
        potentialLoss: parseFloat(potentialLoss.toFixed(2)),
        riskRewardTp1: parseFloat((potentialProfitTp1 / potentialLoss).toFixed(2)),
        riskRewardTp2: parseFloat((potentialProfitTp2 / potentialLoss).toFixed(2))
      }
    };
  }

  // ── Sub-Score Evaluators ──────────────────────────────────────────────

  _evaluateTrend(ind, ind1h) {
    let score = 0;
    let vote = 'NEUTRAL';
    const reasons = [];

    const isBullishStack = ind.ema9 > ind.ema21 && ind.ema21 > ind.ema50 && ind.ema50 > ind.ema200;
    const isBearishStack = ind.ema9 < ind.ema21 && ind.ema21 < ind.ema50 && ind.ema50 < ind.ema200;
    
    if (isBullishStack) {
      vote = 'LONG';
      score += 40;
      reasons.push("EMA stack fully bullish (9>21>50>200)");
    } else if (isBearishStack) {
      vote = 'SHORT';
      score += 40;
      reasons.push("EMA stack fully bearish (9<21<50<200)");
    } else if (ind.ema9 > ind.ema21 && ind.price > ind.ema50) {
      vote = 'LONG';
      score += 20;
      reasons.push("Price above EMA50 with bullish short-term crossover");
    } else if (ind.ema9 < ind.ema21 && ind.price < ind.ema50) {
      vote = 'SHORT';
      score += 20;
      reasons.push("Price below EMA50 with bearish short-term crossover");
    }

    // ADX strength — graduated scoring instead of binary threshold
    if (ind.adx.adx > this.config.adxStrongTrend) {
      score += 30;
      reasons.push(`Strong trend (ADX ${Math.round(ind.adx.adx)})`);
      if (vote === 'NEUTRAL') {
        vote = ind.adx.pdi > ind.adx.mdi ? 'LONG' : 'SHORT';
      }
    } else if (ind.adx.adx > this.config.adxTrendThreshold) {
      score += 15;
      reasons.push(`Moderate trend (ADX ${Math.round(ind.adx.adx)})`);
      if (vote === 'NEUTRAL') {
        vote = ind.adx.pdi > ind.adx.mdi ? 'LONG' : 'SHORT';
      }
    }

    if (ind.ichimoku) {
      if (ind.price > ind.ichimoku.senkouA && ind.price > ind.ichimoku.senkouB) {
        score += 15;
        if (vote === 'LONG') reasons.push("Price above Ichimoku cloud");
      } else if (ind.price < ind.ichimoku.senkouA && ind.price < ind.ichimoku.senkouB) {
        score += 15;
        if (vote === 'SHORT') reasons.push("Price below Ichimoku cloud");
      }
    }

    // HTF confirmation
    if (vote === 'LONG' && ind1h.price > ind1h.ema50) {
      score += 15;
      reasons.push("1H timeframe confirms bullish trend");
    } else if (vote === 'SHORT' && ind1h.price < ind1h.ema50) {
      score += 15;
      reasons.push("1H timeframe confirms bearish trend");
    }

    return { score: Math.min(100, score), reasons, vote };
  }

  _evaluateMomentum(ind) {
    let score = 0;
    let vote = 'NEUTRAL';
    const reasons = [];

    // RSI
    if (ind.rsi14 < 30) {
      vote = 'LONG';
      score += 30;
      reasons.push(`RSI is oversold (${Math.round(ind.rsi14)})`);
    } else if (ind.rsi14 > 70) {
      vote = 'SHORT';
      score += 30;
      reasons.push(`RSI is overbought (${Math.round(ind.rsi14)})`);
    } else if (ind.rsi14 > 50) {
      vote = 'LONG';
      score += 10;
    } else {
      vote = 'SHORT';
      score += 10;
    }

    // MACD
    if (ind.macd.MACD > ind.macd.signal) {
      if (vote === 'LONG' || vote === 'NEUTRAL') {
        vote = 'LONG';
        score += 40;
        reasons.push("MACD bullish crossover");
        if (ind.macd.histogram > 0) score += 10;
      }
    } else {
      if (vote === 'SHORT' || vote === 'NEUTRAL') {
        vote = 'SHORT';
        score += 40;
        reasons.push("MACD bearish crossover");
        if (ind.macd.histogram < 0) score += 10;
      }
    }

    // Stochastic
    if (ind.stoch.k < 20 && ind.stoch.k > ind.stoch.d && vote === 'LONG') {
      score += 20;
      reasons.push("Stochastic bullish crossover in oversold zone");
    } else if (ind.stoch.k > 80 && ind.stoch.k < ind.stoch.d && vote === 'SHORT') {
      score += 20;
      reasons.push("Stochastic bearish crossover in overbought zone");
    }

    return { score: Math.min(100, score), reasons, vote };
  }

  _evaluateVolume(ind, candles, volZ) {
    let score = 0;
    let vote = 'NEUTRAL';
    const reasons = [];

    // Direction from price relative to SMA20
    if (ind.price > ind.sma20) vote = 'LONG';
    else vote = 'SHORT';

    // ── Volume Z-Score based scoring (replaces raw volume ratio) ──────
    if (volZ > 2.0) {
      score += 50;
      reasons.push(`Extreme volume surge (Z-score: ${volZ.toFixed(1)})`);
    } else if (volZ > 1.5) {
      score += 40;
      reasons.push(`High volume breakout (Z-score: ${volZ.toFixed(1)})`);
    } else if (volZ > 0.5) {
      score += 20;
    } else if (volZ < -0.5) {
      score -= 10; // Below-average volume penalty
      reasons.push("Below-average volume (weak conviction)");
    }

    // CMF
    if (ind.cmf > 0.05 && vote === 'LONG') {
      score += 25;
      reasons.push("CMF shows positive money flow");
    } else if (ind.cmf < -0.05 && vote === 'SHORT') {
      score += 25;
      reasons.push("CMF shows negative money flow");
    }

    // MFI
    if (ind.mfi > 80 && vote === 'SHORT') {
      score += 25;
      reasons.push("MFI is severely overbought");
    } else if (ind.mfi < 20 && vote === 'LONG') {
      score += 25;
      reasons.push("MFI is severely oversold");
    }

    return { score: Math.min(100, Math.max(0, score)), reasons, vote };
  }

  _evaluateStructure(ind, currentPrice, atr, sr) {
    let score = 0;
    let vote = 'NEUTRAL';
    const reasons = [];

    if (!ind.bb) return { score, reasons, vote };

    const bbWidthPct = ind.bb.width;

    // Squeeze detection
    if (bbWidthPct < 0.02) {
      score += 30;
      reasons.push("Bollinger Bands squeeze (imminent breakout)");
    }

    if (ind.bb.percentB > 1.0) {
      vote = 'LONG';
      score += 40;
      reasons.push("Price broke above upper Bollinger Band");
    } else if (ind.bb.percentB < 0) {
      vote = 'SHORT';
      score += 40;
      reasons.push("Price broke below lower Bollinger Band");
    } else if (ind.bb.percentB > 0.5) {
      vote = 'LONG';
      score += 10;
    } else {
      vote = 'SHORT';
      score += 10;
    }

    // S/R proximity
    const threshold = atr * 0.5;
    if (sr.nearestSupport && (currentPrice - sr.nearestSupport.price) <= threshold) {
      if (vote === 'LONG') {
        score += 30;
        reasons.push(`Price bouncing off support ($${sr.nearestSupport.price.toFixed(2)})`);
      }
    }
    if (sr.nearestResistance && (sr.nearestResistance.price - currentPrice) <= threshold) {
      if (vote === 'SHORT') {
        score += 30;
        reasons.push(`Price rejecting from resistance ($${sr.nearestResistance.price.toFixed(2)})`);
      }
    }

    return { score: Math.min(100, score), reasons, vote };
  }

  _evaluatePattern(pattern) {
    if (!pattern || !pattern.pattern) {
      return { score: 0, reasons: [], vote: 'NEUTRAL' };
    }
    return {
      score: pattern.strength,
      reasons: [pattern.description],
      vote: pattern.direction
    };
  }
}

// ── SELF-TEST BLOCK ────────────────────────────────────────────────────────
// Run: node signal-engine/SignalScoringEngine.js
const isMain = process.argv[1] && process.argv[1].includes('SignalScoringEngine');
if (isMain) {
  console.log("Running SignalScoringEngine v2 Self-Test...");
  const generateCandles = (count, startPrice, trendDir) => {
    const c = [];
    let p = startPrice;
    for(let i=0; i<count; i++) {
      const open = p;
      const close = p + (Math.random() * 10 * trendDir);
      const high = Math.max(open, close) + Math.random() * 5;
      const low = Math.min(open, close) - Math.random() * 5;
      p = close;
      c.push({ time: i, open, high, low, close, volume: 1000 + Math.random()*500 });
    }
    return c;
  };
  
  const c15m = generateCandles(200, 60000, 1);
  const c1h = generateCandles(200, 58000, 1);
  
  const engine = new SignalScoringEngine();
  const res = engine.scoreSymbol("BTCUSDT", c15m, c1h);
  console.log(JSON.stringify(res, null, 2));
}
