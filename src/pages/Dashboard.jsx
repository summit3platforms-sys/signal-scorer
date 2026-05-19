import { useEffect, useState } from 'react';
import { RefreshCw, Zap, HelpCircle, Activity, History, FileText, Settings, Stethoscope, AlertOctagon } from 'lucide-react';
import { useSignalStore } from '../store/signalStore.js';
import StatsBar from '../components/StatsBar.jsx';
import FilterBar from '../components/FilterBar.jsx';
import SignalCard from '../components/SignalCard.jsx';
import LiveTicker from '../components/LiveTicker.jsx';
import ScanCountdown from '../components/ScanCountdown.jsx';
import HowScoringModal from '../components/HowScoringModal.jsx';
import HistoryTable from '../components/HistoryTable.jsx';
import SettingsTab from '../components/SettingsTab.jsx';
import HealthTab from '../components/HealthTab.jsx';
import ErrorLogsTab from '../components/ErrorLogsTab.jsx';

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
    signals, filteredSignals, tradeHistory, systemNotes, errorLogs, stats, filters, prices, 
    scanStatus, isConnected, initSocket, setFilter, triggerScan, fetchHistory, fetchSystemNotes, fetchErrorLogs 
  } = useSignalStore();
  
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE', 'HISTORY', 'NOTES'

  useEffect(() => {
    initSocket();
  }, []);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory();
    } else if (activeTab === 'NOTES') {
      fetchSystemNotes();
    } else if (activeTab === 'ERRORS') {
      fetchErrorLogs();
    }
  }, [activeTab]);

  const handleRescan = () => {
    triggerScan();
    setActiveTab('ACTIVE');
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white" style={{ backgroundImage: 'radial-gradient(circle, #1e2d40 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#0a0e17]/90 backdrop-blur-md border-b border-[#1e2d40] px-6 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Logo */}
          <div>
            <div className="flex items-center gap-2">
              <Zap className="text-[#00d4aa]" size={22} />
              <span className="text-lg font-bold text-white tracking-tight">Signal Scorer <span className="text-[#00d4aa]">Pro</span></span>
            </div>
            <div className="text-[10px] text-gray-600 tracking-widest uppercase mt-0.5">Binance USDT Futures Intelligence</div>
          </div>

          {/* Right: Status Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs font-mono ${isConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            <span className="text-xs text-gray-500 font-mono hidden sm:inline">
              Last scan: {formatLastScan(scanStatus.lastScanAt)}
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
              className="flex items-center gap-1.5 text-sm border border-[#00d4aa] text-[#00d4aa] px-3 py-1.5 rounded-lg hover:bg-[#00d4aa]/10 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={scanStatus.isScanning ? 'animate-spin' : ''} />
              {scanStatus.isScanning ? 'Scanning…' : 'Rescan Now'}
            </button>

            <button onClick={() => setShowModal(true)} className="text-gray-500 hover:text-white transition-colors">
              <HelpCircle size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Bar */}
        <StatsBar stats={stats} totalPairs={scanStatus.totalPairs} />

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
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'HISTORY' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <History size={16} /> Trade History
          </button>
          <button
            onClick={() => setActiveTab('NOTES')}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'NOTES' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <FileText size={16} /> System Notes
          </button>
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
        </div>

        {/* Tab Content */}
        {activeTab === 'ACTIVE' ? (
          <div className="space-y-5 animate-fadeSlide">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSignals.map((signal, i) => (
                  <div key={signal.symbol} style={{ animationDelay: `${(i % 10) * 50}ms` }} className="animate-fadeSlide">
                    <SignalCard
                      signal={signal}
                      livePrice={prices?.[signal.symbol]?.price}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'HISTORY' ? (
          <HistoryTable history={tradeHistory} />
        ) : activeTab === 'SETTINGS' ? (
          <SettingsTab />
        ) : activeTab === 'HEALTH' ? (
          <HealthTab />
        ) : activeTab === 'ERRORS' ? (
          <ErrorLogsTab />
        ) : (
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
        )}

      </main>

      {/* Modal */}
      {showModal && <HowScoringModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
