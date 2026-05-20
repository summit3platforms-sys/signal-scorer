import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { CandlestickChart, Mail, Key, ArrowRight, AlertCircle, Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleAccessIdChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/\s/g, '');
    setUniqueId(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !uniqueId) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), uniqueId: uniqueId.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      login(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050d18] text-white flex flex-col justify-center items-center px-4 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] md:w-[600px] md:h-[600px] rounded-full bg-radial-gradient from-[#00d4aa]/10 to-transparent blur-[80px] md:blur-[120px]"
             style={{ background: 'radial-gradient(circle, rgba(0,212,170,0.12) 0%, rgba(5,13,24,0) 70%)' }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] md:w-[600px] md:h-[600px] rounded-full bg-radial-gradient from-[#8b5cf6]/10 to-transparent blur-[80px] md:blur-[120px]"
             style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(5,13,24,0) 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-4 group">
            <CandlestickChart className="h-9 w-9 text-[#00d4aa] transition-transform duration-300 group-hover:scale-110" />
            <span className="font-extrabold text-2xl tracking-tight text-white">
              Quantum Candle <span className="text-[#00d4aa]">AI</span>
            </span>
          </Link>
          <h2 className="text-xl font-bold tracking-wide text-gray-200">
            Sign In to Dashboard
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Invite-only platform access control.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00d4aa]/40 via-[#f0b429]/40 to-transparent" />

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white font-medium placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/30 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Access ID
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                  <Key className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={uniqueId}
                  onChange={handleAccessIdChange}
                  placeholder="QCXXXXX"
                  required
                  disabled={loading}
                  maxLength={10}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-[#f0b429] font-mono font-bold tracking-widest placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/30 transition-all disabled:opacity-50"
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Auto-uppercased Access ID, e.g. QC25101
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-[#00d4aa] text-[#050d18] font-bold transition-all flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#050d18]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authorizing...
                </>
              ) : (
                <>
                  Enter Dashboard <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to Landing Page
          </Link>
        </div>
      </div>
    </div>
  );
}
