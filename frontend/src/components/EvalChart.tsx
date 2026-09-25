import type { GameMove } from '../types/game'

interface Props {
  moves: GameMove[]
  ply: number
  onSeek: (ply: number) => void
}

const CAP = 1000

export function EvalChart({ moves, ply, onSeek }: Props) {
  const n = Math.max(1, moves.length)
  let last = 0
  const values = moves.map((m) => {
    if (m.evalCp !== null) last = Math.max(-CAP, Math.min(CAP, m.evalCp))
    return last
  })

  return (
    <div className="eval-chart" role="img" aria-label="Evaluation over the game (White's point of view)">
      <svg
        viewBox={`0 0 ${n} 100`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onSeek(Math.min(n, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * n))))
        }}
      >
        <rect x="0" y="0" width={n} height="50" className="eval-bg-top" />
        <rect x="0" y="50" width={n} height="50" className="eval-bg-bottom" />
        {values.map((v, i) => {
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
      <div className="eval-legend">
        <span>白 White ahead</span>
        <span>赤 Black ahead</span>
      </div>
    </div>
  )
}
