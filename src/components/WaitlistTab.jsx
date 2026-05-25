import { useAuthStore } from '../store/authStore.js';
import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, Mail, Calendar, Key, AlertCircle } from 'lucide-react';

export default function WaitlistTab() {
  const [data, setData] = useState({ total: 0, entries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchWaitlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/waitlist', {
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch waitlist');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, []);

  const filteredEntries = data.entries.filter(entry => 
    entry.email.toLowerCase().includes(search.toLowerCase()) ||
    (entry.referral && entry.referral.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5 animate-fadeSlide">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0f1923] border border-[#1e2d40] rounded-xl p-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="text-[#00d4aa]" /> Waitlist Registrations
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage institutional traders and early access invite requests.
          </p>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-[#00d4aa]/10 border border-[#00d4aa]/20 px-4 py-2 rounded-xl text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Signups</div>
            <div className="text-2xl font-bold font-mono text-[#00d4aa] mt-0.5">{data.total}</div>
          </div>
        </div>
      </div>

      {/* Control Bar (Search & Refresh) */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or referral code..."
            className="w-full pl-9 pr-4 py-3 bg-[#0f1923] border border-[#1e2d40] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] transition-colors text-sm"
          />
        </div>

        <button
          onClick={fetchWaitlist}
          disabled={loading}
          className="px-4 py-3 bg-[#0f1923] border border-[#1e2d40] rounded-xl text-gray-300 hover:text-white hover:border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh waitlist"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List Container */}
      {loading && data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-[#0f1923] border border-[#1e2d40] rounded-xl">
          <RefreshCw className="animate-spin text-[#00d4aa]" size={24} />
          <p className="text-gray-500 text-sm">Loading early access signups...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-[#0f1923] border border-[#1e2d40] rounded-xl text-red-400">
          <AlertCircle size={24} />
          <p className="text-sm font-medium">Failed to load waitlist: {error}</p>
          <button 
            onClick={fetchWaitlist}
            className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-all mt-2"
          >
            Try Again
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-20 bg-[#0f1923] border border-[#1e2d40] rounded-xl text-gray-500">
          <p className="text-base font-semibold">No waitlist entries found.</p>
          <p className="text-xs mt-1 text-gray-600">
            {search ? 'Try clearing your search filters.' : 'Emails will appear here once traders request access.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#0f1923] border border-[#1e2d40] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e2d40] bg-black/20 text-gray-400 font-mono text-xs uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold">Email</th>
                  <th className="py-4 px-6 font-semibold">Referral Code</th>
                  <th className="py-4 px-6 font-semibold">Registration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d40]/50 text-sm font-mono">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/[0.01] transition-colors">
                    {/* Email column */}
                    <td className="py-4 px-6 font-medium text-white flex items-center gap-2.5">
                      <Mail size={14} className="text-gray-500" />
                      <span>{entry.email}</span>
                    </td>
                    
                    {/* Referral column */}
                    <td className="py-4 px-6">
                      {entry.referral ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-sans bg-[#f0b429]/10 text-[#f0b429] border border-[#f0b429]/20">
                          <Key size={10} /> {entry.referral}
                        </span>
                      ) : (
                        <span className="text-gray-600 font-sans text-xs">None</span>
                      )}
                    </td>
                    
                    {/* Date column */}
                    <td className="py-4 px-6 text-gray-400 text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-gray-600" />
                        <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
