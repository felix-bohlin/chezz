import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { HERMIT_FRAMES, type HermitFrame } from '../pixel/hermit'
import { hermitFrameUrl, hermitNosebleedUrl } from '../pixel/render'
import { KIND_LABEL, SENSEI_NAME, type SenseiSpeech } from '../story/sensei'

interface Props {
  /** What he says at the current ply; undefined = he paces (or naps) along the bottom of the screen. */
  speech?: SenseiSpeech
}

type Mode = 'walk' | 'stand' | 'nap' | 'speak'

interface Pose {
  mode: Mode
  /** Left edge of the walker in viewport px (the walk target while walking). */
  x: number
  /** 1 = as drawn (staff on the left, so he faces left); -1 = mirrored. */
  face: 1 | -1
  /** How long this pose lasts: the walk duration, or the idle time before the next move. */
  ms: number
  /** Bumped on every change so a walk→walk with the same fields still reschedules. */
  seq: number
}

const SPEED = 60 // px per second
const EDGE = 8
const FALLBACK_W = 90
const STAND_MS: [number, number] = [700, 1800]
const WAKE_MS: [number, number] = [800, 1200]
const NAP_MS: [number, number] = [7000, 15000]
const AFTER_SPEECH_MS: [number, number] = [900, 1600]
const NAP_CHANCE = 0.3

const FRAMES = Object.keys(HERMIT_FRAMES) as HermitFrame[]

function between([lo, hi]: [number, number]): number {
  return lo + Math.random() * (hi - lo)
}

/** Layout width without the scrollbar (100vw and innerWidth include it on Windows). */
function viewportWidth(): number {
  return document.documentElement.clientWidth
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pawns(cp: number): string {
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`
}

/**
 * The hermit paces the bottom edge of the screen, dozes off now and then, and jumps up with a speech
 * bubble whenever the replay lands on a move he has something to say about.
 */
export function Sensei({ speech }: Props) {
  const walkerRef = useRef<HTMLDivElement>(null)
  const [vw, setVw] = useState(viewportWidth)
  const [pose, setPose] = useState<Pose>(() => ({
    mode: speech ? 'speak' : 'stand',
    x: Math.max(EDGE, (viewportWidth() - FALLBACK_W) / 2),
    face: 1,
    ms: between(STAND_MS),
    seq: 0,
  }))

  const range = useCallback(() => {
    const w = walkerRef.current?.offsetWidth || FALLBACK_W
    const min = EDGE
    const max = Math.max(min, viewportWidth() - w - EDGE)
    return { min, max, clamp: (x: number) => Math.min(max, Math.max(min, x)) }
  }, [])

  // Room for him under the page so the footer stays readable.
  useEffect(() => {
    document.body.classList.add('has-roshi')
    return () => document.body.classList.remove('has-roshi')
  }, [])

  // A verdict arrives: freeze right where he is (mid-stride included) and speak. It passes: stretch, then resume.
  // Layout effect so the frozen position is committed before paint and he never steps back.
  useLayoutEffect(() => {
    const r = range()
    const el = walkerRef.current
    const here = el ? r.clamp(el.getBoundingClientRect().left) : null
    setPose((p) => {
      const x = here ?? p.x
      return speech
        ? { ...p, mode: 'speak', x, ms: 0, seq: p.seq + 1 }
        : { ...p, mode: 'stand', x, ms: between(AFTER_SPEECH_MS), seq: p.seq + 1 }
    })
  }, [speech, range])

  // The idle life: stand → walk to the far half → stand or nap → ... One timer per pose, cleared on change.
  useEffect(() => {
    if (pose.mode === 'speak' || reducedMotion()) return
    const t = setTimeout(() => {
      setPose((p) => {
        if (p.mode === 'speak') return p
        const r = range()
        if (p.mode === 'walk') {
          return Math.random() < NAP_CHANCE
            ? { ...p, mode: 'nap', ms: between(NAP_MS), seq: p.seq + 1 }
            : { ...p, mode: 'stand', ms: between(STAND_MS), seq: p.seq + 1 }
        }
        if (p.mode === 'nap') return { ...p, mode: 'stand', ms: between(WAKE_MS), seq: p.seq + 1 }
        const mid = (r.min + r.max) / 2
        const target = r.clamp(p.x < mid ? between([mid, r.max]) : between([r.min, mid]))
        const ms = Math.max(400, (Math.abs(target - p.x) / SPEED) * 1000)
        return { mode: 'walk', x: target, face: target > p.x ? -1 : 1, ms, seq: p.seq + 1 }
      })
    }, pose.ms)
    return () => clearTimeout(t)
  }, [pose, range])

  useEffect(() => {
    const onResize = () => {
      setVw(viewportWidth())
      setPose((p) => {
        const x = range().clamp(p.x)
        if (x === p.x) return p
        return { ...p, x, mode: p.mode === 'walk' ? 'stand' : p.mode, ms: between(STAND_MS), seq: p.seq + 1 }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [range])

  const n = speech?.note
  const label = n ? KIND_LABEL[n.kind] : null
  const mood = n ? `sensei-${n.kind} sensei-by-${n.by}` : speech ? `sensei-${speech.occasion}` : 'sensei-idle'
  // An exceptional move is simply too much for the old man.
  const nosebleed = n?.kind === 'brilliant'
  const speechKey = speech ? `${speech.ply}-${speech.lineId}` : pose.mode
  const style = {
    '--x': `${pose.x}px`,
    '--vw': `${vw}px`,
    '--dur': `${pose.mode === 'walk' ? Math.round(pose.ms) : 0}ms`,
    '--face': pose.face,
  } as CSSProperties

  return (
    <div className={`roshi roshi-${pose.mode} ${mood}`} style={style}>
      <div ref={walkerRef} className="roshi-walker" aria-hidden>
        <span className="roshi-face">
          <span key={speechKey} className="roshi-figure">
            {FRAMES.map((f) => (
              <img key={f} className={`roshi-f roshi-f-${f}`} src={hermitFrameUrl(f)} alt="" draggable={false} />
            ))}
            {nosebleed && (
              <>
                <img className="roshi-bleed" src={hermitNosebleedUrl()} alt="" draggable={false} />
                <span className="roshi-drop d1" />
                <span className="roshi-drop d2" />
                <span className="roshi-drop d3" />
                <span className="roshi-drop d4" />
              </>
            )}
          </span>
        </span>
        {pose.mode === 'nap' && <span className="roshi-zzz">z z Z</span>}
      </div>
      {speech && (
        <div key={speechKey} className="roshi-say" role="status">
          <span className="roshi-head">
            <span className="roshi-name">{SENSEI_NAME}</span>
            {label && (
              <span className="roshi-kind">
                {label.kanji} {label.word} <b>{label.glyph}</b>
              </span>
            )}
          </span>
          <span className="roshi-text">{speech.text}</span>
          {n && (
            <span className="roshi-meta">
              {n.by === 'us' ? 'Musashi' : 'Stockfish'} {n.san}
              {label!.glyph}
              {(n.kind === 'blunder' || n.kind === 'mistake') && n.best !== '?' && <> · best {n.best}</>} · {pawns(n.before)} →{' '}
              {pawns(n.after)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
