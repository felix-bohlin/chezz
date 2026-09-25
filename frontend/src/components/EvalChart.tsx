import type { GameMove } from '../types/game'

interface Props {
  moves: GameMove[]
  ply: number
  ourColor: 'white' | 'black'
  onSeek: (ply: number) => void
}

const CAP = 1000
const EVEN_CP = 30

interface Point {
  cp: number
  mate: number | null
}

/**
 * One consistent series: our engine's evaluation (White's POV), carried forward through Stockfish's moves.
 * Mixing in the strength-limited opponent's own evals makes the chart zig-zag between two opinions.
 */
function ourSeries(moves: GameMove[]): Point[] {
  let last: Point = { cp: 0, mate: null }
  return moves.map((m) => {
    if (m.by === 'us' && m.evalCp !== null) last = { cp: m.evalCp, mate: m.mate }
    return last
  })
}

function leaderText(p: Point, ourColor: 'white' | 'black'): { text: string; who: 'us' | 'them' | 'even' } {
  const sign = ourColor === 'white' ? 1 : -1
  const us = p.cp * sign
  const mateUs = p.mate === null ? null : p.mate * sign
  if (mateUs !== null) {
    return mateUs > 0
      ? { text: `Chezz sees mate in ${mateUs}`, who: 'us' }
      : { text: `Stockfish has mate in ${-mateUs}`, who: 'them' }
  }
  if (Math.abs(us) < EVEN_CP) return { text: 'Even position', who: 'even' }
  const pawns = (Math.abs(us) / 100).toFixed(2)
  return us > 0 ? { text: `Chezz ahead · +${pawns}`, who: 'us' } : { text: `Stockfish ahead · +${pawns}`, who: 'them' }
}

export function EvalChart({ moves, ply, ourColor, onSeek }: Props) {
  const n = Math.max(1, moves.length)
  const series = ourSeries(moves)
  const current = ply > 0 ? series[ply - 1] : { cp: 0, mate: null }
  const leader = leaderText(current, ourColor)
  const whiteName = ourColor === 'white' ? 'Chezz' : 'Stockfish'
  const blackName = ourColor === 'white' ? 'Stockfish' : 'Chezz'

  return (
    <div className="eval-chart">
      <div className={`eval-headline eval-${leader.who}`}>{leader.text}</div>
      <div className="eval-plot">
        <svg
          viewBox={`0 0 ${n} 100`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          role="img"
          aria-label={`Evaluation over the game. ${leader.text}`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            onSeek(Math.min(n, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * n))))
          }}
        >
          <rect x="0" y="0" width={n} height="50" className="eval-bg-top" />
          <rect x="0" y="50" width={n} height="50" className="eval-bg-bottom" />
          {series.map((p, i) => {
            const v = Math.max(-CAP, Math.min(CAP, p.cp))
            const h = (Math.abs(v) / CAP) * 48
            return (
              <rect
                key={i}
                x={i}
                width={1.02}
                y={v >= 0 ? 50 - h : 50}
                height={Math.max(h, 0.6)}
                className={v >= 0 ? 'eval-white' : 'eval-black'}
              />
            )
          })}
          <rect x="0" y="49.5" width={n} height="1" className="eval-mid" />
          <rect x={Math.max(0, ply - 0.5)} y="0" width="1" height="100" className="eval-cursor" />
        </svg>
        <span className="eval-label eval-label-top">▲ {whiteName} 白</span>
        <span className="eval-label eval-label-bottom">▼ {blackName} 赤</span>
      </div>
    </div>
  )
}
