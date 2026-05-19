export default function Header({ meta, onRescan }) {
  const scanning = meta?.status === 'scanning'

  const lastScan = meta?.scannedAt
    ? new Date(meta.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const duration = meta?.scanDuration
    ? `${(meta.scanDuration / 1000).toFixed(1)}s`
    : null

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">S</div>
        <div>
          <div className="header-title">Signal Scorer</div>
          <div className="header-subtitle">BINANCE USDT FUTURES INTELLIGENCE</div>
        </div>
      </div>

      <div className="header-right">
        <div className="scan-status">
          <span className={`pulse-dot ${scanning ? 'scanning' : meta?.scannedAt ? '' : 'idle'}`} />
          {scanning
            ? 'Scanning market…'
            : lastScan
              ? <>Last scan {lastScan}{duration && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({duration})</span>}</>
              : 'Initializing…'
          }
        </div>

        {meta?.totalPairs && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {meta.totalPairs} pairs
          </span>
        )}

        <button
          id="rescan-btn"
          className="btn btn-primary"
          onClick={onRescan}
          disabled={scanning}
        >
          {scanning ? '⟳ Scanning…' : '⟳ Rescan Now'}
        </button>
      </div>
    </header>
  )
}
