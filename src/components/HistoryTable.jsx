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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#1e2d40]/50 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-medium">Closed At</th>
              <th className="px-6 py-4 font-medium">Pair / Dir</th>
              <th className="px-6 py-4 font-medium">Result</th>
              <th className="px-6 py-4 font-medium">Entry</th>
              <th className="px-6 py-4 font-medium text-right">PnL %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d40]">
            {paginatedHistory.map((trade) => {
              const isWin = trade.status.startsWith('WIN');
              const isLoss = trade.status === 'LOSS_SL';
              const pnlColor = isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-gray-400';
              const pnlPrefix = isWin ? '+' : isLoss ? '' : '';
              
              return (
                <tr key={trade.id} className="hover:bg-[#1e2d40]/20 transition-colors">
                  <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                    {formatDate(trade.closedAt || trade.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{trade.symbol}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        trade.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.direction}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(trade.status)}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-300">
                    ${formatPrice(trade.entry)}
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold ${pnlColor}`}>
                    {pnlPrefix}{trade.maxProfitPct ? trade.maxProfitPct.toFixed(2) : '0.00'}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#1e2d40] px-6 py-4 bg-[#0a0e17]">
          <div className="text-xs text-gray-500">
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
