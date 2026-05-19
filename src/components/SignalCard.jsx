import { useState } from 'react';
import ScoreRing from './ScoreRing.jsx';

const REGIME_BORDER = {
  trending_up: 'border-l-4 border-l-emerald-500',
  trending_down: 'border-l-4 border-l-red-500',
  ranging: 'border-l-4 border-l-yellow-500',
  volatile: 'border-l-4 border-l-purple-500',
};

function fmtPrice(p) {
  if (!p) return '—';
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(3);
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Sparkline({ closes = [] }) {
  if (closes.length < 2) return null;
  const w = 80, h = 28;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const pts = closes.map((v, i) => {
    const x = (i / (closes.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const isUp = closes[closes.length - 1] >= closes[0];
  return (
    <svg width={w} height={h}>
      <polyline fill="none" stroke={isUp ? '#10b981' : '#ef4444'} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

export default function SignalCard({ signal, livePrice }) {
  const [hovered, setHovered] = useState(false);
  const price = livePrice ?? signal.entry;
  const change = signal.priceChange ?? 0;
  const borderClass = REGIME_BORDER[signal.regime] ?? 'border-l-4 border-l-gray-700';

  const confidenceColors = {
    VERY_HIGH: 'bg-emerald-900 text-emerald-300',
    HIGH: 'bg-blue-900 text-blue-300',
    MEDIUM: 'bg-yellow-900 text-yellow-300',
    LOW: 'bg-gray-800 text-gray-400',
  };

  const last20Closes = signal.sparkline || [];
  const gemini = signal.geminiVerdict;

  return (
    <div
      className={`relative rounded-xl bg-[#0f1923] border border-[#1e2d40] ${borderClass} p-4 cursor-pointer transition-all duration-200 hover:border-[#2e4a6a] hover:shadow-lg hover:shadow-black/40 animate-fadeSlide`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top Row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-tight">{signal.symbol.replace('USDT','')}/USDT</span>
            <span className="text-xs text-gray-500">15m • Perp</span>
          </div>
          <span className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full ${signal.direction === 'LONG' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>
            {signal.direction === 'LONG' ? '▲ LONG' : '▼ SHORT'}
          </span>
        </div>
        <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
          <ScoreRing score={signal.score} size={80} />
        </div>
      </div>

      {/* Price & Change */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="font-mono font-bold text-white text-xl">${fmtPrice(price)}</div>
          <div className={`text-sm font-mono ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {change >= 0 ? '+' : ''}{change?.toFixed(2)}% 24h
          </div>
        </div>
        <Sparkline closes={last20Closes} />
      </div>

      {/* Confidence */}
      <div className="mb-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidenceColors[signal.confidence] || 'bg-gray-800 text-gray-400'}`}>
          {signal.confidence?.replace('_', ' ')}
        </span>
      </div>

      {/* Trade Levels */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
        <div className="text-gray-400">Entry</div>
        <div className="text-white">${fmtPrice(signal.entry)}</div>
        <div className="text-red-400">Stop Loss</div>
        <div className="text-red-300">${fmtPrice(signal.stopLoss)}</div>
        <div className="text-emerald-400">TP1</div>
        <div className="text-emerald-300">${fmtPrice(signal.tp1)}</div>
        <div className="text-emerald-400">TP2</div>
        <div className="text-emerald-300">${fmtPrice(signal.tp2)}</div>
        <div className="text-gray-400">R/R</div>
        <div className="text-white">{signal.riskReward}x</div>
      </div>

      {/* Hover overlay with Gemini + reasons */}
      {hovered && (
        <div className="absolute inset-0 rounded-xl bg-[#0a0e17]/95 border border-[#2e4a6a] p-4 flex flex-col justify-center gap-2 z-10">
          {gemini && (
            <div className={`text-xs font-bold px-2 py-1 rounded ${gemini.verdict === 'CONFIRM' ? 'bg-emerald-900 text-emerald-300' : gemini.verdict === 'REJECT' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
              AI: {gemini.verdict} — {gemini.reason}
            </div>
          )}
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Top Reasons</div>
          <ul className="space-y-1">
            {(signal.reasons || []).slice(0, 3).map((r, i) => (
              <li key={i} className="text-xs text-gray-300 flex gap-1"><span className="text-emerald-400">•</span>{r}</li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-1 mt-1 text-xs font-mono text-gray-400">
            <span>Trend: <b className="text-white">{signal.subScores?.trend?.score}</b></span>
            <span>Mom: <b className="text-white">{signal.subScores?.momentum?.score}</b></span>
            <span>Vol: <b className="text-white">{signal.subScores?.volume?.score}</b></span>
            <span>Str: <b className="text-white">{signal.subScores?.structure?.score}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}
