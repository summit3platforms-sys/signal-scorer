export default function LiveTicker({ signals, prices }) {
  if (!signals || signals.length === 0) return null;

  const items = signals.slice(0, 40);

  return (
    <div className="overflow-hidden bg-[#0a0e17] border-y border-[#1e2d40] py-2 relative">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0e17] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0e17] to-transparent z-10 pointer-events-none" />

      <div className="flex gap-6 animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
        {[...items, ...items].map((s, i) => {
          const livePriceData = prices?.[s.symbol];
          const price = livePriceData?.price ?? s.entry;
          const change = livePriceData?.change24h ?? s.priceChange ?? 0;
          const isUp = change >= 0;
          return (
            <div key={`${s.symbol}-${i}`} className="flex items-center gap-2 text-sm font-mono">
              <span className={`font-bold ${s.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
                {s.direction === 'LONG' ? '▲' : '▼'}
              </span>
              <span className="text-white">{s.symbol.replace('USDT', '')}</span>
              <span className="text-gray-300">${price < 1 ? price.toFixed(4) : price < 100 ? price.toFixed(3) : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={isUp ? 'text-emerald-400' : 'text-red-400'}>
                {isUp ? '+' : ''}{change?.toFixed(2)}%
              </span>
              <span className="text-gray-700">|</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
