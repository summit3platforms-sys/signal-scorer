import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, LogOut, Clock, AlertTriangle, Wallet, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

export default function PaymentPage() {
  const { user, login, logout } = useAuthStore();
  const [settings, setSettings] = useState({ subscriptionPrice: 29, subscriptionDays: 30, tronAddress: '' });
  const [copied, setCopied] = useState(false);
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
      setTimeout(() => setCopied(false), 2500);
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
      // Update auth store with new status
      login({ ...user, status: 'payment_pending' });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080f17] text-white flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#00d4aa]/10 border border-[#00d4aa]/20 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-[#00d4aa]" />
          </div>
          <span className="font-bold text-[#00d4aa]">Quantum Candle AI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-mono">{user?.uniqueId}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-[#00d4aa]/10 border border-[#00d4aa]/20 mb-4">
              <Wallet className="h-8 w-8 text-[#00d4aa]" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Activate Your Access</h1>
            <p className="text-gray-400">Send USDT on the TRC-20 (TRON) network to unlock your subscription.</p>
          </div>

          {/* Payment card */}
          <div className="bg-[#0f1923] border border-[#1e2d40] rounded-2xl p-6 space-y-6">
            {/* Amount due */}
            <div className="flex items-center justify-between bg-[#1e2d40]/50 rounded-xl p-4 border border-[#1e2d40]">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Amount Due</p>
                <p className="text-2xl font-bold text-[#00d4aa]">{settings.subscriptionPrice} USDT</p>
                <p className="text-xs text-gray-500 mt-1">{settings.subscriptionDays} days of access</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your ID (Memo)</p>
                <p className="text-sm font-mono font-bold text-white">{user?.uniqueId}</p>
                <p className="text-xs text-gray-600 mt-1">Include in memo if possible</p>
              </div>
            </div>

            {/* QR Code */}
            {settings.tronAddress ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-2xl">
                  <QRCodeSVG
                    value={settings.tronAddress}
                    size={180}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-gray-500">Scan with your TRON wallet app</p>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center rounded-xl border border-dashed border-[#1e2d40]">
                <p className="text-sm text-gray-600">Wallet address not configured yet.</p>
              </div>
            )}

            {/* Wallet address */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">TRC-20 Wallet Address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-[#00d4aa] bg-[#1e2d40]/50 border border-[#1e2d40] rounded-lg px-3 py-2.5 break-all">
                  {settings.tronAddress || 'Not configured'}
                </code>
                <button
                  onClick={handleCopy}
                  disabled={!settings.tronAddress}
                  className="shrink-0 p-2.5 rounded-lg bg-[#1e2d40] hover:bg-[#1e2d40]/80 border border-[#1e2d40] text-gray-300 hover:text-white transition-all disabled:opacity-40"
                  title="Copy address"
                >
                  {copied ? <Check className="h-4 w-4 text-[#00d4aa]" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Warning */}
            <div className="flex gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <strong>Only send USDT on the TRC-20 (TRON) network.</strong> Sending on any other network (ERC-20, BEP-20, etc.) will result in <strong>permanent loss of funds</strong> with no possibility of recovery.
              </p>
            </div>

            {/* CTA or waiting state */}
            {submitted ? (
              <div className="flex items-center gap-3 bg-[#00d4aa]/5 border border-[#00d4aa]/20 rounded-xl p-4">
                <CheckCircle2 className="h-5 w-5 text-[#00d4aa] shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#00d4aa]">Payment submitted — awaiting confirmation</p>
                  <p className="text-xs text-gray-500 mt-0.5">The master will verify your transaction on-chain and activate your account. This usually takes a few hours.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}
                <button
                  onClick={handlePaymentSubmit}
                  disabled={submitting || !settings.tronAddress}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#00d4aa] hover:bg-[#00b894] text-black font-bold text-sm transition-all shadow-lg shadow-[#00d4aa]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><Clock className="h-4 w-4 animate-spin" /> Submitting...</>
                  ) : (
                    'I Have Paid — Notify Master'
                  )}
                </button>
                <p className="text-xs text-gray-600 text-center">
                  Only click after you have completed the USDT transfer above.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
