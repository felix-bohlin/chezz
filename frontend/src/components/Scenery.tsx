import { useEffect, useMemo, useRef } from 'react'
import { drawScenery } from '../pixel/scenery'

const PETALS = 26

export function Scenery() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) drawScenery(canvas.current)
  }, [])

  const petals = useMemo(
    () =>
      Array.from({ length: PETALS }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${-((i * 1.7) % 14)}s`,
        duration: `${10 + ((i * 3) % 9)}s`,
        size: i % 3 === 0 ? 6 : 4,
        drift: `${(i % 2 ? 1 : -1) * (40 + ((i * 13) % 80))}px`,
      })),
    [],
  )

  return (
    <div className="scenery" aria-hidden="true">
      <canvas ref={canvas} className="scenery-canvas" />
      <div className="scenery-shade" />
      {petals.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            ['--drift' as string]: p.drift,
          }}
        />
      ))}
    </div>
  )
}
