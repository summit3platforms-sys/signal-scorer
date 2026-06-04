import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function HistoryTable({ history }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil((history?.length || 0) / itemsPerPage);

  // Reset to first page if history changes and current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [history, totalPages, currentPage]);

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
        <Clock size={32} className="opacity-50" />
        <p>No closed trades in history yet.</p>
        <p className="text-xs max-w-md text-center">Trades will appear here automatically once the live price hits their Take Profit or Stop Loss targets.</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'WIN_TP1':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-1 w-fit"><CheckCircle2 size={12}/> WIN (TP1)</span>;
      case 'WIN_TP2':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-1 w-fit"><CheckCircle2 size={12}/> WIN (TP2)</span>;
      case 'LOSS_SL':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 flex items-center gap-1 w-fit"><XCircle size={12}/> LOSS (SL)</span>;
      case 'EXPIRED':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-500/20 text-gray-400 flex items-center gap-1 w-fit"><Clock size={12}/> EXPIRED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-500/20 text-gray-400">{status}</span>;
    }
  };

  const formatDate = (ts) => {
    return new Date(ts).toLocaleString(undefined, { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatPrice = (p) => {
    return p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(3) : p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Summary stats for footer
  const wins   = history.filter(t => t.status.startsWith('WIN')).length;
  const losses = history.filter(t => t.status === 'LOSS_SL').length;
  const avgPnl = history.length > 0
    ? (history.reduce((s, t) => s + (t.maxProfitPct ?? 0), 0) / history.length)
    : 0;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHistory = history.slice(startIndex, startIndex + itemsPerPage);

  // Generate page list
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const getVisiblePages = () => {
    if (totalPages <= 7) return pageNumbers;
    if (currentPage <= 4) return [...pageNumbers.slice(0, 5), '...', totalPages];
    if (currentPage >= totalPages - 3) return [1, '...', ...pageNumbers.slice(totalPages - 5)];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="bg-[#0f1923] border border-[#1e2d40] rounded-xl overflow-hidden animate-fadeSlide flex flex-col justify-between min-h-[460px]">
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#1e2d40]/50 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">Closed At</th>
              <th className="px-4 py-3 font-medium">Pair / Dir</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 font-medium">Entry</th>
              <th className="px-4 py-3 font-medium text-right">PnL %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d40]">
            {paginatedHistory.map((trade) => {
              const isWin = trade.status.startsWith('WIN');
              const isLoss = trade.status === 'LOSS_SL';
              const pnlColor = isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-gray-400';
              const pnlPct = trade.maxProfitPct ?? 0;
              const pnlPrefix = pnlPct > 0 ? '+' : '';
              return (
                <tr key={trade.id} className="hover:bg-[#1e2d40]/20 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{formatDate(trade.closedAt || trade.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{trade.symbol}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${trade.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{trade.direction}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(trade.status)}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">${formatPrice(trade.entry)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${pnlColor}`}>{pnlPrefix}{pnlPct.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-[#1e2d40]">
        {paginatedHistory.map((trade) => {
          const isWin = trade.status.startsWith('WIN');
          const isLoss = trade.status === 'LOSS_SL';
          const pnlColor = isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-gray-400';
          const pnlPct = trade.maxProfitPct ?? 0;
              const pnlPrefix = pnlPct > 0 ? '+' : '';
          return (
            <div key={trade.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-bold text-sm">{trade.symbol}</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${trade.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{trade.direction}</span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono">{formatDate(trade.closedAt || trade.createdAt)}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {getStatusBadge(trade.status)}
                <span className={`text-sm font-mono font-bold ${pnlColor}`}>{pnlPrefix}{pnlPct.toFixed(2)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      {history.length > 0 && (
        <div className="border-t border-[#1e2d40] px-4 sm:px-6 py-2 bg-[#0a0e17] flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <span>Total: <span className="text-white font-mono font-bold">{history.length}</span> trades</span>
          <span>Wins: <span className="text-emerald-400 font-mono font-bold">{wins}</span></span>
          <span>Losses: <span className="text-red-400 font-mono font-bold">{losses}</span></span>
          <span>Avg PnL: <span className={`font-mono font-bold ${avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{avgPnl >= 0 ? '+' : ''}{avgPnl.toFixed(2)}%</span></span>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#1e2d40] px-3 sm:px-6 py-3 sm:py-4 bg-[#0a0e17] flex-wrap gap-2">
          <div className="text-xs text-gray-500 hidden sm:block">
            Showing <span className="text-white font-mono">{startIndex + 1}</span> to <span className="text-white font-mono">{Math.min(startIndex + itemsPerPage, history.length)}</span> of <span className="text-white font-mono">{history.length}</span> trades
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[#1e2d40] bg-[#0f1923] text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-[#1e2d40] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1">
              {visiblePages.map((page, idx) => {
                if (page === '...') {
                  return (
                    <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-600 font-mono text-xs select-none">
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg border text-xs font-mono font-bold transition-all duration-150 ${
                      currentPage === page
                        ? 'border-[#00d4aa] bg-[#00d4aa]/10 text-[#00d4aa]'
                        : 'border-[#1e2d40] bg-[#0f1923] text-gray-400 hover:text-white hover:border-gray-500'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-[#1e2d40] bg-[#0f1923] text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-[#1e2d40] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
