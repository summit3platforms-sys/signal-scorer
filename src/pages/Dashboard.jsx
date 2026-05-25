import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  CandlestickChart, 
  HelpCircle, 
  Activity, 
  History, 
  FileText, 
  Settings, 
  Stethoscope, 
  AlertOctagon, 
  Users,
  LogOut
} from 'lucide-react';
import { useSignalStore } from '../store/signalStore.js';
import { useAuthStore } from '../store/authStore.js';
import StatsBar from '../components/StatsBar.jsx';
import RadarScanner from '../components/RadarScanner.jsx';
import FilterBar from '../components/FilterBar.jsx';
import SignalCard from '../components/SignalCard.jsx';
import LiveTicker from '../components/LiveTicker.jsx';
import ScanCountdown from '../components/ScanCountdown.jsx';
import HowScoringModal from '../components/HowScoringModal.jsx';
import HistoryTable from '../components/HistoryTable.jsx';
import SettingsTab from '../components/SettingsTab.jsx';
import HealthTab from '../components/HealthTab.jsx';
import ErrorLogsTab from '../components/ErrorLogsTab.jsx';
import UsersTab from '../components/UsersTab.jsx';

function formatLastScan(isoStr) {
  if (!isoStr) return 'Never';
  const date = new Date(isoStr);
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  if (diff < 60) return `${diff}s ago (${timeStr})`;
  return `${Math.round(diff / 60)}m ago (${timeStr})`;
}

export default function Dashboard() {
  const { 
    signals, filteredSignals, tradeHistory, systemNotes, stats, filters, prices, 
    scanStatus, isConnected, initSocket, setFilter, triggerScan, fetchHistory, fetchSystemNotes, fetchErrorLogs 
  } = useSignalStore();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ACTIVE');

  useEffect(() => {
    initSocket();
  }, []);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory();
    } else if (activeTab === 'NOTES') {
      fetchSystemNotes();
    } else if (activeTab === 'ERRORS' && user?.role === 'master') {
      fetchErrorLogs();
    }
  }, [activeTab, user]);

  const handleRescan = () => {
    triggerScan();
    setActiveTab('ACTIVE');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white" style={{ backgroundImage: 'radial-gradient(circle, #1e2d40 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#0a0e17]/90 backdrop-blur-md border-b border-[#1e2d40] px-3 sm:px-6 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Logo and Active User Badge */}
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <CandlestickChart className="text-[#00d4aa]" size={22} />
                <span className="text-lg font-bold text-white tracking-tight">Quantum Candle <span className="text-[#00d4aa]">AI</span></span>
              </div>
              <div className="hidden sm:block text-[10px] text-gray-600 tracking-widest uppercase mt-0.5">Next-Generation Crypto Signal Engine</div>
            </div>

            {user && (
              <div className="hidden xs:flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-[#1e2d40]/40 rounded-full text-xs">
                <span className="font-mono text-gray-500 font-medium">Account:</span>
                <span className="font-mono font-bold text-[#f0b429]">{user.uniqueId}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa]" />
                <span className="font-bold text-gray-300 uppercase text-[10px] tracking-wider">{user.role}</span>
              </div>
            )}
          </div>

          {/* Right: Status Controls and Logout */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs font-mono ${isConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            <span className="text-xs text-gray-500 font-mono hidden sm:inline">
              Last scan: {formatLastScan(scanStatus.lastScanAt)}
              {scanStatus.scanDurationMs > 0 && ` (took ${Math.round(scanStatus.scanDurationMs / 1000)}s)`}
            </span>

            {scanStatus.totalPairs > 0 && (
              <span className="text-xs bg-[#1e2d40] text-gray-400 px-2 py-0.5 rounded-full font-mono">
                {scanStatus.totalPairs} pairs
              </span>
            )}

            <ScanCountdown countdown={scanStatus.countdown} isScanning={scanStatus.isScanning} />

            <button
              onClick={handleRescan}
              disabled={scanStatus.isScanning}
              className="flex items-center gap-1.5 text-xs sm:text-sm border border-[#00d4aa] text-[#00d4aa] px-2 sm:px-3 py-1.5 rounded-lg hover:bg-[#00d4aa]/10 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={scanStatus.isScanning ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{scanStatus.isScanning ? 'Scanning…' : 'Rescan Now'}</span><span className="sm:hidden">{scanStatus.isScanning ? '…' : 'Scan'}</span>
            </button>

            <button onClick={() => setShowModal(true)} className="text-gray-500 hover:text-white transition-colors">
              <HelpCircle size={18} />
            </button>

            <div className="h-6 w-[1px] bg-white/10 mx-1 hidden sm:block" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all font-semibold"
              title="Logout from platform"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats Bar */}
        <StatsBar stats={stats} totalPairs={scanStatus.totalPairs} activeCount={signals.length} />

        {/* Live Ticker */}
        <LiveTicker signals={signals} prices={prices} />

        {/* Tabs */}
        <div className="flex items-center border-b border-[#1e2d40] gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'ACTIVE' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Activity size={16} /> Active Signals
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-mono font-bold transition-colors ${
              activeTab === 'ACTIVE' ? 'bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30' : 'bg-gray-800 text-gray-400 border border-gray-700/50'
            }`}>
              {signals.length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'HISTORY' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <History size={16} /> Trade History
          </button>
          
          {/* Master Admin Only Tabs */}
          {user?.role === 'master' && (
            <>
              <button
                onClick={() => setActiveTab('SETTINGS')}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'SETTINGS' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Settings size={16} /> Settings
              </button>
              
              <button
                onClick={() => setActiveTab('HEALTH')}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'HEALTH' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Stethoscope size={16} /> System Health
              </button>
              
              <button
                onClick={() => setActiveTab('ERRORS')}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'ERRORS' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <AlertOctagon size={16} /> Error Logs
              </button>
              
              <button
                onClick={() => setActiveTab('USERS')}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'USERS' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Users size={16} /> Users
              </button>
              
              <button
                onClick={() => setActiveTab('NOTES')}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'NOTES' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <FileText size={16} /> System Notes
              </button>
            </>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'ACTIVE' ? (
          <div className="animate-fadeSlide flex gap-4 items-start w-full min-w-0 overflow-hidden">
            {/* ── Left: Filter bar + signal cards ── */}
            <div className="flex-1 min-w-0 max-w-full overflow-hidden space-y-4">
              <FilterBar
                filters={filters}
                setFilter={setFilter}
                total={signals.length}
                showing={filteredSignals.length}
              />

              {scanStatus.isScanning && filteredSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <RefreshCw className="animate-spin text-[#00d4aa]" size={32} />
                  <p className="text-gray-500 text-sm">Scanning {scanStatus.totalPairs || '—'} pairs…</p>
                </div>
              ) : filteredSignals.length === 0 ? (
                <div className="text-center py-24 text-gray-600">
                  <p className="text-lg">No signals match the current filters.</p>
                  <p className="text-sm mt-2">Try lowering the minimum score or changing the direction filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredSignals.map((signal, i) => (
                    <div key={signal.symbol} style={{ animationDelay: `${(i % 10) * 50}ms` }} className="animate-fadeSlide">
                      <SignalCard
                        signal={signal}
                        livePrice={prices?.[signal.symbol]?.price}
                        liveChange={prices?.[signal.symbol]?.change24h}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: Radar sidebar ── */}
            <div className="radar-sidebar-col hidden lg:block flex-shrink-0 w-64 xl:w-72 sticky top-4 self-start">
              <RadarScanner />
            </div>
          </div>
        ) : activeTab === 'HISTORY' ? (
          <HistoryTable history={tradeHistory} />
        ) : activeTab === 'SETTINGS' && user?.role === 'master' ? (
          <SettingsTab />
        ) : activeTab === 'HEALTH' && user?.role === 'master' ? (
          <HealthTab />
        ) : activeTab === 'ERRORS' && user?.role === 'master' ? (
          <ErrorLogsTab />
        ) : activeTab === 'USERS' && user?.role === 'master' ? (
          <UsersTab />
        ) : activeTab === 'NOTES' && user?.role === 'master' ? (
          <div className="bg-[#0f1923] border border-[#1e2d40] rounded-xl p-6 animate-fadeSlide">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="text-[#00d4aa]" /> Project System Notes
            </h2>
            <div className="bg-[#0a0e17] rounded-lg p-4 border border-[#1e2d40] overflow-x-auto">
              <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap">
                {systemNotes || 'Loading notes...'}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 text-red-400">
            <AlertOctagon size={32} className="mx-auto text-red-500 mb-2" />
            <p className="text-lg font-bold">Unauthorized Section</p>
            <p className="text-sm text-gray-500 mt-1">You do not have administrative permissions to view this tab.</p>
          </div>
        )}

      </main>

      {/* Modal */}
      {showModal && <HowScoringModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
