import { useState, useMemo } from 'react'
import Header      from './Header.jsx'
import FilterBar   from './FilterBar.jsx'
import SignalCard   from './SignalCard.jsx'
import SignalDetail from './SignalDetail.jsx'
import { useSignals } from '../hooks/useSignals.js'

export default function Dashboard() {
  const [direction, setDirection] = useState('ALL')
  const [minScore,  setMinScore]  = useState(0)
  const [interval,  setInterval]  = useState('5m')
  const [selected,  setSelected]  = useState(null)

  const { signals, meta, loading, error, rescan } = useSignals({ direction, minScore, interval })

  // Client-side derived stats
  const stats = useMemo(() => {
    const all    = signals
    const longs  = all.filter(s => s.direction === 'LONG')
    const shorts  = all.filter(s => s.direction === 'SHORT')
    const highConf = all.filter(s => s.confidence === 'HIGH')
    const top    = all[0]
    return { total: all.length, longs: longs.length, shorts: shorts.length, highConf: highConf.length, top }
  }, [signals])

  // Apply client-side direction filter for instant UX
  const filtered = useMemo(() => {
    let out = signals
    if (direction !== 'ALL') out = out.filter(s => s.direction === direction)
    return out.filter(s => s.score >= minScore)
  }, [signals, direction, minScore])

  return (
    <>
      <Header meta={meta} onRescan={rescan} />

      <div className="app-wrapper">
        {/* Stats row */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Signals</div>
            <div className="stat-value blue">{stats.total}</div>
            <div className="stat-sub">of {meta?.totalPairs ?? '—'} pairs scanned</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Overall Win Rate (TP1)</div>
            <div className="stat-value green">{meta?.trackerStats?.overallWinRate ?? 0}%</div>
            <div className="stat-sub">based on {meta?.trackerStats?.totalTracked ?? 0} tracked</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">TP2 Hit Rate</div>
            <div className="stat-value gold">{meta?.trackerStats?.tp2WinRate ?? 0}%</div>
            <div className="stat-sub">full target reached</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Stop Losses</div>
            <div className="stat-value red">{meta?.trackerStats?.slHits ?? 0}</div>
            <div className="stat-sub">signals stopped out</div>
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar
          direction={direction}
          minScore={minScore}
          interval={interval}
          onDirection={setDirection}
          onMinScore={setMinScore}
          onInterval={v => { setInterval(v); rescan() }}
          count={filtered.length}
          total={signals.length}
        />

        {/* Signal grid */}
        {loading && signals.length === 0 ? (
          <div className="state-center">
            <div className="spinner" />
            <div className="state-title">Scanning Binance Futures…</div>
            <div className="state-sub">
              Fetching {meta?.totalPairs ?? '200+'} pairs and computing EMA, RSI, MACD, ATR, Bollinger Bands. This takes ~30–60 seconds.
            </div>
          </div>
        ) : error ? (
          <div className="state-center">
            <div style={{ fontSize: 36 }}>⚠️</div>
            <div className="state-title">Connection Error</div>
            <div className="state-sub">{error}</div>
            <button className="btn btn-primary" onClick={() => rescan()} style={{ marginTop: 8 }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="state-center">
            <div style={{ fontSize: 36 }}>🔍</div>
            <div className="state-title">No signals match your filters</div>
            <div className="state-sub">Try lowering the min score or changing direction.</div>
          </div>
        ) : (
          <div className="signal-grid">
            {filtered.map(signal => (
              <SignalCard
                key={signal.symbol}
                signal={signal}
                onClick={setSelected}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <SignalDetail
          signal={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
