import { Search, X } from 'lucide-react';

export default function FilterBar({ filters, setFilter, total, showing }) {
  const directions = ['ALL', 'LONG', 'SHORT'];
  const timeframes = ['5m', '15m', '1h', '4h'];

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 bg-[#0f1923] border border-[#1e2d40] rounded-xl px-3 sm:px-4 py-3">
      {/* Search Bar */}
      <div className="relative flex items-center w-full sm:min-w-[160px] sm:max-w-[240px] sm:flex-1">
        <span className="absolute left-3 text-gray-500">
          <Search size={16} />
        </span>
        <input
          type="text"
          placeholder="Search pair (e.g. BTC)..."
          value={filters.search || ''}
          onChange={e => setFilter('search', e.target.value)}
          className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-[#0a0e17] text-sm text-white placeholder-gray-600 border border-[#1e2d40] focus:outline-none focus:border-[#00d4aa] transition-all font-mono"
        />
        {filters.search && (
          <button
            onClick={() => setFilter('search', '')}
            className="absolute right-2.5 text-gray-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Direction Toggle */}
      <div className="flex gap-1 bg-[#0a0e17] rounded-lg p-1">
        {directions.map(d => (
          <button
            key={d}
            onClick={() => setFilter('direction', d)}
            className={`px-3 py-1 rounded-md text-sm font-semibold transition-all duration-150 ${
              filters.direction === d
                ? d === 'LONG' ? 'bg-emerald-600 text-white' : d === 'SHORT' ? 'bg-red-600 text-white' : 'bg-[#1e2d40] text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {d === 'LONG' ? '▲ ' : d === 'SHORT' ? '▼ ' : ''}{d}
          </button>
        ))}
      </div>

      {/* Timeframe Selector */}
      <div className="flex gap-1 bg-[#0a0e17] rounded-lg p-1">
        {timeframes.map(t => (
          <button
            key={t}
            onClick={() => setFilter('timeframe', t)}
            className={`px-3 py-1 rounded-md text-sm font-mono transition-all duration-150 ${
              filters.timeframe === t ? 'bg-[#1e2d40] text-[#00d4aa]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Min Score Slider */}
      <div className="flex items-center gap-3 flex-1 min-w-[180px]">
        <span className="text-xs text-gray-500 whitespace-nowrap">Min Score:</span>
        <input
          type="range" min={10} max={90} step={5}
          value={filters.minScore}
          onChange={e => setFilter('minScore', Number(e.target.value))}
          className="flex-1 h-1 accent-[#00d4aa] cursor-pointer"
        />
        <span className="text-sm font-mono text-[#00d4aa] w-10 text-right">{filters.minScore}+</span>
      </div>

      {/* Count */}
      <div className="text-xs text-gray-500 whitespace-nowrap sm:ml-auto">
        Showing <span className="text-white font-mono">{showing}</span> of <span className="text-white font-mono">{total}</span> signals
      </div>
    </div>
  );
}
