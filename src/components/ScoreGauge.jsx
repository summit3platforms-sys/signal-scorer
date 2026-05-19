import { useMemo, useRef, useEffect } from 'react'

function scoreColor(score) {
  if (score >= 75) return '#00e5a0'
  if (score >= 50) return '#3b82f6'
  if (score >= 25) return '#f5c518'
  return '#ff4d6d'
}

export default function ScoreGauge({ score = 0, size = 72 }) {
  const r       = (size / 2) - 6
  const circ    = 2 * Math.PI * r
  const fillRef = useRef(null)
  const color   = useMemo(() => scoreColor(score), [score])

  useEffect(() => {
    if (!fillRef.current) return
    // Start fully hidden, animate to target
    const offset = circ - (score / 100) * circ
    fillRef.current.style.strokeDashoffset = offset
  }, [score, circ])

  return (
    <div className="gauge-wrap" style={{ width: size, height: size }}>
      <svg className="gauge-svg" viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="gauge-track"
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={5}
        />
        <circle
          ref={fillRef}
          className="gauge-fill"
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={5}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={circ}
          strokeLinecap="round"
        />
      </svg>
      <div className="gauge-center">
        <span className="gauge-number" style={{ color }}>{score}</span>
        <span className="gauge-label">SCORE</span>
      </div>
    </div>
  )
}
