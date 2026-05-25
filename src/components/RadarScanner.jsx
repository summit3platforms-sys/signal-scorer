import { useEffect, useRef, useState, useCallback } from 'react';

const PAIRS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','PEPEUSDT','XRPUSDT','DOGEUSDT','AVAXUSDT',
  'BNBUSDT','ADAUSDT','DOTUSDT','LINKUSDT','MATICUSDT','UNIUSDT','LTCUSDT',
  'TRXUSDT','SHIBUSDT','NEARUSDT','APTUSDT','OPUSDT','ARBUSDT','INJUSDT',
  'SUIUSDT','TIAUSDT','SEIUSDT','ORDIUSDT','WIFUSDT','BONKUSDT','JUPUSDT',
  'ENAUSDT','FETUSDT','RENDERUSDT','WLDUSDT','STXUSDT','RUNEUSDT','AAVEUSDT',
];

const STATUSES = [
  { label: 'SIGNAL',    color: '#00ff88' },
  { label: 'MOMENTUM',  color: '#f0b429' },
  { label: 'WATCHLIST', color: '#22d3ee' },
  { label: 'BREAKOUT',  color: '#a78bfa' },
  { label: 'SCANNING',  color: '#4b5563' },
  { label: 'CONFLUENCE',color: '#00ff88' },
  { label: 'VOL SURGE', color: '#f0b429' },
  { label: 'ALIGNED',   color: '#22d3ee' },
];

const METRICS = [
  { label: 'AI Confidence',   min: 68, max: 97, unit: '%',  color: '#00ff88' },
  { label: 'Market Pressure', min: 42, max: 88, unit: '%',  color: '#f0b429' },
  { label: 'Whale Activity',  min: 3,  max: 9,  unit: 'x',  color: '#a78bfa' },
  { label: 'Signal Strength', min: 70, max: 99, unit: 'pt', color: '#00ff88' },
  { label: 'Trend Velocity',  min: 1,  max: 8,  unit: '\u03c3',  color: '#22d3ee' },
  { label: 'Volatility Scan', min: 22, max: 74, unit: '%',  color: '#f0b429' },
  { label: 'Liquidity Shift', min: -6, max: 12, unit: 'M',  color: '#22d3ee' },
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

// ── Mini Radar Canvas ──────────────────────────────────────────────────────
function RadarCanvas({ size = 180 }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const angleRef  = useRef(0);
  const blobsRef  = useRef([]);

  const generateBlip = useCallback(() => ({
    a: Math.random() * Math.PI * 2,
    r: rand(0.15, 0.82),
    alpha: 0,
    maxAlpha: rand(0.5, 1),
    life: 0,
    maxLife: randInt(100, 260),
    growing: true,
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    blobsRef.current = Array.from({ length: 6 }, generateBlip);

    const draw = () => {
      const cx = size / 2, cy = size / 2, R = size * 0.44;
      ctx.clearRect(0, 0, size, size);

      // BG circle
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,6,14,0.96)'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,255,136,0.2)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();

      // Cross grid
      ctx.save();
      ctx.strokeStyle = 'rgba(0,255,136,0.07)'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 5]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore();

      // Rings
      [0.28, 0.56, 0.82, 1].forEach((frac, idx) => {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * frac, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,255,136,${0.05 + idx * 0.03})`; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
      });

      // Sweep
      const sweep = angleRef.current;
      const SWEEP = Math.PI * 0.38;
      const g = ctx.createLinearGradient(
        cx + Math.cos(sweep) * R * 0.5, cy + Math.sin(sweep) * R * 0.5, cx, cy
      );
      g.addColorStop(0, 'rgba(0,255,136,0)');
      g.addColorStop(1, 'rgba(0,255,136,0.22)');
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, sweep - SWEEP, sweep, false);
      ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
      ctx.strokeStyle = 'rgba(0,255,136,0.9)'; ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 12; ctx.stroke();
      ctx.shadowBlur = 0; ctx.restore();

      // Blips
      blobsRef.current.forEach(b => {
        if (b.growing) {
          b.alpha = Math.min(b.maxAlpha, b.alpha + 0.06);
          if (b.alpha >= b.maxAlpha) b.growing = false;
        } else {
          b.life++;
          if (b.life > b.maxLife) b.alpha = Math.max(0, b.alpha - 0.03);
        }
        const bx = cx + Math.cos(b.a) * b.r * R;
        const by = cy + Math.sin(b.a) * b.r * R;
        ctx.save(); ctx.globalAlpha = b.alpha;
        ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88'; ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 10; ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, 5 + (b.life % 40) * 0.15, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.restore();
      });

      blobsRef.current = blobsRef.current.filter(b => b.alpha > 0.01);
      if (blobsRef.current.length < 10 && Math.random() < 0.05)
        blobsRef.current.push(generateBlip());

      // Center
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88'; ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 14; ctx.fill(); ctx.restore();

      angleRef.current = (sweep + 0.025) % (Math.PI * 2);
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [size, generateBlip]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />;
}

// ── Ticker label (small) ───────────────────────────────────────────────────
function TickerLabel({ pair, status, angle, radius, cx, cy }) {
  const x = cx + Math.cos(angle) * radius;
  const y = cy + Math.sin(angle) * radius;
  return (
    <div className="absolute pointer-events-none select-none radar-sb-ticker"
      style={{ left: x, top: y, transform: 'translate(-50%,-50%)', zIndex: 10 }}>
      <div style={{ color: status.color, fontFamily: 'monospace', fontSize: 8, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', textShadow: `0 0 6px ${status.color}88` }}>
        {pair.replace('USDT', '')}
      </div>
      <div style={{ color: status.color, fontSize: 6.5, textAlign: 'center', opacity: 0.65, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        {status.label}
      </div>
    </div>
  );
}

// ── Metric row ─────────────────────────────────────────────────────────────
function MetricRow({ label, value, unit, color, bar }) {
  return (
    <div style={{ padding: '7px 10px', background: 'rgba(0,0,0,0.35)', borderRadius: 8, border: `1px solid ${color}14`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${color}44,transparent)` }} />
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: 8.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'monospace' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'monospace', textShadow: `0 0 8px ${color}88` }}>
          {value}<span style={{ fontSize: 8, color: '#4b5563', fontWeight: 400 }}>{unit}</span>
        </span>
      </div>
      <div style={{ height: 2.5, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${bar}%`, background: `linear-gradient(90deg,${color}44,${color})`, borderRadius: 2, boxShadow: `0 0 4px ${color}88`, transition: 'width 0.9s ease' }} />
      </div>
    </div>
  );
}

// ── Main sidebar component ─────────────────────────────────────────────────
export default function RadarScanner() {
  const CONTAINER = 220;
  const ORBIT_R   = 92;
  const cx = CONTAINER / 2, cy = CONTAINER / 2;

  const [tickers,     setTickers]     = useState([]);
  const [metrics,     setMetrics]     = useState(() =>
    METRICS.map(m => ({ ...m, value: randInt(m.min, m.max), bar: randInt(30, 90) }))
  );
  const [pairsScanned, setPairsScanned] = useState(142);

  const refreshTickers = useCallback(() => {
    const count    = randInt(4, 7);
    const selected = [...PAIRS].sort(() => Math.random() - 0.5).slice(0, count);
    setTickers(selected.map((pair, i) => ({
      pair,
      angle:  (i / count) * Math.PI * 2 + rand(-0.25, 0.25),
      radius: ORBIT_R + rand(-12, 16),
      status: STATUSES[randInt(0, STATUSES.length - 1)],
      key:    `${pair}-${Date.now()}-${i}`,
    })));
  }, []);

  useEffect(() => {
    refreshTickers();
    const t = setInterval(refreshTickers, 2700);
    return () => clearInterval(t);
  }, [refreshTickers]);

  useEffect(() => {
    const t = setInterval(() =>
      setMetrics(prev => prev.map(m => ({ ...m, value: randInt(m.min, m.max), bar: randInt(30, 90) }))), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() =>
      setPairsScanned(p => { const n = p + randInt(1, 3); return n > 150 ? randInt(133, 147) : n; }), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes radar-sb-ticker-anim {
          0%   { opacity:0; transform:translate(-50%,-50%) scale(0.75); }
          18%  { opacity:1; transform:translate(-50%,-50%) scale(1.02); }
          82%  { opacity:1; transform:translate(-50%,-50%) scale(1); }
          100% { opacity:0; transform:translate(-50%,-50%) scale(0.82); }
        }
        .radar-sb-ticker { animation: radar-sb-ticker-anim 2.7s ease both; }

        @keyframes radar-sb-pulse-ring {
          0%   { transform:translate(-50%,-50%) scale(1);    opacity:0.5; }
          100% { transform:translate(-50%,-50%) scale(1.85); opacity:0; }
        }
        .radar-sb-pulse-ring {
          position:absolute; border-radius:50%; border:1px solid #00ff88;
          animation:radar-sb-pulse-ring 2.5s ease-out infinite; pointer-events:none;
        }
        @keyframes radar-sb-scanline {
          0%   { top:0%;   opacity:0.4; }
          100% { top:100%; opacity:0; }
        }
        .radar-sb-scanline {
          position:absolute; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(0,255,136,0.15),transparent);
          animation:radar-sb-scanline 4s linear infinite; pointer-events:none;
        }
        @keyframes radar-sb-blink {
          0%,100% { opacity:1; }
          50%      { opacity:0.15; }
        }
        .radar-sb-blink { animation:radar-sb-blink 1.3s ease-in-out infinite; }
        @keyframes radar-sb-particle {
          0%   { transform:translateY(0) translateX(0);   opacity:0; }
          20%  { opacity:0.55; }
          80%  { opacity:0.2; }
          100% { transform:translateY(-35px) translateX(6px); opacity:0; }
        }
        .radar-sb-particle { animation:radar-sb-particle 4s ease-in-out infinite; position:absolute; border-radius:50%; pointer-events:none; }
      `}</style>

      <div className="relative overflow-hidden" style={{
        background: 'linear-gradient(160deg,#020a12 0%,#050d18 60%,#021510 100%)',
        border: '1px solid rgba(0,255,136,0.1)',
        borderRadius: 16,
      }}>
        {/* Scanlines */}
        <div className="radar-sb-scanline" />
        <div className="radar-sb-scanline" style={{ animationDelay: '2s' }} />

        {/* Floating particles */}
        {[0,1,2,3].map(i => (
          <div key={i} className="radar-sb-particle" style={{
            width: 2.5, height: 2.5,
            background: i % 2 === 0 ? '#00ff88' : '#f0b429',
            boxShadow: `0 0 5px ${i % 2 === 0 ? '#00ff88' : '#f0b429'}`,
            left: `${15 + i * 22}%`, bottom: `${8 + (i % 3) * 10}%`,
            animationDelay: `${i * 0.9}s`,
          }} />
        ))}

        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2" style={{ borderBottom: '1px solid rgba(0,255,136,0.07)' }}>
          <div className="flex items-center gap-1.5">
            <div className="radar-sb-blink" style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: 8.5, fontWeight: 700, color: '#00ff88', letterSpacing: '0.14em' }}>SCAN RADAR</span>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#374151' }}>{pairsScanned}/150</span>
        </div>

        {/* Radar */}
        <div className="flex justify-center py-3 relative" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="relative" style={{ width: CONTAINER, height: CONTAINER }}>
            {/* Pulse rings */}
            {[0, 0.85, 1.7].map((delay, i) => (
              <div key={i} className="radar-sb-pulse-ring" style={{
                width: 130, height: 130, top: '50%', left: '50%',
                animationDelay: `${delay}s`,
              }} />
            ))}

            {/* Canvas */}
            <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
              <RadarCanvas size={CONTAINER * 0.88} />
            </div>

            {/* Orbiting tickers */}
            {tickers.map(t => (
              <TickerLabel key={t.key} pair={t.pair} status={t.status} angle={t.angle} radius={t.radius} cx={cx} cy={cy} />
            ))}

            {/* Corner brackets */}
            {[
              { top: 2, left: 2,   borderTop: '1.5px solid rgba(0,255,136,0.3)', borderLeft: '1.5px solid rgba(0,255,136,0.3)' },
              { top: 2, right: 2,  borderTop: '1.5px solid rgba(0,255,136,0.3)', borderRight: '1.5px solid rgba(0,255,136,0.3)' },
              { bottom: 2, left: 2,  borderBottom: '1.5px solid rgba(0,255,136,0.3)', borderLeft: '1.5px solid rgba(0,255,136,0.3)' },
              { bottom: 2, right: 2, borderBottom: '1.5px solid rgba(0,255,136,0.3)', borderRight: '1.5px solid rgba(0,255,136,0.3)' },
            ].map((s, i) => (
              <div key={i} className="absolute" style={{ width: 14, height: 14, ...s, borderRadius: 2 }} />
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="px-3 pb-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2 mt-1">
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(0,255,136,0.15))' }} />
            <span style={{ fontSize: 7.5, fontFamily: 'monospace', color: '#374151', letterSpacing: '0.1em' }}>AI METRICS</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(0,255,136,0.15),transparent)' }} />
          </div>
          {metrics.map(m => (
            <MetricRow key={m.label} label={m.label} value={m.value} unit={m.unit} color={m.color} bar={m.bar} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(0,255,136,0.05)', fontSize: 7.5, fontFamily: 'monospace', color: '#1f2937', textAlign: 'center', letterSpacing: '0.08em' }}>
          &#x25CF; 6-FACTOR &middot; MTF 15M/1H/4H &middot; LIVE
        </div>
      </div>
    </>
  );
}
