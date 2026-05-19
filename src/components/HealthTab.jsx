import { useState, useEffect } from 'react';
import { Activity, Database, Zap, MessageCircle, BrainCircuit, Send, CheckCircle, AlertCircle } from 'lucide-react';

export default function HealthTab() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customMsg, setCustomMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success'|'error', text: '' }

  useEffect(() => {
    fetchHealth();
    // Refresh every 15 seconds
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error('Failed to fetch health', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!customMsg.trim()) return;

    setBroadcasting(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: customMsg })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Custom announcement broadcasted successfully!' });
        setCustomMsg('');
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to send broadcast.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Error connecting to the backend server.' });
    } finally {
      setBroadcasting(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  if (loading) {
    return <div className="text-gray-400 p-8 animate-pulse text-center">Checking system health...</div>;
  }

  if (!healthData) {
    return <div className="text-red-400 p-8 text-center bg-red-500/10 rounded-lg">Failed to connect to backend server.</div>;
  }

  const { status, services } = healthData;

  return (
    <div className="space-y-6">
      <div className="bg-[#0f1923] border border-[#1e2d40] rounded-xl p-6 animate-fadeSlide">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="text-[#00d4aa]" /> System Health
          </h2>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {status === 'ok' ? 'All Systems Operational' : 'Degraded Performance'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HealthCard 
            title="Binance API" 
            icon={Zap} 
            data={services.binance} 
            description="Real-time market data & prices"
          />
          <HealthCard 
            title="SQLite Database" 
            icon={Database} 
            data={services.database} 
            description="Local persistent storage"
          />
          <HealthCard 
            title="Telegram Bot" 
            icon={MessageCircle} 
            data={services.telegram} 
            description="Push notifications & alerts"
          />
          <HealthCard 
            title="Gemini AI" 
            icon={BrainCircuit} 
            data={services.gemini} 
            description="Advanced signal validation"
          />
        </div>
      </div>

      {/* Broadcast Panel */}
      <div className="bg-[#0f1923] border border-[#1e2d40] rounded-xl p-6 animate-fadeSlide">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <MessageCircle className="text-[#00d4aa]" /> Telegram Broadcast Panel
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Send a custom rich HTML announcement to all connected Telegram chat/channel IDs instantly.
        </p>

        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <textarea
              rows={3}
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              placeholder="Type your custom announcement message here... (HTML tags like <b>, <i>, <code> are supported)"
              className="w-full bg-[#0a0e17] border border-[#1e2d40] rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#00d4aa] transition-colors"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              {statusMsg && (
                <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                  statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {statusMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {statusMsg.text}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={broadcasting || !customMsg.trim()}
              className="flex items-center gap-2 bg-[#00d4aa] text-black px-5 py-2 rounded-lg font-bold hover:bg-[#00b38f] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 text-sm"
            >
              <Send size={14} />
              {broadcasting ? 'Sending...' : 'Broadcast Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HealthCard({ title, icon: Icon, data, description }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'configured':
        return 'text-emerald-400 bg-emerald-500/20';
      case 'missing':
      case 'unknown':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'error':
      default:
        return 'text-red-400 bg-red-500/20';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'connected':
      case 'configured':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
      case 'missing':
      case 'unknown':
        return 'bg-yellow-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]';
      case 'error':
      default:
        return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';
    }
  };

  return (
    <div className="bg-[#1e2d40]/40 p-5 rounded-lg border border-[#1e2d40] hover:bg-[#1e2d40]/60 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#0a0e17] text-gray-300">
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-gray-200 font-bold">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(data?.status)}`}></div>
      </div>
      
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Status:</span>
        <span className={`text-sm font-bold px-2 py-0.5 rounded ${getStatusColor(data?.status)} uppercase`}>
          {data?.status || 'Unknown'}
        </span>
      </div>
      {data?.message && (
        <div className="mt-2 text-xs font-mono text-gray-500 bg-[#0a0e17] p-2 rounded truncate">
          {data.message}
        </div>
      )}
    </div>
  );
}
