import { useEffect, useState } from 'react'
import { loadLive, type LiveState } from '../lib/data'
import type { GameRecord } from '../types/game'
import { ReplayView } from './Replay'

// Fast polling keeps the live think-timer honest: a slow poll keeps it ticking after a move has
// already been played, which looked like >5 s moves.
const POLL_MS = 400

export function useLive(pollMs = POLL_MS): LiveState | null {
  const [live, setLive] = useState<LiveState | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => loadLive().then((s) => alive && setLive(s))
    load()
    const t = setInterval(load, pollMs)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [pollMs])
  return live
}

export function Live() {
  const live = useLive()
  if (!live) return <div className="px-panel notice">Listening for war drums…</div>
  if (!live.active) {
    return (
      <div className="px-panel notice">
        No battle in progress.
        {live.lastGameId && (
          <p>
            <a className="px-btn" href={`#/game/${live.lastGameId}`}>
              Replay the last battle #{live.lastGameId}
            </a>
          </p>
        )}
      </div>
    )
  }
  const game: GameRecord = {
    id: live.id,
    date: live.date,
    stockfishElo: live.stockfishElo,
    stockfishVersion: live.stockfishVersion,
    moveTimeSec: 5,
    ourColor: live.ourColor,
    result: '1/2-1/2',
    winner: 'draw',
    termination: 'in progress',
    engine: live.engine,
    startFen: live.startFen,
    moves: live.moves,
    pgn: '',
  }
  return (
    <ReplayView
      key={live.id}
      game={game}
      initialPly={live.moves.length}
      live
      liveSince={live.turnStartedAt ?? live.updatedAt ?? null}
    />
  )
}
