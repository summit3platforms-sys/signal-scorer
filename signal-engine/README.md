# Signal Scoring Engine

The Signal Scoring Engine is the standalone brain behind Signal Scorer Pro. It evaluates trading pairs and assigns a score from 0 to 100 indicating the strength of a trading setup.

## Architecture
The engine is designed as a completely isolated ES Module. It has zero dependencies on Express, Vite, Next.js, or any web framework. The only external dependency is the `technicalindicators` math library.

This isolation means you can run the engine directly from the CLI or import it into any Node.js environment.

## Sub-Scores
The final score is a weighted average of 5 distinct categories:

1. **Trend (30%)**: Evaluates the directional bias across multiple timeframes.
   - Checks EMA stacks (9, 21, 50, 200).
   - Validates trend strength via ADX > 25.
   - Validates position against Ichimoku Cloud.
   - Requires 1h timeframe confirmation.

2. **Momentum (25%)**: Measures the velocity of price changes.
   - RSI overbought/oversold zones.
   - MACD crossovers and histogram slope.
   - Stochastic K/D crossovers.

3. **Volume (20%)**: Validates price action with capital flow.
   - Volume relative to 20-period moving average.
   - Chaikin Money Flow (CMF).
   - Money Flow Index (MFI).

4. **Structure (15%)**: Contextualizes price against volatility and boundaries.
   - Bollinger Band squeeze detection.
   - S/R zone proximity (using algorithmic swing clustering).

5. **Pattern (10%)**: Candlestick pattern recognition on the last 3 bars.
   - Engulfing, Hammers, Stars, Marubozus, etc.

## Direction Voting
Each sub-scorer evaluates the chart independently and votes `LONG`, `SHORT`, or `NEUTRAL`.
The final direction of the signal is determined by majority vote. If `LONG` receives ≥ 3 votes, the signal is `LONG`.

## Tuning Weights
You can tune the weights and thresholds by modifying the `SCORING_CONFIG` export, or by passing an override config to the constructor:

```javascript
import { SignalScoringEngine } from './SignalScoringEngine.js';

const customEngine = new SignalScoringEngine({
  weights: { trend: 0.40, momentum: 0.20, volume: 0.20, structure: 0.10, pattern: 0.10 }
});
```

## Running Standalone
To execute a self-test of the engine with synthetic data:
```bash
node signal-engine/SignalScoringEngine.js
```
