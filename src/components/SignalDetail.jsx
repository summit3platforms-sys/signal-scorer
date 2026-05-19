import { useEffect } from 'react'
import ScoreGauge from './ScoreGauge.jsx'

function fmt(n, d = 4) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 2 })
}

const BREAKDOWN_LABELS = {
  emaScore:  'EMA Alignment',
  rsiScore:  'RSI Zone',
  macdScore: 'MACD Momentum',
  volScore:  'Volume Surge',
  bbScore:   'Bollinger Bands',
  atrScore:  'ATR Filter',
}

const BREAKDOWN_WEIGHTS = {
  emaScore: 25, rsiScore: 20, macdScore: 20, volScore: 15, bbScore: 10, atrScore: 10,
}

function barColor(pct) {
  if (pct >= 75) return 'var(--accent-long)'
  if (pct >= 50) return 'var(--accent-blue)'
  if (pct >= 25) return 'var(--accent-gold)'
  return 'var(--accent-short)'
}

export default function SignalDetail({ signal, onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { symbol, score, direction, confidence, entry, stopLoss, takeProfit, tp1, tp2, tp1Hit,
          price, priceChange, indicators, breakdown, interval, timestamp } = signal

  const changePos = priceChange >= 0

  const isLong = direction === 'LONG';
  const valTP1 = tp1 ?? takeProfit?.[0] ?? 0;
  const valTP2 = tp2 ?? takeProfit?.[1] ?? 0;
  const tp1Dist = isLong 
    ? ((valTP1 - entry) / entry) * 100 
    : ((entry - valTP1) / entry) * 100;
  const tp2Dist = isLong 
    ? ((valTP2 - entry) / entry) * 100 
    : ((entry - valTP2) / entry) * 100;
  const slDist = isLong 
    ? ((entry - stopLoss) / entry) * 100 
    : ((stopLoss - entry) / entry) * 100;

  const indItems = [
    { name: 'RSI (14)',     value: fmt(indicators?.rsi, 2),       color: indicators?.rsi < 30 ? 'var(--accent-long)' : indicators?.rsi > 70 ? 'var(--accent-short)' : 'var(--text-primary)' },
    { name: 'MACD',         value: fmt(indicators?.macd, 6),      color: indicators?.macd > 0 ? 'var(--accent-long)' : 'var(--accent-short)' },
    { name: 'MACD Signal',  value: fmt(indicators?.macdSignal, 6) },
    { name: 'Histogram',    value: fmt(indicators?.histogram, 6), color: indicators?.histogram > 0 ? 'var(--accent-long)' : 'var(--accent-short)' },
    { name: 'EMA 9',        value: fmt(indicators?.ema9) },
    { name: 'EMA 21',       value: fmt(indicators?.ema21) },
    { name: 'EMA 50',       value: fmt(indicators?.ema50) },
    { name: 'EMA 200',      value: fmt(indicators?.ema200) },
    { name: 'BB Upper',     value: fmt(indicators?.bbUpper) },
    { name: 'BB Lower',     value: fmt(indicators?.bbLower) },
    { name: 'ATR (14)',     value: fmt(indicators?.atr, 6) },
    { name: 'Vol Ratio',    value: `${fmt(indicators?.volRatio, 2)}x`, color: indicators?.volRatio > 2 ? 'var(--accent-gold)' : 'var(--text-primary)' },
  ]

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" role="dialog" aria-label={`Signal detail for ${symbol}`}>
        <div className="modal-header">
          <div>
            <div className="modal-symbol">{symbol} <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>· {interval}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {timestamp ? new Date(timestamp).toLocaleString() : ''}
            </div>
          </div>
          <button id="modal-close-btn" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {/* Score + Direction row */}
          <div className="modal-score-row">
            <ScoreGauge score={score} size={88} />
            <div>
              <span className={`direction-badge ${direction}`} style={{ fontSize: 14, padding: '5px 14px' }}>{direction}</span>
              <div className={`confidence-chip ${confidence}`} style={{ marginTop: 8 }}>{confidence} CONFIDENCE</div>
              <div style={{ fontSize: 13, marginTop: 10, color: 'var(--text-secondary)' }}>
                Price: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>${fmt(price)}</strong>
                <span style={{ marginLeft: 10 }} className={`card-change ${changePos ? 'pos' : 'neg'}`}>
                  {changePos ? '+' : ''}{priceChange?.toFixed(2)}%
                </span>
              </div>
            </div>

            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div className="level-item" style={{ marginBottom: 6 }}>
                <div className="level-label">Entry</div>
                <div className="level-value entry">${fmt(entry)}</div>
              </div>
              <div className="level-item" style={{ marginBottom: 6 }}>
                <div className="level-label">Stop Loss</div>
                <div className="level-value sl">
                  ${fmt(stopLoss)}
                  <span style={{ fontSize: 10, color: 'var(--accent-short)', marginLeft: 6 }}>-{slDist.toFixed(2)}%</span>
                </div>
              </div>
              <div className="level-item" style={{ marginBottom: 6 }}>
                <div className="level-label">TP 1 / TP 2</div>
                <div className="level-value tp">
                  ${fmt(valTP1)} <span style={{ fontSize: 10, color: 'var(--accent-long)' }}>+{tp1Dist.toFixed(2)}%</span> / 
                  ${fmt(valTP2)} <span style={{ fontSize: 10, color: 'var(--accent-long)' }}>+{tp2Dist.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Indicator grid */}
          <div className="indicator-grid">
            {indItems.map(({ name, value, color }) => (
              <div key={name} className="ind-cell">
                <div className="ind-name">{name}</div>
                <div className="ind-value" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Breakdown bars */}
          {breakdown && (
            <div className="breakdown-bars">
              <div className="breakdown-title">Score Breakdown</div>
              {Object.entries(BREAKDOWN_LABELS).map(([key, label]) => {
                const raw  = breakdown[key] ?? 0
                const weight = BREAKDOWN_WEIGHTS[key]
                const contrib = (raw * weight / 100).toFixed(1)
                return (
                  <div key={key} className="bar-row">
                    <span className="bar-name">{label} <span style={{ color: 'var(--text-muted)' }}>({weight}%)</span></span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${raw}%`, background: barColor(raw) }} />
                    </div>
                    <span className="bar-pct">+{contrib}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
