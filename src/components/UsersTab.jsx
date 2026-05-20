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
  Filter
} from 'lucide-react';

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  const currentUser = useAuthStore((state) => state.user);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/waitlist', {
        headers: {
          'x-user-id': currentUser?.uniqueId || ''
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch user list: Status ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.entries || []);
    } catch (err) {
      console.error('[UsersTab] Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update user role');
      }

      await fetchUsers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (uniqueId) => {
    if (!uniqueId) return;
    setDeleteConfirmUser(null);
    setActionLoading(uniqueId);

    try {
      const res = await fetch(`/api/waitlist/${uniqueId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser?.uniqueId || ''
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      await fetchUsers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const totalCount = users.length;
  const activeCount = users.filter(u => u.status === 'active').length;
  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-blue-500/5 blur-xl pointer-events-none" />
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Total Members</span>
            <span className="text-3xl font-extrabold text-white font-mono">{totalCount}</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-[#00d4aa]/5 blur-xl pointer-events-none" />
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Active Access</span>
            <span className="text-3xl font-extrabold text-[#00d4aa] font-mono">{activeCount}</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-[#00d4aa]/10 border border-[#00d4aa]/20 flex items-center justify-center text-[#00d4aa]">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-[#f0b429]/5 blur-xl pointer-events-none" />
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Pending Requests</span>
            <span className="text-3xl font-extrabold text-[#f0b429] font-mono">{pendingCount}</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-[#f0b429]/10 border border-[#f0b429]/20 flex items-center justify-center text-[#f0b429]">
            <Clock className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by ID, email or referral..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4aa] transition-colors text-sm font-medium"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5" /> Filter Role
          </span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#00d4aa] text-sm font-semibold cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="MASTER">Master Admin</option>
            <option value="USER">Standard User</option>
            <option value="PENDING">Pending Approval</option>
          </select>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-gray-400 space-y-4">
            <svg className="animate-spin h-8 w-8 mx-auto text-[#00d4aa]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-semibold text-sm block">Loading member database...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 border border-red-500/20 bg-red-500/5 m-4 rounded-xl space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
            <p className="font-semibold text-sm">{error}</p>
            <button 
              onClick={fetchUsers}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-white font-medium text-xs transition-all"
            >
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
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-gray-400">Access ID</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-gray-400">Email Address</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-gray-400">Referral</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-gray-400">Platform Role</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-gray-400">Joined</th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium text-sm">
                {filteredUsers.map((user) => {
                  const isMasterUser = user.uniqueId === 'QC25101';
                  const isActivelyLoading = actionLoading === user.uniqueId;

                  return (
                    <tr key={user.uniqueId} className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4 font-mono font-bold tracking-wider text-white">
                        <div className="flex items-center gap-2">
                          <span>{user.uniqueId}</span>
                          {user.role === 'master' && (
                            <Shield className="h-3.5 w-3.5 text-[#00d4aa] fill-[#00d4aa]/10" title="Master Administrator" />
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-300 font-mono text-xs">{user.email}</td>

                      <td className="px-6 py-4">
                        {user.referral ? (
                          <span className="text-gray-400 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded text-xs">
                            {user.referral}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                          user.status === 'active' 
                            ? 'bg-[#00d4aa]/10 text-[#00d4aa]' 
                            : 'bg-[#f0b429]/10 text-[#f0b429]'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            user.status === 'active' ? 'bg-[#00d4aa]' : 'bg-[#f0b429]'
                          }`} />
                          {user.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {isMasterUser ? (
                          <span className="text-[#00d4aa] text-xs font-bold uppercase tracking-wider bg-[#00d4aa]/5 border border-[#00d4aa]/10 px-2.5 py-1 rounded-full">
                            Permanent Master
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            disabled={isActivelyLoading}
                            onChange={(e) => handleRoleChange(user.uniqueId, e.target.value)}
                            className="bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00d4aa] cursor-pointer disabled:opacity-50 font-bold"
                          >
                            <option value="pending">Pending</option>
                            <option value="user">User</option>
                            <option value="master">Master</option>
                          </select>
                        )}
                      </td>

                      <td className="px-6 py-4 text-gray-400 text-xs font-mono">
                        {new Date(user.createdAt).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isMasterUser ? (
                          <span className="text-[10px] text-gray-500 font-semibold uppercase">Locked</span>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmUser(user)}
                            disabled={isActivelyLoading}
                            className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
              Are you sure you want to permanently delete the user{' '}
              <strong className="text-white font-mono bg-black/30 px-1.5 py-0.5 rounded border border-white/5">
                {deleteConfirmUser.uniqueId}
              </strong>{' '}
              ({deleteConfirmUser.email})? They will immediately lose all platform access and ability to log in.
            </p>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white text-xs font-semibold hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmUser.uniqueId)}
                className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-lg transition-all"
              >
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
