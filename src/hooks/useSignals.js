import { useState, useEffect, useCallback, useRef } from 'react'

const POLL_INTERVAL = 30_000 // 30s UI refresh

export function useSignals({ direction = 'ALL', minScore = 0, interval = '5m' } = {}) {
  const [signals, setSignals] = useState([])
  const [meta, setMeta]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const timerRef = useRef(null)

  const fetchSignals = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ direction, minScore, limit: 200 })
      const res  = await fetch(`/api/signals?${params}`)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setSignals(data.signals ?? [])
      setMeta(data.meta ?? null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [direction, minScore])

  const rescan = useCallback(async () => {
    setMeta(m => m ? { ...m, status: 'scanning' } : { status: 'scanning' })
    await fetch('/api/signals/rescan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval }),
    })
    // Poll more aggressively right after rescan
    setTimeout(() => fetchSignals(true), 5000)
    setTimeout(() => fetchSignals(true), 15000)
  }, [interval, fetchSignals])

  useEffect(() => {
    fetchSignals()
    timerRef.current = setInterval(() => fetchSignals(true), POLL_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [fetchSignals])

  return { signals, meta, loading, error, refetch: fetchSignals, rescan }
}
