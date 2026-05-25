import React from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

export default function ExpiredPage() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#080f17] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-2">
          <RefreshCw className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-white">Subscription Expired</h1>
        <p className="text-gray-400 leading-relaxed">
          Your access period has ended. To continue using <span className="text-[#00d4aa] font-semibold">Quantum Candle AI</span>, please contact the master to renew your subscription.
        </p>
        <div className="bg-[#0f1923] border border-[#1e2d40] rounded-xl p-4 text-left space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Your Account</p>
          <p className="font-mono font-bold text-white">{user?.uniqueId}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-sm text-gray-300 hover:text-white transition-all"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}
