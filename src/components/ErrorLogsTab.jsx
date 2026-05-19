import { useEffect, useState } from 'react';
import { useSignalStore } from '../store/signalStore';
import { AlertOctagon, Trash2, ShieldAlert, ChevronDown, ChevronUp, RefreshCw, PlusCircle, CheckCircle } from 'lucide-react';

export default function ErrorLogsTab() {
  const { errorLogs, fetchErrorLogs, clearErrorLogs, triggerTestError } = useSignalStore();
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchErrorLogs();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchErrorLogs();
    setRefreshing(false);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getContextColor = (context) => {
    switch (context?.toUpperCase()) {
      case 'GEMINI AI':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'SCANNER':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'PRICETRACKER':
        return 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
      case 'TELEGRAM':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
    }
  };

  return (
    <div className="bg-[#0f1923] border border-[#1e2d40] rounded-xl p-6 animate-fadeSlide">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1e2d40]">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-red-500">
            <AlertOctagon /> System Error Logs
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Real-time tracking of backend scanner exceptions, API rate limits, and Gemini AI processing errors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Trigger Test Error */}
          <button
            onClick={triggerTestError}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e2d40] text-gray-300 hover:text-white border border-[#2d3f56] transition-colors"
            title="Create a simulated error to verify integration"
          >
            <PlusCircle size={14} />
            Simulate Error
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg bg-[#0a0e17] border border-[#1e2d40] text-gray-400 hover:text-gray-200 transition-colors ${
              refreshing ? 'animate-spin' : ''
            }`}
            title="Refresh Logs"
          >
            <RefreshCw size={14} />
          </button>

          {/* Clear logs */}
          <button
            onClick={clearErrorLogs}
            disabled={errorLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Trash2 size={14} />
            Clear Logs
          </button>
        </div>
      </div>

      {/* Content */}
      {errorLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <ShieldAlert size={36} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-200">All Systems Clear!</h3>
          <p className="text-xs text-gray-500 max-w-sm mt-1">
            No errors have been logged in the system. The bot is scanning markets and validating signals smoothly.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {errorLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div 
                key={log.id} 
                className="bg-[#0a0e17] border border-[#1e2d40] rounded-lg overflow-hidden hover:border-[#2d3f56] transition-colors"
              >
                {/* Collapsed Header Summary */}
                <div 
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getContextColor(log.context)}`}>
                      {log.context}
                    </span>
                    <span className="text-sm text-gray-300 font-semibold truncate flex-1 pr-4">
                      {log.message}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-gray-500 whitespace-nowrap">
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded Details / Stacktrace */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#1e2d40]/60 bg-[#070b11]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                        Error Stack Trace
                      </span>
                      <button
                        onClick={() => copyToClipboard(log.stack || `${log.context}: ${log.message}`, log.id)}
                        className="text-[10px] text-gray-500 hover:text-white bg-[#121924] border border-[#1e2d40] px-2 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        {copiedId === log.id ? (
                          <>
                            <CheckCircle size={10} className="text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          'Copy Stack'
                        )}
                      </button>
                    </div>

                    <pre className="text-xs font-mono text-red-300/80 bg-black/40 p-4 rounded-lg overflow-x-auto max-h-[250px] leading-relaxed whitespace-pre-wrap select-text border border-red-500/10">
                      {log.stack || 'No detailed stack trace available for this error.'}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
