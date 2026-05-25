import { useEffect, useRef, useState, useCallback } from 'react';

const PAIRS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','PEPEUSDT','XRPUSDT','DOGEUSDT','AVAXUSDT',
  'BNBUSDT','ADAUSDT','DOTUSDT','LINKUSDT','MATICUSDT','UNIUSDT','LTCUSDT',
  'TRXUSDT','SHIBUSDT','NEARUSDT','APTUSDT','OPUSDT','ARBUSDT','INJUSDT',
  'SUIUSDT','TIAUSDT','SEIUSDT','ORDIUSDT','WIFUSDT','BONKUSDT','JUPUSDT',
  'ENAUSDT','FETUSDT','RENDERUSDT','WLDUSDT','STXUSDT','RUNEUSDT','AAVEUSDT',
  'MKRUSDT','SNXUSDT','CRVUSDT','GMXUSDT','DYDXUSDT','LDOUSDT','RPLAUSDT',
];

const STATUSES = [
  { label: 'SIGNAL FOUND',      color: '#00ff88' },
  { label: 'HIGH MOMENTUM',     color: '#f0b429' },
  { label: 'AI WATCHLIST',      color: '#22d3ee' },
  { label: 'BREAKOUT DETECTED', color: '#a78bfa' },
  { label: 'SCANNING\u2026',         color: '#6b7280' },
  { label: 'CONFLUENCE MET',    color: '#00ff88' },
  { label: 'VOLUME SURGE',      color: '#f0b429' },
  { label: 'TREND ALIGNED',     color: '#22d3ee' },
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

// Radar Canvas
function RadarCanvas({ size = 280 }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const angleRef  = useRef(0);
  const blobsRef  = useRef([]);

  const generateBlip = useCallback(() => {
    const a = Math.random() * Math.PI * 2;
    const r = rand(0.15, 0.82);
    return { a, r, alpha: 0, maxAlpha: rand(0.5, 1), life: 0, maxLife: randInt(120, 300), growing: true };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    blobsRef.current = Array.from({ length: 8 }, generateBlip);

    const draw = () => {
      const cx = size / 2, cy = size / 2, R = size * 0.44;
      ctx.clearRect(0, 0, size, size);

      // Background
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,8,18,0.95)'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,255,136,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();

      // Grid cross lines
      ctx.save();
      ctx.strokeStyle = 'rgba(0,255,136,0.07)'; ctx.lineWidth = 1; ctx.setLineDash([3,5]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore();

      // Concentric rings
      [0.25, 0.5, 0.75, 1].forEach((frac, idx) => {
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R * frac, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,255,136,${0.06 + idx * 0.035})`; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      });

      // Sweep pie
      const sweepAngle = angleRef.current;
      const SWEEP = Math.PI * 0.42;
      ctx.save();
      const grad = ctx.createLinearGradient(
        cx + Math.cos(sweepAngle) * R * 0.5, cy + Math.sin(sweepAngle) * R * 0.5, cx, cy
      );
      grad.addColorStop(0, 'rgba(0,255,136,0)');
      grad.addColorStop(1, 'rgba(0,255,136,0.2)');
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, sweepAngle - SWEEP, sweepAngle, false);
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      // Leading edge
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);
      ctx.strokeStyle = 'rgba(0,255,136,0.9)'; ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 14; ctx.stroke();
      ctx.shadowBlur = 0; ctx.restore();

      // Blips
      blobsRef.current.forEach(b => {
        if (b.growing) {
          b.alpha = Math.min(b.maxAlpha, b.alpha + 0.05);
          if (b.alpha >= b.maxAlpha) b.growing = false;
        } else {
          b.life++;
          if (b.life > b.maxLife) b.alpha = Math.max(0, b.alpha - 0.025);
        }
        const bx = cx + Math.cos(b.a) * b.r * R;
        const by = cy + Math.sin(b.a) * b.r * R;
        ctx.save(); ctx.globalAlpha = b.alpha;
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88'; ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 12; ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, 6 + (b.life % 40) * 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.restore();
      });

      blobsRef.current = blobsRef.current.filter(b => b.alpha > 0.01);
      if (blobsRef.current.length < 14 && Math.random() < 0.05)
        blobsRef.current.push(generateBlip());

      // Center dot
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88'; ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 18; ctx.fill(); ctx.restore();

      angleRef.current = (sweepAngle + 0.022) % (Math.PI * 2);
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [size, generateBlip]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />;
}

// Ticker label orbiting the radar
function TickerLabel({ pair, status, angle, radius, containerSize }) {
  const cx = containerSize / 2, cy = containerSize / 2;
  const x  = cx + Math.cos(angle) * radius;
  const y  = cy + Math.sin(angle) * radius;
  return (
    <div className="absolute pointer-events-none select-none ticker-radar-label"
      style={{ left: x, top: y, transform: 'translate(-50%,-50%)', zIndex: 10 }}>
      <div style={{ color: status.color, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', textShadow: `0 0 8px ${status.color}88` }}>
        {pair}
      </div>
      <div style={{ color: status.color, fontSize: 7.5, textAlign: 'center', whiteSpace: 'nowrap', opacity: 0.65, letterSpacing: '0.06em' }}>
        {status.label}
      </div>
    </div>
  );
}

// Single metric card
function MetricCard({ label, value, unit, color, bar }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.45)', border: `1px solid ${color}18`,
      borderRadius: 10, padding: '9px 13px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}55, transparent)` }} />
      <div style={{ fontSize: 8.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 5 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'monospace', textShadow: `0 0 10px ${color}88` }}>{value}</span>
        <span style={{ fontSize: 9, color: '#4b5563' }}>{unit}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${bar}%`, background: `linear-gradient(90deg, ${color}55, ${color})`, borderRadius: 2, boxShadow: `0 0 5px ${color}88`, transition: 'width 0.9s ease' }} />
      </div>
    </div>
  );
}

// Main export
export default function RadarScanner() {
  const CONTAINER = 300;
  const ORBIT_R   = 128;

  const [tickers,     setTickers]     = useState([]);
  const [metrics,     setMetrics]     = useState(() => METRICS.map(m => ({ ...m, value: randInt(m.min, m.max), bar: randInt(30, 90) })));
  const [pairsScanned,setPairsScanned]= useState(142);

  const refreshTickers = useCallback(() => {
    const count    = randInt(5, 9);
    const selected = [...PAIRS].sort(() => Math.random() - 0.5).slice(0, count);
    setTickers(selected.map((pair, i) => {
      const angle  = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
      const radius = ORBIT_R + rand(-15, 20);
      const status = STATUSES[randInt(0, STATUSES.length - 1)];
      return { pair, angle, radius, status, key: `${pair}-${Date.now()}-${i}` };
    }));
  }, []);

  useEffect(() => { refreshTickers(); const t = setInterval(refreshTickers, 2600); return () => clearInterval(t); }, [refreshTickers]);
  useEffect(() => {
    const t = setInterval(() => setMetrics(prev => prev.map(m => ({ ...m, value: randInt(m.min, m.max), bar: randInt(30, 90) }))), 1900);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setPairsScanned(p => { const n = p + randInt(1, 4); return n > 150 ? randInt(132, 148) : n; }), 850);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes radar-ticker-anim {
          0%   { opacity:0; transform:translate(-50%,-50%) scale(0.78); }
          18%  { opacity:1; transform:translate(-50%,-50%) scale(1.04); }
          82%  { opacity:1; transform:translate(-50%,-50%) scale(1); }
          100% { opacity:0; transform:translate(-50%,-50%) scale(0.85); }
        }
        .ticker-radar-label { animation: radar-ticker-anim 2.6s ease both; }

        @keyframes radar-pulse-ring {
          0%   { transform:translate(-50%,-50%) scale(1);   opacity:0.55; }
          100% { transform:translate(-50%,-50%) scale(1.95); opacity:0; }
        }
        .radar-pulse-ring {
          position:absolute; border-radius:50%; border:1px solid #00ff88;
          animation: radar-pulse-ring 2.6s ease-out infinite; pointer-events:none;
        }
        @keyframes radar-scanline {
          0%   { top:0%;   opacity:0.5; }
          100% { top:100%; opacity:0; }
        }
        .radar-scanline {
          position:absolute; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(0,255,136,0.15),transparent);
          animation:radar-scanline 4s linear infinite; pointer-events:none;
        }
        @keyframes radar-hex-float {
          0%,100% { transform:translateY(0) rotate(0deg);   opacity:0.04; }
          50%      { transform:translateY(-12px) rotate(25deg); opacity:0.08; }
        }
        .radar-hex { animation: radar-hex-float 9s ease-in-out infinite; pointer-events:none; user-select:none; }
        @keyframes radar-particle {
          0%   { transform:translateY(0) translateX(0);   opacity:0; }
          20%  { opacity:0.6; }
          80%  { opacity:0.25; }
          100% { transform:translateY(-50px) translateX(8px); opacity:0; }
        }
        .radar-particle { animation:radar-particle 4.5s ease-in-out infinite; position:absolute; border-radius:50%; pointer-events:none; }
        @keyframes radar-corner-blink {
          0%,100% { opacity:1; }
          50%      { opacity:0.15; }
        }
        .radar-corner-blink { animation:radar-corner-blink 1.3s ease-in-out infinite; }
      `}</style>

      <div className="relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #020a12 0%, #050d18 60%, #021510 100%)',
        border: '1px solid rgba(0,255,136,0.1)',
        borderRadius: 18, padding: '20px 24px',
      }}>
        {/* Scanlines */}
        <div className="radar-scanline" />
        <div className="radar-scanline" style={{ animationDelay: '2s' }} />

        {/* Hex decorations */}
        <div className="radar-hex absolute" style={{ top: 16, left: 30, fontSize: 90, color: '#00ff88', lineHeight: 1 }}>&#x2B21;</div>
        <div className="radar-hex absolute" style={{ bottom: 12, right: 50, fontSize: 60, color: '#f0b429', lineHeight: 1, animationDelay: '3.5s' }}>&#x2B21;</div>
        <div className="radar-hex absolute" style={{ top: '45%', right: '32%', fontSize: 36, color: '#22d3ee', lineHeight: 1, animationDelay: '6s' }}>&#x2B21;</div>

        {/* Floating particles */}
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className="radar-particle" style={{
            width: 3, height: 3,
            background: i % 2 === 0 ? '#00ff88' : '#f0b429',
            boxShadow: `0 0 6px ${i % 2 === 0 ? '#00ff88' : '#f0b429'}`,
            left: `${12 + i * 15}%`, bottom: `${8 + (i % 3) * 14}%`,
            animationDelay: `${i * 0.75}s`,
          }} />
        ))}

        {/* Header */}
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="radar-corner-blink" style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 12px #00ff88' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#00ff88', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Market Scan Radar &mdash; LIVE
            </span>
          </div>
          <div className="flex gap-4" style={{ fontSize: 9.5, fontFamily: 'monospace' }}>
            <span style={{ color: '#374151' }}>BINANCE FUTURES</span>
            <span style={{ color: '#374151' }}>USDT-M PERPS</span>
            <span style={{ color: '#00ff88' }}>{pairsScanned}/150 PAIRS</span>
          </div>
        </div>

        {/* Body: radar + metrics */}
        <div className="flex flex-wrap gap-6 items-center justify-center relative z-10">

          {/* Radar container */}
          <div className="relative flex-shrink-0" style={{ width: CONTAINER, height: CONTAINER }}>
            {/* Pulse rings */}
            {[0, 0.9, 1.8].map((delay, i) => (
              <div key={i} className="radar-pulse-ring" style={{
                width: 180, height: 180,
                top: '50%', left: '50%',
                animationDelay: `${delay}s`,
              }} />
            ))}

            {/* Canvas */}
            <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
              <RadarCanvas size={CONTAINER * 0.9} />
            </div>

            {/* Orbiting ticker labels */}
            {tickers.map(t => (
              <TickerLabel
                key={t.key}
                pair={t.pair}
                status={t.status}
                angle={t.angle}
                radius={t.radius}
                containerSize={CONTAINER}
              />
            ))}

            {/* Corner brackets */}
            {[
              { top: 2, left: 2,   borderTop: '2px solid rgba(0,255,136,0.35)', borderLeft: '2px solid rgba(0,255,136,0.35)' },
              { top: 2, right: 2,  borderTop: '2px solid rgba(0,255,136,0.35)', borderRight: '2px solid rgba(0,255,136,0.35)' },
              { bottom: 2, left: 2,  borderBottom: '2px solid rgba(0,255,136,0.35)', borderLeft: '2px solid rgba(0,255,136,0.35)' },
              { bottom: 2, right: 2, borderBottom: '2px solid rgba(0,255,136,0.35)', borderRight: '2px solid rgba(0,255,136,0.35)' },
            ].map((s, i) => (
              <div key={i} className="absolute" style={{ width: 18, height: 18, ...s, borderRadius: 3 }} />
            ))}
          </div>

          {/* Metric cards */}
          <div className="flex flex-col gap-2 flex-1" style={{ minWidth: 150, maxWidth: 240 }}>
            {metrics.map(m => (
              <MetricCard key={m.label} label={m.label} value={m.value} unit={m.unit} color={m.color} bar={m.bar} />
            ))}
          </div>
        </div>

        {/* Footer strip */}
        <div className="flex flex-wrap gap-4 mt-5 pt-4 relative z-10" style={{
          borderTop: '1px solid rgba(0,255,136,0.05)',
          fontSize: 8.5, fontFamily: 'monospace', color: '#374151', letterSpacing: '0.1em',
        }}>
          <span style={{ color: '#00ff88', opacity: 0.45 }}>&#x25CF; AI ENGINE ACTIVE</span>
          <span>6-FACTOR SCORING ENGINE</span>
          <span>MTF CONFLUENCE: 15M / 1H / 4H</span>
          <span>ATR DYNAMIC TARGETS: ON</span>
          <span>FUNDING RATE INTEL: ON</span>
          <span className="ml-auto" style={{ color: '#00ff88', opacity: 0.35 }}>SIGNAL-SCORER PRO v2.0</span>
        </div>
      </div>
    </>
  );
}
