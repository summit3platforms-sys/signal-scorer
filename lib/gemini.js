import { GoogleGenerativeAI } from '@google/generative-ai';

// In-memory cache for Gemini results to save API calls
// Key: symbol+direction, Value: { data, expires }
const geminiCache = new Map();

/**
 * Validates a signal using Google Gemini AI.
 * @param {Object} signalResult The output from SignalScoringEngine
 * @returns {Promise<{verdict: "CONFIRM"|"REJECT"|"HOLD"|null, reason: string, riskLevel: string}>}
 */
export async function validateSignal(signalResult) {
  if (!process.env.GEMINI_API_KEY) {
    return { verdict: null, reason: "API key missing", riskLevel: "UNKNOWN" };
  }

  const cacheKey = `${signalResult.symbol}_${signalResult.direction}`;
  const cached = geminiCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
You are a professional crypto trading analyst reviewing a signal.
Analyze this trading signal objectively and respond ONLY in JSON.

Symbol: ${signalResult.symbol}
Direction: ${signalResult.direction}
Score: ${signalResult.score}/100
Confidence: ${signalResult.confidence}
Market Regime: ${signalResult.regime}

Sub-scores:
- Trend: ${signalResult.subScores.trend.score}/100 — ${signalResult.subScores.trend.reasons.join(', ')}
- Momentum: ${signalResult.subScores.momentum.score}/100 — ${signalResult.subScores.momentum.reasons.join(', ')}
- Volume: ${signalResult.subScores.volume.score}/100 — ${signalResult.subScores.volume.reasons.join(', ')}
- Structure: ${signalResult.subScores.structure.score}/100 — ${signalResult.subScores.structure.reasons.join(', ')}
- Pattern: ${signalResult.subScores.pattern.score}/100 — ${signalResult.subScores.pattern.reasons.join(', ')}

Trade Levels:
Entry: ${signalResult.entry}  |  SL: ${signalResult.stopLoss}  |  TP1: ${signalResult.tp1}  |  TP2: ${signalResult.tp2}  |  R/R: ${signalResult.riskReward}x

Top signals: ${signalResult.reasons.slice(0, 5).join(' | ')}

Respond with ONLY this JSON (no markdown, no explanation):
{
  "verdict": "CONFIRM" | "REJECT" | "HOLD",
  "reason": "one concise sentence explaining the verdict",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "EXTREME"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON (Gemini usually returns clean JSON if responseMimeType is set)
    const data = JSON.parse(text);
    
    // Cache for 5 minutes
    geminiCache.set(cacheKey, { data, expires: Date.now() + 5 * 60 * 1000 });
    
    return data;
  } catch (err) {
    console.error(`[Gemini] Validation failed for ${signalResult.symbol}:`, err.message);
    return { verdict: null, reason: "AI validation failed", riskLevel: "UNKNOWN" };
  }
}
