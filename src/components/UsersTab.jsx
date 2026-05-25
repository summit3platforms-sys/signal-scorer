import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Shield, 
  Trash2, 
  UserCheck, 
  Users, 
  Clock, 
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

const STATUS_COLORS = {
  pending:         'bg-gray-500/10 text-gray-400',
  approved:        'bg-amber-500/10 text-amber-400',
  payment_pending: 'bg-blue-500/10 text-blue-400',
  active:          'bg-[#00d4aa]/10 text-[#00d4aa]',
  expired:         'bg-red-500/10 text-red-400'
};

const STATUS_DOT = {
  pending:         'bg-gray-400',
  approved:        'bg-amber-400',
  payment_pending: 'bg-blue-400 animate-pulse',
  active:          'bg-[#00d4aa]',
  expired:         'bg-red-400'
};

const DURATION_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
  { label: '180 days', value: 180 },
  { label: '365 days', value: 365 },
  { label: 'Custom', value: 'custom' }
];

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpiringSoon(ts) {
  if (!ts) return false;
  return ts - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  // Per-row subscription duration selectors
  const [durationSelections, setDurationSelections] = useState({});  // { uniqueId: number|'custom' }
  const [customDays, setCustomDays] = useState({});                  // { uniqueId: string }

  const currentUser = useAuthStore((state) => state.user);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/waitlist', {
        headers: { 'x-user-id': currentUser?.uniqueId || '' }
      });
      if (!res.ok) throw new Error(`Failed to fetch user list: Status ${res.status}`);
      const data = await res.json();
      setUsers(data.entries || []);
    } catch (err) {
      console.error('[UsersTab] Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    let result = [...users];
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(u =>
        u.email.toLowerCase().includes(term) ||
        u.uniqueId.toLowerCase().includes(term) ||
        (u.referral && u.referral.toLowerCase().includes(term))
      );
    }
    if (roleFilter !== 'ALL') {
      result = result.filter(u => u.role === roleFilter.toLowerCase());
    }
    setFilteredUsers(result);
  }, [users, searchTerm, roleFilter]);

  // ── Action handlers ────────────────────────────────────────────────────

  const handleApprove = async (uniqueId) => {
    setActionLoading(uniqueId);
    try {
      const res = await fetch(`/api/waitlist/${uniqueId}/approve`, {
        method: 'POST',
        headers: { 'x-user-id': currentUser?.uniqueId || '' }
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Approve failed');
      await fetchUsers();
    } catch (err) { alert(`Error: ${err.message}`); }
    finally { setActionLoading(null); }
  };

  const handleConfirmPayment = async (uniqueId) => {
    setActionLoading(uniqueId);
    try {
      const selVal = durationSelections[uniqueId] ?? 30;
      const days = selVal === 'custom'
        ? parseInt(customDays[uniqueId]) || 30
        : selVal;

      const res = await fetch(`/api/waitlist/${uniqueId}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.uniqueId || ''
        },
        body: JSON.stringify({ subscriptionDays: days })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Confirm payment failed');
      await fetchUsers();
    } catch (err) { alert(`Error: ${err.message}`); }
    finally { setActionLoading(null); }
  };

  const handleRoleChange = async (uniqueId, newRole) => {
    setActionLoading(uniqueId);
    try {
      const res = await fetch(`/api/waitlist/${uniqueId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.uniqueId || ''
        },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Role update failed');
      await fetchUsers();
    } catch (err) { alert(`Error: ${err.message}`); }
    finally { setActionLoading(null); }
  };

  const handleDeleteUser = async (uniqueId) => {
    if (!uniqueId) return;
    setDeleteConfirmUser(null);
    setActionLoading(uniqueId);
    try {
      const res = await fetch(`/api/waitlist/${uniqueId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser?.uniqueId || '' }
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
      await fetchUsers();
    } catch (err) { alert(`Error: ${err.message}`); }
    finally { setActionLoading(null); }
  };

  const totalCount = users.length;
  const activeCount = users.filter(u => u.status === 'active').length;
  const pendingCount = users.filter(u => u.status === 'pending').length;
  const paymentPendingCount = users.filter(u => u.status === 'payment_pending').length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Members', value: totalCount, color: 'text-white' },
          { label: 'Active', value: activeCount, color: 'text-[#00d4aa]' },
          { label: 'Payment Pending', value: paymentPendingCount, color: 'text-blue-400' },
          { label: 'Pending Approval', value: pendingCount, color: 'text-amber-400' }
        ].map(stat => (
          <div key={stat.label} className="glass-panel p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
            <Users className="h-8 w-8 text-gray-700" />
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by email, ID, or referral..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            {['ALL', 'MASTER', 'USER', 'PENDING'].map(f => (
              <button key={f}
                onClick={() => setRoleFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  roleFilter === f
                    ? 'bg-[#00d4aa] text-black shadow'
                    : 'border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >{f}</button>
            ))}
            <button onClick={fetchUsers} className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-6 w-6 text-[#00d4aa] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading members...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
            <p className="text-sm text-red-400 font-medium">{error}</p>
            <button onClick={fetchUsers}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-white font-medium text-xs transition-all">
              Retry Connection
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="h-10 w-10 mx-auto text-gray-600 mb-3" />
            <span className="font-medium text-sm">No members found matching active search.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01]">
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Access ID</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Email</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Paid On</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Expires</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Joined</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium text-sm">
                {filteredUsers.map((user) => {
                  const isMasterUser = user.uniqueId === 'QC25101';
                  const isActivelyLoading = actionLoading === user.uniqueId;
                  const selVal = durationSelections[user.uniqueId] ?? 30;

                  return (
                    <tr key={user.uniqueId} className="hover:bg-white/[0.01] transition-colors">
                      {/* ID */}
                      <td className="px-5 py-4 font-mono font-bold tracking-wider text-white">
                        <div className="flex items-center gap-2">
                          <span>{user.uniqueId}</span>
                          {user.role === 'master' && (
                            <Shield className="h-3.5 w-3.5 text-[#00d4aa] fill-[#00d4aa]/10" title="Master Administrator" />
                          )}
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 text-gray-300 font-mono text-xs">{user.email}</td>

                      {/* Status badge */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${STATUS_COLORS[user.status] || 'bg-gray-500/10 text-gray-400'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[user.status] || 'bg-gray-400'}`} />
                          {user.status?.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Paid On */}
                      <td className="px-5 py-4 text-gray-400 text-xs font-mono">
                        {formatDate(user.paidAt)}
                      </td>

                      {/* Expires */}
                      <td className="px-5 py-4 text-xs font-mono">
                        {user.expiresAt ? (
                          <span className={isExpiringSoon(user.expiresAt) ? 'text-red-400 font-bold' : 'text-gray-400'}>
                            {formatDate(user.expiresAt)}
                            {isExpiringSoon(user.expiresAt) && ' ⚠️'}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4 text-gray-400 text-xs font-mono">
                        {formatDate(user.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {isMasterUser ? (
                          <span className="text-[10px] text-gray-500 font-semibold uppercase">Locked</span>
                        ) : isActivelyLoading ? (
                          <RefreshCw className="h-4 w-4 text-[#00d4aa] animate-spin ml-auto" />
                        ) : (
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {/* pending → Approve */}
                            {user.status === 'pending' && (
                              <button
                                onClick={() => handleApprove(user.uniqueId)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-bold transition-all flex items-center gap-1"
                              >
                                <UserCheck className="h-3.5 w-3.5" /> Approve
                              </button>
                            )}

                            {/* payment_pending → duration selector + Confirm Payment */}
                            {(user.status === 'payment_pending' || user.status === 'expired') && (
                              <div className="flex items-center gap-2">
                                <select
                                  value={selVal}
                                  onChange={e => {
                                    const v = e.target.value === 'custom' ? 'custom' : parseInt(e.target.value);
                                    setDurationSelections(prev => ({ ...prev, [user.uniqueId]: v }));
                                  }}
                                  className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#00d4aa] cursor-pointer"
                                >
                                  {DURATION_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                                {selVal === 'custom' && (
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="days"
                                    value={customDays[user.uniqueId] ?? ''}
                                    onChange={e => setCustomDays(prev => ({ ...prev, [user.uniqueId]: e.target.value }))}
                                    className="w-16 bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#00d4aa]"
                                  />
                                )}
                                <button
                                  onClick={() => handleConfirmPayment(user.uniqueId)}
                                  className="px-3 py-1.5 rounded-lg bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  {user.status === 'expired' ? 'Renew' : 'Confirm ✓'}
                                </button>
                              </div>
                            )}

                            {/* active → show role dropdown */}
                            {user.status === 'active' && (
                              <select
                                value={user.role}
                                onChange={e => handleRoleChange(user.uniqueId, e.target.value)}
                                className="bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00d4aa] cursor-pointer font-bold"
                              >
                                <option value="user">User</option>
                                <option value="master">Master</option>
                                <option value="pending">Pending</option>
                              </select>
                            )}

                            {/* approved → waiting label */}
                            {user.status === 'approved' && (
                              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                                Awaiting Payment
                              </span>
                            )}

                            {/* Delete — always shown unless master */}
                            <button
                              onClick={() => setDeleteConfirmUser(user)}
                              className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-red-500/30 shadow-2xl relative space-y-6">
            <div className="flex items-center gap-3 text-red-400">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Revoke Platform Access?</h3>
                <p className="text-xs text-red-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Are you sure you want to permanently delete user{' '}
              <strong className="text-white font-mono bg-black/30 px-1.5 py-0.5 rounded border border-white/5">
                {deleteConfirmUser.uniqueId}
              </strong>{' '}
              ({deleteConfirmUser.email})? They will immediately lose all access.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white text-xs font-semibold hover:bg-white/5 transition-all"
              >Cancel</button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmUser.uniqueId)}
                className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-lg transition-all"
              >Revoke Access</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
