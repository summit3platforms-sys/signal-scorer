import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CandlestickChart, Activity, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [referral, setReferral] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [uniqueId, setUniqueId] = useState('');

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, referral: referral.trim() || null })
      });
      if (res.ok) {
        const data = await res.json();
        setUniqueId(data.uniqueId || '');
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const tickerData = [
    { pair: "BTC/USDT", direction: "LONG", score: 87, detail: "TP1 +2.4%" },
    { pair: "ETH/USDT", direction: "SHORT", score: 79, detail: "TP2 hit" },
    { pair: "SOL/USDT", direction: "LONG", score: 91, detail: "TP1 ✓ Breakeven" },
    { pair: "BNB/USDT", direction: "SHORT", score: 74, detail: "" },
    { pair: "AVAX/USDT", direction: "LONG", score: 83, detail: "TP1 +3.1%" }
  ];

  // Repeat the ticker data for an infinite seamless scroll
  const repeatedTicker = [...tickerData, ...tickerData, ...tickerData, ...tickerData, ...tickerData];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050d18] text-white font-sans selection:bg-[#00d4aa]/30 selection:text-white">
      {/* ── STYLE INJECTION FOR PREMIUM ANIMATIONS ─────────────────────── */}
      <style>{`
        @keyframes orb-pulse-1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.35; }
          50% { transform: translate(80px, -60px) scale(1.15); opacity: 0.55; }
        }
        @keyframes orb-pulse-2 {
          0%, 100% { transform: translate(0px, 0px) scale(1.05); opacity: 0.3; }
          50% { transform: translate(-90px, 70px) scale(0.9); opacity: 0.55; }
        }
        @keyframes orb-pulse-3 {
          0%, 100% { transform: translate(0px, 0px) scale(0.95); opacity: 0.4; }
          50% { transform: translate(60px, 50px) scale(1.1); opacity: 0.3; }
        }
        .animate-orb-1 {
          animation: orb-pulse-1 20s infinite ease-in-out;
        }
        .animate-orb-2 {
          animation: orb-pulse-2 25s infinite ease-in-out;
        }
        .animate-orb-3 {
          animation: orb-pulse-3 22s infinite ease-in-out;
        }
        .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-panel:hover {
          border-color: rgba(0, 212, 170, 0.25);
          box-shadow: 0 0 40px rgba(0, 212, 170, 0.04);
          background: rgba(255, 255, 255, 0.04);
        }
        .text-glow-teal {
          text-shadow: 0 0 20px rgba(0, 212, 170, 0.2);
        }
        .glow-button {
          box-shadow: 0 0 25px rgba(0, 212, 170, 0.25);
          transition: all 0.3s ease-out;
        }
        .glow-button:hover:not(:disabled) {
          box-shadow: 0 0 35px rgba(0, 212, 170, 0.45);
          transform: translateY(-1px);
        }
      `}</style>

      {/* ── 1. ANIMATED BACKGROUND ORBS ────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-Left Orb (Teal) */}
        <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] md:w-[750px] md:h-[750px] rounded-full bg-radial-gradient from-[#00d4aa]/20 to-transparent blur-[110px] md:blur-[140px] animate-orb-1" 
             style={{ background: 'radial-gradient(circle, rgba(0,212,170,0.22) 0%, rgba(5,13,24,0) 70%)' }} />
        
        {/* Center-Right Orb (Gold) */}
        <div className="absolute top-[25%] right-[-15%] w-[400px] h-[400px] md:w-[700px] md:h-[700px] rounded-full bg-radial-gradient from-[#f0b429]/12 to-transparent blur-[110px] md:blur-[140px] animate-orb-2" 
             style={{ background: 'radial-gradient(circle, rgba(240,180,41,0.14) 0%, rgba(5,13,24,0) 70%)' }} />
        
        {/* Bottom-Left Orb (Purple) */}
        <div className="absolute bottom-[-10%] left-[-15%] w-[450px] h-[450px] md:w-[750px] md:h-[750px] rounded-full bg-radial-gradient from-[#8b5cf6]/14 to-transparent blur-[110px] md:blur-[140px] animate-orb-3" 
             style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(5,13,24,0) 70%)' }} />
      </div>

      {/* ── 2. STICKY NAVIGATION BAR ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#050d18]/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <CandlestickChart className="h-6 w-6 text-[#00d4aa]" />
            <span className="font-bold text-lg tracking-tight text-white">
              Quantum Candle <span className="text-[#00d4aa]">AI</span>
            </span>
          </div>

          {/* Right: Login & CTA Buttons */}
          <div className="flex items-center gap-4">
            <Link 
              to="/login"
              className="text-gray-300 hover:text-[#00d4aa] font-semibold text-sm transition-all"
            >
              Login
            </Link>
            <button 
              onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-5 py-2.5 rounded-full border border-[#00d4aa] text-[#00d4aa] font-medium text-sm transition-all hover:bg-[#00d4aa]/10 hover:text-white"
            >
              Request Access
            </button>
          </div>
        </div>
      </header>

      {/* ── 3. HERO SECTION ───────────────────────────────────────────── */}
      <section className="relative z-10 min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 py-12 max-w-5xl mx-auto text-center">
        {/* Pulse Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold tracking-wider text-[#00d4aa] uppercase mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Invite Only · Private Beta
        </div>

        {/* H1 Title */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] max-w-4xl">
          Quantum Candle <span className="bg-gradient-to-r from-[#00d4aa] via-teal-300 to-[#f0b429] bg-clip-text text-transparent text-glow-teal">AI</span>
        </h1>

        {/* Tagline */}
        <p className="text-xl md:text-2xl font-semibold tracking-wide text-gray-300 mb-6">
          Next-Generation Crypto Signal Engine
        </p>

        {/* Subtext */}
        <p className="text-base md:text-lg text-gray-400 max-w-3xl leading-relaxed mb-10">
          Institutional-grade signal scoring across 150+ Binance Futures pairs.<br className="hidden md:inline" />
          Real-time ATR-based targets, multi-timeframe confluence, and AI validation — in one dashboard.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16 w-full justify-center">
          <button
            onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#00d4aa] text-[#050d18] font-bold text-base glow-button"
          >
            Request Early Access
          </button>
          
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/10 bg-white/5 text-white font-semibold text-base hover:bg-white/10 hover:border-white/20 transition-all"
          >
            See How It Works
          </button>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-sm text-gray-400 font-medium">
          <span className="flex items-center gap-1.5">
            <span>🔒</span> Invite Only
          </span>
          <span className="text-gray-700 hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5">
            <span>⚡</span> Real-Time Signals
          </span>
          <span className="text-gray-700 hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5">
            <span>🤖</span> AI Validated
          </span>
        </div>
      </section>

      {/* ── 4. LIVE STATS TICKER BAR ──────────────────────────────────── */}
      <section className="relative z-10 w-full overflow-hidden bg-[#030810] border-y border-white/5 py-4">
        {/* Edge masks for depth */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#050d18] to-transparent z-20 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#050d18] to-transparent z-20 pointer-events-none" />

        <div className="flex animate-ticker whitespace-nowrap gap-8" style={{ width: 'max-content' }}>
          {repeatedTicker.map((item, index) => (
            <div key={index} className="inline-flex items-center gap-3 font-mono text-sm tracking-wide">
              {/* Pair Name */}
              <span className="text-white font-bold">{item.pair}</span>
              
              {/* Direction Tag */}
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                item.direction === 'LONG' ? 'bg-[#00d4aa]/10 text-[#00d4aa]' : 'bg-red-500/10 text-red-400'
              }`}>
                {item.direction}
              </span>
              
              {/* Score */}
              <span className="text-gray-400">
                Score <span className="text-white font-semibold">{item.score}</span>
              </span>

              {/* TP Detail */}
              {item.detail && (
                <span className={item.direction === 'LONG' ? 'text-[#00d4aa] font-medium' : 'text-red-400 font-medium'}>
                  {item.detail}
                </span>
              )}

              {/* Separator */}
              <span className="text-gray-700 ml-2">·</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. FEATURES SECTION (HOW IT WORKS) ────────────────────────── */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32 scroll-mt-20">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Designed for Elite Alpha
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-base md:text-lg">
            A look under the hood of the multi-layered analysis driving our real-time crypto signal engine.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 md:mb-20">
          {/* Card 1: AI Signal Engine */}
          <div className="glass-panel rounded-2xl p-8 flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-xl bg-[#00d4aa]/10 border border-[#00d4aa]/20 flex items-center justify-center mb-6 text-xl">
                🧠
              </div>
              <h3 className="text-xl font-bold text-white mb-4">
                AI Signal Engine
              </h3>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                Scores every Binance Futures pair across 5 weighted factors: trend, momentum, volume, structure, and pattern recognition. Decorrelation-adjusted to eliminate noise.
              </p>
            </div>
            <div className="mt-8 flex items-center text-xs font-semibold tracking-wider text-[#00d4aa] gap-1.5 uppercase">
              Factor Weighted Scoring <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 2: Real-Time Tracking */}
          <div className="glass-panel rounded-2xl p-8 flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-xl bg-[#f0b429]/10 border border-[#f0b429]/20 flex items-center justify-center mb-6 text-xl">
                ⚡
              </div>
              <h3 className="text-xl font-bold text-white mb-4">
                Real-Time Tracking
              </h3>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                Zero-latency WebSocket price stream evaluates every active signal tick-by-tick. TP1 moves your stop to breakeven automatically.
              </p>
            </div>
            <div className="mt-8 flex items-center text-xs font-semibold tracking-wider text-[#f0b429] gap-1.5 uppercase">
              Zero Latency WebSocket <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 3: Multi-Timeframe Confluence */}
          <div className="glass-panel rounded-2xl p-8 flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 text-xl">
                📊
              </div>
              <h3 className="text-xl font-bold text-white mb-4">
                Multi-Timeframe Confluence
              </h3>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                Signals only fire when 15m, 1h, and 4h timeframes agree. Counter-trend noise eliminated at the source.
              </p>
            </div>
            <div className="mt-8 flex items-center text-xs font-semibold tracking-wider text-purple-400 gap-1.5 uppercase">
              Confluence Filtration <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Small Stat Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="px-6 py-5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Active Scanner Range</span>
            <span className="text-white font-mono font-bold text-sm tracking-wide bg-[#00d4aa]/10 text-[#00d4aa] px-2.5 py-1 rounded">
              150+ pairs scanned
            </span>
          </div>

          <div className="px-6 py-5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Execution Precision</span>
            <span className="text-white font-mono font-bold text-sm tracking-wide bg-[#f0b429]/10 text-[#f0b429] px-2.5 py-1 rounded">
              &lt; 1s price latency
            </span>
          </div>

          <div className="px-6 py-5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Data Scanning Cycle</span>
            <span className="text-white font-mono font-bold text-sm tracking-wide bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded">
              5 min scan cycle
            </span>
          </div>
        </div>
      </section>

      {/* ── 6. WAITLIST / EARLY ACCESS SECTION ────────────────────────── */}
      <section id="waitlist" className="relative z-10 max-w-4xl mx-auto px-6 py-24 md:py-32 scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
            Get Early Access
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            We're onboarding traders by invite only. Drop your email and referral code — we'll reach out when your spot is ready.
          </p>
        </div>

        {/* Waitlist Form Card */}
        <div className="glass-panel rounded-3xl p-8 md:p-12 max-w-xl mx-auto shadow-2xl relative overflow-hidden">
          {/* Inner ambient card glow */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-[#00d4aa]/5 blur-2xl pointer-events-none" />

          {/* Form states */}
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={status === 'loading' || status === 'success'}
                className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white font-medium placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/30 transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                placeholder="Referral code (optional)"
                disabled={status === 'loading' || status === 'success'}
                className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white font-medium placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/30 transition-all disabled:opacity-50"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={handleSubmit}
              disabled={status === 'loading' || status === 'success' || !email || !email.includes('@')}
              className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                status === 'success'
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 cursor-default'
                  : status === 'error'
                  ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                  : 'bg-[#00d4aa] text-[#050d18] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {status === 'idle' && (
                <>Request Access</>
              )}
              {status === 'loading' && (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#050d18]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              )}
              {status === 'success' && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ✓ You're on the list!
                </>
              )}
              {status === 'error' && (
                <>
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  Something went wrong — try again
                </>
              )}
            </button>

            {status === 'success' && uniqueId && (
              <div className="mt-6 p-6 rounded-2xl bg-[#f0b429]/10 border border-[#f0b429]/30 text-center space-y-4">
                <div className="text-sm font-semibold text-[#f0b429] uppercase tracking-wider">
                  Your Private Access ID
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-bold tracking-widest text-white bg-black/50 px-4 py-2 rounded-lg border border-white/10 select-all">
                    {uniqueId}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(uniqueId);
                      alert('Access ID copied to clipboard!');
                    }}
                    className="px-3 py-2 rounded-lg bg-[#f0b429] text-black font-semibold text-xs transition-all hover:bg-yellow-400"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                  ⚠️ <strong className="text-white">Save this code!</strong> You will need this Access ID along with your email to log into the system once your request is approved by the admin.
                </p>
              </div>
            )}

            {/* Note text below button */}
            <div className="flex items-center gap-2 justify-center text-xs text-gray-500 pt-2 font-medium">
              <Lock className="h-3.5 w-3.5 text-gray-600" />
              <span>No spam. Ever. We'll only email you when your access is ready.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FOOTER ─────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-10 bg-[#030810]/50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo element repeated small */}
          <div className="flex items-center gap-2 text-gray-500 hover:text-white transition-all cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <CandlestickChart className="h-5 w-5" />
            <span className="font-bold text-sm tracking-tight">
              Quantum Candle AI
            </span>
          </div>

          {/* Copyright Beta Disclaimer */}
          <div className="text-xs text-gray-500 md:text-right font-medium">
            © 2026 Quantum Candle AI · Invite Only Beta
          </div>
        </div>
      </footer>
    </div>
  );
}
