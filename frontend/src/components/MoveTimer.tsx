import { useEffect, useState } from 'react'

/** Recorded times are wall-clock and include a few ms of UCI round-trip on top of the engine's think time. */
export const OVER_TOLERANCE_MS = 50

interface Props {
  /** Finished think time of the side's last move. */
  ms: number | null
  /** Live mode: epoch seconds when this side started thinking; the timer ticks from there. */
  since?: number | null
  limitMs: number
}

export function MoveTimer({ ms, since = null, limitMs }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (since === null) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [since])

  const running = since !== null
  const elapsed = running ? Math.max(0, now - since * 1000) : ms
  // While running, the move may already be played but not yet polled: stop at the limit and show
  // "syncing" rather than counting on. The recorded time of each move is the authoritative number.
  const syncing = running && elapsed !== null && elapsed > limitMs
  const value = syncing ? limitMs : elapsed
  const frac = value === null ? 0 : Math.min(1, value / limitMs)
  const over = !running && value !== null && value > limitMs + OVER_TOLERANCE_MS

  return (
    <div
      className={`timer${running ? ' timer-running' : ''}${over ? ' timer-over' : ''}${syncing ? ' timer-syncing' : ''}`}
      title={running ? 'Thinking…' : 'Recorded think time of the last move (limit 5 s)'}
    >
      <span className="timer-icon" aria-hidden="true">
        ⧗
      </span>
      <span className="timer-bar">
        <span className="timer-fill" style={{ width: `${frac * 100}%` }} />
      </span>
      <span className="timer-value">
        {value === null ? '—' : syncing ? 'sync…' : `${(value / 1000).toFixed(1)}s`}
      </span>
    </div>
  )
}
