import { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
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
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

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

  const handleTelegramSend = async (e) => {
    e.stopPropagation();
    if (isSending || sendSuccess) return;
    
    setIsSending(true);
    try {
      const res = await fetch('/api/telegram/send-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal })
      });
      if (res.ok) {
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 3000);
      } else {
        const err = await res.json();
        console.error('Failed to send:', err.error);
      }
    } catch (err) {
      console.error('Error sending to Telegram:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`relative rounded-xl bg-[#0f1923] border border-[#1e2d40] ${borderClass} p-4 transition-all duration-200 hover:border-[#2e4a6a] hover:shadow-lg hover:shadow-black/40 animate-fadeSlide`}>
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

      {/* Confidence & Action */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidenceColors[signal.confidence] || 'bg-gray-800 text-gray-400'}`}>
          {signal.confidence?.replace('_', ' ')}
        </span>
        <button
          onClick={handleTelegramSend}
          disabled={isSending || sendSuccess}
          title="Send to Telegram"
          className="text-gray-400 hover:text-[#0088cc] transition-colors disabled:opacity-50"
        >
          {sendSuccess ? <CheckCircle size={18} className="text-emerald-500" /> : <Send size={18} />}
        </button>
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

      {/* Gemini verdict if available */}
      {gemini && (
        <div className="mt-3">
          <div className={`text-[10px] font-bold px-2 py-1 rounded border ${gemini.verdict === 'CONFIRM' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : gemini.verdict === 'REJECT' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50'}`}>
            AI: {gemini.verdict} — {gemini.reason}
          </div>
        </div>
      )}
    </div>
  );
}
