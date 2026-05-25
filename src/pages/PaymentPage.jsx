import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Copy, 
  Check, 
  LogOut, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  CandlestickChart 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

export default function PaymentPage() {
  const { user, login, logout } = useAuthStore();
  const [settings, setSettings] = useState({ subscriptionPrice: 29, subscriptionDays: 30, tronAddress: '' });
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(user?.status === 'payment_pending');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setSettings({
          subscriptionPrice: data.subscriptionPrice ?? 29,
          subscriptionDays: data.subscriptionDays ?? 30,
          tronAddress: data.tronAddress ?? ''
        });
      })
      .catch(() => {});
  }, []);

  const handleCopy = () => {
    if (!settings.tronAddress) return;
    navigator.clipboard.writeText(settings.tronAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyRef = () => {
    if (!user?.uniqueId) return;
    navigator.clipboard.writeText(user.uniqueId).then(() => {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    });
  };

  const handlePaymentSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/waitlist/${user.uniqueId}/payment-submitted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to submit payment');
      }
      login({ ...user, status: 'payment_pending' });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050d18] text-white flex flex-col justify-between">
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Column — Value Proposition Panel */}
        <div className="w-full lg:w-5/12 bg-gradient-to-br from-[#061822] via-[#050d18] to-[#04201e] p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/5 relative overflow-hidden">
          {/* Subtle gradient glow */}
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#00d4aa]/5 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 space-y-10">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <CandlestickChart className="h-7 w-7 text-[#00d4aa]" />
              <span className="font-extrabold text-xl tracking-tight text-white">
                Quantum Candle <span className="text-[#00d4aa]">AI</span>
              </span>
            </div>

            {/* Heading & Subtext */}
            <div className="space-y-4">
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight">
                You're one step away from <span className="text-[#00d4aa]">institutional-grade</span> signals.
              </h1>
              <p className="text-gray-400 text-sm lg:text-base leading-relaxed">
                Complete your payment to unlock full access to the Quantum Candle AI dashboard — built for serious crypto traders who demand precision, speed, and an edge the market can't see.
              </p>
            </div>

            {/* What you get */}
            <div className="space-y-6">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">What you get</h2>
              
              <div className="space-y-5">
                {[
                  {
                    title: "Real-Time Signal Engine",
                    desc: "150+ Binance Futures pairs scanned every 5 minutes using 6-factor AI scoring"
                  },
                  {
                    title: "Multi-Timeframe Confluence",
                    desc: "Signals only fire when 15m, 1h and 4h timeframes agree — noise eliminated at the source"
                  },
                  {
                    title: "ATR-Based Dynamic Targets",
                    desc: "Stop loss, TP1 and TP2 calculated from live market volatility — not guesswork"
                  },
                  {
                    title: "Funding Rate Intelligence",
                    desc: "Signals boosted or filtered based on Binance perpetual funding rates for free carry edge"
                  },
                  {
                    title: "Live WebSocket Price Feed",
                    desc: "Sub-second price tracking with automatic breakeven stop-loss when TP1 is hit"
                  },
                  {
                    title: "Trade History & Win Rate",
                    desc: "Every signal tracked to resolution with TP1 touch rate, TP2 hit rate and R expectancy"
                  }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3.5">
                    <div className="h-5 w-5 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-[#00d4aa]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-none mb-1">{item.title}</h3>
                      <p className="text-xs text-gray-400 leading-normal">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="relative z-10 pt-8 mt-8 border-t border-white/5 flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-400">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5">
              <span>🔒</span> Invite Only
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5">
              <span>⚡</span> Real-Time Data
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5">
              <span>📊</span> Institutional Grade
            </div>
          </div>
        </div>

        {/* Right Column — Payment Card */}
        <div className="w-full lg:w-7/12 p-8 lg:p-12 flex flex-col bg-[#050d18] justify-center relative">
          {/* Top LogOut Bar */}
          <div className="w-full max-w-xl mx-auto flex items-center justify-between pb-6 mb-6 border-b border-white/5">
            <span className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#00d4aa] animate-pulse" />
              Secure Payment Gateway
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-3.5 py-2 rounded-xl transition-all bg-white/[0.01]"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>

          <div className="max-w-xl mx-auto w-full space-y-6">
            {/* Summary Box */}
            <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-5 backdrop-blur-xl">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">AMOUNT DUE</div>
                <div className="text-2xl font-extrabold text-[#00d4aa]">{settings.subscriptionPrice} USDT</div>
                <div className="text-[9px] font-bold text-amber-500/90 uppercase tracking-wide">TRC-20 (TRON) Network Only</div>
              </div>
              <div className="space-y-1 border-l border-white/5 pl-5">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ACCESS PERIOD</div>
                <div className="text-2xl font-extrabold text-white">{settings.subscriptionDays} Days</div>
                <div className="text-[9px] text-gray-500 leading-none">Starting from payment confirmation</div>
              </div>
            </div>

            {/* REFERENCE ID */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">YOUR REFERENCE ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono font-extrabold text-[#00d4aa] bg-[#00d4aa]/5 border border-[#00d4aa]/20 rounded-xl px-4 py-3 tracking-widest flex items-center justify-between">
                  {user?.uniqueId}
                </code>
                <button
                  onClick={handleCopyRef}
                  className="shrink-0 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-white/20 text-gray-300 hover:text-[#00d4aa] transition-all flex items-center justify-center min-w-[50px] relative"
                  title="Copy Reference ID"
                >
                  {copiedRef ? <Check className="h-4 w-4 text-[#00d4aa]" /> : <Copy className="h-4 w-4" />}
                  {copiedRef && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] bg-black text-[#00d4aa] px-2 py-0.5 rounded border border-[#00d4aa]/30 whitespace-nowrap">
                      ✓ Copied!
                    </span>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                Include this ID in the transfer memo so we can identify your payment instantly.
              </p>
            </div>

            {/* QR CODE */}
            <div className="flex flex-col items-center gap-3 bg-white/[0.01] border border-white/5 rounded-2xl p-6 relative">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Scan to pay</span>
              {settings.tronAddress ? (
                <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/20">
                  <QRCodeSVG
                    value={settings.tronAddress}
                    size={160}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              ) : (
                <div className="h-40 w-40 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                  <p className="text-xs text-gray-500 leading-normal">
                    Wallet address will appear here — contact support if missing.
                  </p>
                </div>
              )}
            </div>

            {/* WALLET ADDRESS */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">TRC-20 Wallet Address</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-gray-300 bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 break-all select-all">
                  {settings.tronAddress || 'Not configured'}
                </code>
                <button
                  onClick={handleCopy}
                  disabled={!settings.tronAddress}
                  className="shrink-0 p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-white/20 text-gray-300 hover:text-[#00d4aa] transition-all disabled:opacity-40 disabled:pointer-events-none relative"
                  title="Copy address"
                >
                  {copied ? <Check className="h-4 w-4 text-[#00d4aa]" /> : <Copy className="h-4 w-4" />}
                  {copied && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] bg-black text-[#00d4aa] px-2 py-0.5 rounded border border-[#00d4aa]/30 whitespace-nowrap">
                      ✓ Copied!
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* WARNING */}
            <div className="flex gap-3.5 bg-amber-500/5 border-2 border-amber-500/30 rounded-2xl p-4">
              <AlertTriangle className="h-5 w-5 text-[#f0b429] shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90 leading-relaxed">
                <strong>Only send USDT on the TRC-20 (TRON) network.</strong> Sending on any other network (ERC-20, BEP-20, etc.) will result in <strong>permanent loss of funds</strong> with no possibility of recovery.
              </p>
            </div>

            {/* HOW TO PAY */}
            <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">How to pay</h3>
              <div className="space-y-3.5 text-xs text-gray-400">
                <div className="flex gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <p className="mt-0.5">Copy the TRC-20 wallet address above</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <p className="mt-0.5">Send exactly <strong className="text-white">{settings.subscriptionPrice} USDT</strong> on the TRON network — include your ID (<strong className="font-mono text-[#00d4aa]">{user?.uniqueId}</strong>) in the memo</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <p className="mt-0.5">Click the button below — your master will confirm within 24 hours and activate your access</p>
                </div>
              </div>
            </div>

            {/* CTA or waiting state */}
            {submitted ? (
              <div className="flex items-start gap-3.5 bg-[#00d4aa]/5 border-2 border-[#00d4aa]/25 rounded-2xl p-5">
                <CheckCircle2 className="h-6 w-6 text-[#00d4aa] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#00d4aa]">Payment Submitted</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    We've received your notification and are verifying your transfer on-chain. You'll receive access as soon as it's confirmed — typically within a few hours.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}
                <button
                  onClick={handlePaymentSubmit}
                  disabled={submitting || !settings.tronAddress}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#00d4aa] hover:opacity-90 text-[#050d18] font-extrabold text-sm transition-all shadow-xl shadow-[#00d4aa]/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><Clock className="h-4 w-4 animate-spin" /> Submitting...</>
                  ) : (
                    'I Have Paid — Notify Master'
                  )}
                </button>
                <p className="text-[10px] text-gray-500 text-center leading-normal">
                  Only click after you have completed the USDT transfer above.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thin trust footer strip */}
      <footer className="w-full py-4 px-6 border-t border-white/5 bg-[#03080e] text-center text-gray-500 text-[10px] lg:text-xs">
        🔐 Your payment is verified manually by our team · No automatic charges · Cancel anytime by not renewing · Support: contact your referrer or master admin
      </footer>
    </div>
  );
}
