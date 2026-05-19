import { X } from 'lucide-react';

const SCORES = [
  { label: 'Trend', weight: 30, color: '#3b82f6', desc: 'EMA stack (9>21>50>200), ADX strength, Ichimoku cloud position, 1H timeframe bias confirmation.' },
  { label: 'Momentum', weight: 25, color: '#10b981', desc: 'RSI overbought/oversold zones, MACD crossovers and histogram slope, Stochastic K/D crosses.' },
  { label: 'Volume', weight: 20, color: '#f59e0b', desc: 'Volume ratio vs 20-bar average, Chaikin Money Flow (CMF), Money Flow Index (MFI).' },
  { label: 'Structure', weight: 15, color: '#8b5cf6', desc: 'Bollinger Band squeeze detection, %B position, proximity to Support & Resistance zones.' },
  { label: 'Pattern', weight: 10, color: '#ef4444', desc: 'Last 3 candles — Engulfing, Hammer, Shooting Star, Doji, Morning/Evening Star, Marubozu, and more.' },
];

export default function HowScoringModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-[#0f1923] border border-[#1e2d40] rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-1">How Scoring Works</h2>
        <p className="text-sm text-gray-400 mb-6">
          The final score (0–100) is a weighted average of 5 independent sub-scores.
          Each sub-scorer votes <span className="text-emerald-400">LONG</span>, <span className="text-red-400">SHORT</span>, or NEUTRAL.
          The final direction requires ≥ 3 votes.
        </p>

        <div className="space-y-5">
          {SCORES.map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-bold text-white">{s.label}</span>
                <span className="text-xs font-mono text-gray-400">{s.weight}%</span>
              </div>
              <div className="h-2 bg-[#1e2d40] rounded-full overflow-hidden mb-1.5">
                <div className="h-full rounded-full" style={{ width: `${s.weight * (10/3)}%`, background: s.color }} />
              </div>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-3 bg-[#0a0e17] rounded-lg border border-[#1e2d40]">
          <p className="text-xs text-gray-400">
            <span className="text-white font-bold">Confidence thresholds:</span>&nbsp;
            <span className="text-emerald-400">≥ 85 = VERY HIGH</span> ·&nbsp;
            <span className="text-blue-400">≥ 70 = HIGH</span> ·&nbsp;
            <span className="text-yellow-400">≥ 55 = MEDIUM</span> ·&nbsp;
            <span className="text-gray-400">&lt; 55 = LOW</span>
          </p>
        </div>
      </div>
    </div>
  );
}
