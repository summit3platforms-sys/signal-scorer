import { useAuthStore } from '../store/authStore.js';
import { useState, useEffect } from 'react';
import { Send, CheckCircle, Clock, Star } from 'lucide-react';
import ScoreRing from './ScoreRing.jsx';

const REGIME_BORDER = {
  trending_up: 'border-l-4 border-l-emerald-500',
  trending_down: 'border-l-4 border-l-red-500',
  ranging: 'border-l-4 border-l-yellow-500',
  volatile: 'border-l-4 border-l-purple-500',
};

function fmtPrice(p) {
  if (!p) return '\u2014';
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

// ── Entry Countdown Bar ───────────────────────────────────────────────────────
// Drains green→amber→red over entryWindowMinutes. Updates every second.
// Shows "✓ Entry Confirmed" in the 5-min grace window after the check fires.
// Disappears after grace window, or immediately if tp1Hit = 1.
function EntryCountdownBar({ createdAt, tp1Hit, entryWindowMinutes = 30 }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Never show bar if TP1 already hit (market confirmed entry)
  if (!createdAt || tp1Hit === 1) return null;

  const windowMs  = entryWindowMinutes * 60 * 1000;
  const graceMs   = 5 * 60 * 1000;
  const created   = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt;
  const age       = now - created;

  // Fully past both window and grace — hide completely
  if (age >= windowMs + graceMs) return null;

  // In the 5-min grace window: backend validated it (still ACTIVE = confirmed)
  if (age >= windowMs) {
    return (
      <div className="flex items-center gap-1.5 my-2 px-2 py-1 rounded-lg bg-emerald-900/30 border border-emerald-700/30">
        <span className="text-emerald-400 text-[10px]">●</span>
        <span className="text-[10px] font-bold font-mono text-emerald-400 tracking-wide">
          ✓ ENTRY CONFIRMED — signal validated by market
        </span>
      </div>
    );
  }

  // Active countdown
  const remaining = windowMs - age;
  const pct       = Math.max(0, Math.min(100, (remaining / windowMs) * 100));
  const totalSec  = Math.max(0, Math.floor(remaining / 1000));
  const mins      = Math.floor(totalSec / 60);
  const secs      = totalSec % 60;
  const timeStr   = `${mins}m ${secs.toString().padStart(2, '0')}s`;

  const barColor  = pct > 50 ? '#10b981' : pct > 20 ? '#f0b429' : '#ef4444';
  const textColor = pct > 50 ? 'text-emerald-400' : pct > 20 ? 'text-yellow-400' : 'text-red-400';
  const bgColor   = pct > 50
    ? 'bg-emerald-900/20 border-emerald-800/30'
    : pct > 20
    ? 'bg-yellow-900/20 border-yellow-800/30'
    : 'bg-red-900/25 border-red-800/35';

  return (
    <div className={`my-2 px-2 pt-1.5 pb-2 rounded-lg border ${bgColor}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[9px] font-bold uppercase tracking-widest ${textColor} font-mono`}>
          ⏳ Entry Window
        </span>
        <span className={`text-[10px] font-mono font-bold ${textColor}`}>
          {timeStr} remaining
        </span>
      </div>

      <div className="relative h-1.5 bg-[#1e2d40] rounded-full overflow-hidden">
        <div style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}66, ${barColor})`,
          boxShadow: `0 0 6px ${barColor}88`,
          transition: 'width 1s linear',
          height: '100%',
          borderRadius: '9999px',
        }} />
        {pct > 2 && (
          <div style={{
            position: 'absolute', top: 0, left: `${pct}%`,
            transform: 'translateX(-50%)', width: 3, height: '100%',
            background: barColor, boxShadow: `0 0 8px ${barColor}`,
            borderRadius: '9999px',
          }} />
        )}
      </div>

      {pct <= 20 && pct > 0 && (
        <div className="text-[8.5px] text-red-500 font-mono mt-1 text-center tracking-wide animate-pulse">
          ⚠ Price must confirm direction now or signal will be invalidated
        </div>
      )}
    </div>
  );
}


// ── Signal Age Pill ───────────────────────────────────────────────────────────
function AgePill({ createdAt }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!createdAt) return null;

  const ms = now - (typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt);
  const mins = Math.floor(ms / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  let label;
  if (mins < 60)   label = `${mins}m ago`;
  else if (hrs < 24) label = `${hrs}h ${mins % 60}m ago`;
  else              label = `${days}d ${hrs % 24}h ago`;

  // Color tier
  let colorCls;
  if (hrs < 2)      colorCls = 'bg-emerald-900/60 text-emerald-400';
  else if (hrs < 8) colorCls = 'bg-yellow-900/60 text-yellow-400';
  else              colorCls = 'bg-gray-800/60 text-gray-400';

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colorCls}`}>
      <Clock size={9} />
      {label}
    </span>
  );
}

// ── Price Progress Bar ────────────────────────────────────────────────────────
function PriceProgressBar({ signal, livePrice }) {
  const { entry, stopLoss, tp1, tp2, direction } = signal;
  const price = livePrice ?? entry;
  const isLong = direction === 'LONG';

  // Calculate fill %
  let fillPct;
  if (isLong) {
    const range = tp2 - stopLoss;
    fillPct = range === 0 ? 0 : ((price - stopLoss) / range) * 100;
  } else {
    const range = stopLoss - tp2;
    fillPct = range === 0 ? 0 : ((stopLoss - price) / range) * 100;
  }
  fillPct = Math.max(0, Math.min(100, fillPct));

  // Fill color: green if profit, red if loss
  const inProfit = isLong ? price > entry : price < entry;
  const fillColor = inProfit ? '#10b981' : '#ef4444';

  // Marker positions (E, TP1, TP2) as percentages
  const markerPos = (level) => {
    let pct;
    if (isLong) {
      pct = ((level - stopLoss) / (tp2 - stopLoss)) * 100;
    } else {
      pct = ((stopLoss - level) / (stopLoss - tp2)) * 100;
    }
    return Math.max(0, Math.min(100, pct));
  };

  const entryPct = markerPos(entry);
  const tp1Pct   = markerPos(tp1);

  return (
    <div className="my-2.5">
      {/* Labels above bar */}
      <div className="flex justify-between items-center mb-1 px-0.5">
        <span className="text-[9px] font-mono text-red-400 font-bold">SL</span>
        <span className="text-[10px] font-mono text-white font-bold">${fmtPrice(price)}</span>
        <span className="text-[9px] font-mono text-emerald-400 font-bold">TP2</span>
      </div>
      {/* Bar */}
      <div className="relative h-1.5 bg-[#1e2d40] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${fillPct}%`,
            background: fillColor,
            boxShadow: `0 0 6px ${fillColor}88`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      {/* Markers below */}
      <div className="relative h-3 mt-0.5" style={{ fontSize: 7, fontFamily: 'monospace' }}>
        <div className="absolute" style={{ left: `${entryPct}%`, transform: 'translateX(-50%)' }}>
          <div style={{ width: 1, height: 4, background: '#6b7280', margin: '0 auto' }} />
          <div className="text-gray-500 text-center">E</div>
        </div>
        <div className="absolute" style={{ left: `${tp1Pct}%`, transform: 'translateX(-50%)' }}>
          <div style={{ width: 1, height: 4, background: '#10b981', margin: '0 auto' }} />
          <div className="text-emerald-600 text-center">TP1</div>
        </div>
        <div className="absolute right-0" style={{ transform: 'translateX(50%)' }}>
          <div style={{ width: 1, height: 4, background: '#10b981', margin: '0 auto' }} />
          <div className="text-emerald-600 text-center">TP2</div>
        </div>
      </div>
    </div>
  );
}

// ── Pin helpers ────────────────────────────────────────────────────────────────
const PINNED_KEY = 'qc_pinned_symbols';

export function getPinned() {
  try {
    return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]');
  } catch { return []; }
}

export function togglePinned(symbol) {
  const pinned = getPinned();
  const idx = pinned.indexOf(symbol);
  if (idx >= 0) pinned.splice(idx, 1);
  else pinned.push(symbol);
  localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
  return [...pinned];
}

export function cleanPinned(activeSymbols) {
  const pinned = getPinned().filter(s => activeSymbols.includes(s));
  localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
  return pinned;
}

// ── Main SignalCard ───────────────────────────────────────────────────────────
export default function SignalCard({ signal, livePrice, liveChange, isPinned, onTogglePin }) {
  const user = useAuthStore((state) => state.user);
  const isMaster = user?.role === 'master';
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  // Entry window in minutes — matches server setting default
  const entryWindowMinutes = 30;

  const price = livePrice ?? signal.entry;
  const change = liveChange ?? signal.priceChange ?? 0;
  const borderClass = isPinned
    ? 'border-l-4 border-l-[#f0b429]'
    : REGIME_BORDER[signal.regime] ?? 'border-l-4 border-l-gray-700';

  const isLong = signal.direction === 'LONG';
  const tp1Dist = isLong
    ? ((signal.tp1 - signal.entry) / signal.entry) * 100
    : ((signal.entry - signal.tp1) / signal.entry) * 100;
  const tp2Dist = isLong
    ? ((signal.tp2 - signal.entry) / signal.entry) * 100
    : ((signal.entry - signal.tp2) / signal.entry) * 100;
  const slDist = isLong
    ? ((signal.entry - signal.stopLoss) / signal.entry) * 100
    : ((signal.stopLoss - signal.entry) / signal.entry) * 100;

  let rr = signal.riskReward;
  if (!rr || isNaN(rr)) {
    const risk = Math.abs(signal.entry - signal.stopLoss);
    rr = risk === 0 ? 0 : parseFloat((Math.abs(signal.tp2 - signal.entry) / risk).toFixed(2));
  }

  const confidenceColors = {
    VERY_HIGH: 'bg-emerald-900 text-emerald-300',
    HIGH: 'bg-blue-900 text-blue-300',
    MEDIUM: 'bg-yellow-900 text-yellow-300',
    LOW: 'bg-gray-800 text-gray-400',
  };

  const last20Closes = signal.sparkline || [];

  const handleTelegramSend = async (e) => {
    e.stopPropagation();
    if (isSending || sendSuccess) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/telegram/send-signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        },
        body: JSON.stringify({ signal })
      });
      if (res.ok) {
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 3000);
      } else {
        const err = await res.json();
        console.error('Failed to send:', err.error);
        alert(`Failed to send: ${err.error || err.message}`);
      }
    } catch (err) {
      console.error('Error sending to Telegram:', err);
      alert(`Network error: ${err.message}. Is the backend running?`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`relative rounded-xl bg-[#0f1923] border border-[#1e2d40] ${borderClass} p-3 sm:p-4 transition-all duration-200 hover:border-[#2e4a6a] hover:shadow-lg hover:shadow-black/40 animate-fadeSlide`}>
      {/* Pin star */}
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePin?.(signal.symbol); }}
        className="absolute top-2.5 right-2.5 z-10 transition-colors"
        title={isPinned ? 'Unpin from watchlist' : 'Pin to watchlist'}
      >
        <Star size={14} className={isPinned ? 'fill-[#f0b429] text-[#f0b429]' : 'text-gray-600 hover:text-gray-400'} />
      </button>

      {/* Top Row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-tight">{signal.symbol.replace('USDT','')}/USDT</span>
            <span className="text-xs text-gray-500">15m • Perp</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${signal.direction === 'LONG' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>
              {signal.direction === 'LONG' ? '▲ LONG' : '▼ SHORT'}
            </span>
            <AgePill createdAt={signal.createdAt} />
          </div>
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

      {/* Entry Countdown Bar — visible until entry window closes */}
      <EntryCountdownBar
        createdAt={signal.createdAt}
        tp1Hit={signal.tp1Hit}
        entryWindowMinutes={entryWindowMinutes}
      />

      {/* Confidence & Action */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${confidenceColors[signal.confidence] || 'bg-gray-800 text-gray-400'}`}>
            {signal.confidence?.replace('_', ' ')}
          </span>
          {signal.htfBias && signal.htfBias !== 'NEUTRAL' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${signal.htfBias === 'LONG' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/45' : 'bg-red-950 text-red-400 border border-red-800/45'}`}>
              4H {signal.htfBias}
            </span>
          )}
          {signal.historicalWinRate != null && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800/45">
              {signal.historicalWinRate}% hist ({signal.historicalSampleSize} trades)
            </span>
          )}
          {signal.tp1Hit === 1 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3d2f00] text-[#ffd700] border border-[#b8860b]/45 animate-pulse">
              TP1 ✓ (SL @ Breakeven)
            </span>
          )}
        </div>
        <button
          onClick={isMaster ? handleTelegramSend : undefined}
          disabled={isSending || sendSuccess || !isMaster}
          title={isMaster ? 'Send to Telegram' : 'Only master can send signals'}
          className={`transition-colors ${
            isMaster
              ? 'text-gray-400 hover:text-[#0088cc] disabled:opacity-50 cursor-pointer'
              : 'text-gray-600 cursor-not-allowed opacity-40'
          }`}
        >
          {sendSuccess ? <CheckCircle size={18} className="text-emerald-500" /> : <Send size={18} />}
        </button>
      </div>

      {/* Trade Levels */}
      <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-1 text-xs font-mono">
        <div className="text-gray-400">Entry</div>
        <div className="text-white">${fmtPrice(signal.entry)}</div>
        <div className="text-red-400">Stop Loss</div>
        <div className="text-red-300">
          ${fmtPrice(signal.stopLoss)}
          <span className="text-[10px] text-red-500/80 ml-1">-{slDist.toFixed(2)}%</span>
        </div>
        <div className="text-emerald-400">TP1</div>
        <div className="text-emerald-300">
          ${fmtPrice(signal.tp1)}
          <span className="text-[10px] text-emerald-500/80 ml-1">+{tp1Dist.toFixed(2)}%</span>
        </div>
        <div className="text-emerald-400">TP2</div>
        <div className="text-emerald-300">
          ${fmtPrice(signal.tp2)}
          <span className="text-[10px] text-emerald-500/80 ml-1">+{tp2Dist.toFixed(2)}%</span>
        </div>
      </div>

      {/* Price Progress Bar */}
      <PriceProgressBar signal={signal} livePrice={livePrice} />

      {/* R:R */}
      <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 text-xs font-mono">
        <div className="text-gray-400">R:R</div>
        <div className="text-white">{rr}x</div>
      </div>
    </div>
  );
}
