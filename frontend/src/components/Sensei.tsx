import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { HERMIT_FRAMES, type HermitFrame } from '../pixel/hermit'
import { hermitFrameUrl, hermitNosebleedUrl } from '../pixel/render'
import { KIND_LABEL, SENSEI_NAME, type SenseiSpeech } from '../story/sensei'

interface Props {
  /** What he says at the current ply; undefined = he paces (or naps) along the bottom of the screen. */
  speech?: SenseiSpeech
  /** The ply of a checkmate being shown (undefined otherwise): he answers it with a Kamehameha. */
  mate?: number
}

/** jolt / dangle / fall / dazed: being poked, picked up by the collar, dropped, and coming to. */
type Mode = 'walk' | 'stand' | 'nap' | 'speak' | 'jolt' | 'dangle' | 'fall' | 'dazed'

interface Pose {
  mode: Mode
  /** Left edge of the walker in viewport px (the walk target while walking). */
  x: number
  /** Height above his patch of floor in px (only while dangling or falling). */
  y: number
  /** 1 = as drawn (staff on the left, so he faces left); -1 = mirrored. */
  face: 1 | -1
  /** How long this pose lasts: the walk or fall duration, or the idle time before the next move. */
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
const JOLT_MS = 650
const DAZED_MS = 2600
const DRAG_PX = 4
const GRAVITY = 2600 // px per second², for the drop
const BLAST_MS = 3200 // charge 1100 ms, beam 2000 ms, fade

/** Interaction poses: they run their course, then settle into speaking or standing. */
const HANDLED: ReadonlySet<Mode> = new Set(['jolt', 'dangle', 'fall', 'dazed'])

const FRAMES = Object.keys(HERMIT_FRAMES) as HermitFrame[]

function between([lo, hi]: [number, number]): number {
  return lo + Math.random() * (hi - lo)
}

/** Layout width without the scrollbar (100vw and innerWidth include it on Windows). */
function viewportWidth(): number {
  return document.documentElement.clientWidth
}

/** Where his feet touch down: the walker's top edge when standing on the bottom of the screen. */
function groundTop(el: HTMLElement): number {
  return document.documentElement.clientHeight - 6 - el.offsetHeight
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pawns(cp: number): string {
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`
}

/**
 * The hermit paces the bottom edge of the screen, dozes off now and then, and jumps up with a speech
 * bubble whenever the replay lands on a move he has something to say about. Poke him and he jolts
 * (awake, if he was napping); drag him and he dangles, legs kicking; let go and he drops, dazed. A
 * checkmate gets a Kamehameha across the screen.
 */
export function Sensei({ speech, mate }: Props) {
  const walkerRef = useRef<HTMLDivElement>(null)
  const [vw, setVw] = useState(viewportWidth)
  const [pose, setPose] = useState<Pose>(() => ({
    mode: speech ? 'speak' : 'stand',
    x: Math.max(EDGE, (viewportWidth() - FALLBACK_W) / 2),
    y: 0,
    face: 1,
    ms: between(STAND_MS),
    seq: 0,
  }))

  const [held, setHeld] = useState(false)
  const [tilt, setTilt] = useState(0)
  const [blast, setBlast] = useState<{ seq: number; dir: 'left' | 'right' } | null>(null)
  const grab = useRef<{ sx: number; sy: number; offX: number; offY: number; lastX: number; dragging: boolean } | null>(
    null,
  )
  const unswing = useRef<ReturnType<typeof setTimeout>>(undefined)
  const speechRef = useRef(speech)
  useEffect(() => {
    speechRef.current = speech
  }, [speech])

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
      // Mid-poke or mid-air he finishes that first, then picks the speech up (speechRef).
      if (HANDLED.has(p.mode)) return p
      const x = here ?? p.x
      return speech
        ? { ...p, mode: 'speak', x, ms: 0, seq: p.seq + 1 }
        : { ...p, mode: 'stand', x, ms: between(AFTER_SPEECH_MS), seq: p.seq + 1 }
    })
  }, [speech, range])

  // The idle life: stand → walk to the far half → stand or nap → ... One timer per pose, cleared on change.
  useEffect(() => {
    if (held || pose.mode === 'speak' || pose.mode === 'dangle') return
    if (reducedMotion() && !HANDLED.has(pose.mode)) return
    const t = setTimeout(() => {
      setPose((p) => {
        if (p.mode === 'speak' || p.mode === 'dangle') return p
        if (p.mode === 'fall') return { ...p, mode: 'dazed', y: 0, ms: DAZED_MS, seq: p.seq + 1 }
        if (p.mode === 'jolt' || p.mode === 'dazed') {
          return speechRef.current
            ? { ...p, mode: 'speak', ms: 0, seq: p.seq + 1 }
            : { ...p, mode: 'stand', ms: between(STAND_MS), seq: p.seq + 1 }
        }
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
        return { ...p, mode: 'walk', x: target, face: target > p.x ? -1 : 1, ms, seq: p.seq + 1 }
      })
    }, pose.ms)
    return () => clearTimeout(t)
  }, [pose, held, range])

  // Checkmate: turn to the wider side of the screen, charge, and fire the beam across it.
  useLayoutEffect(() => {
    if (mate === undefined || reducedMotion()) return
    const el = walkerRef.current
    const w = el?.offsetWidth || FALLBACK_W
    const left = el ? el.getBoundingClientRect().left : (viewportWidth() - w) / 2
    const dir = left + w / 2 < viewportWidth() / 2 ? 'right' : 'left'
    setBlast({ seq: mate, dir })
    setPose((p) => (HANDLED.has(p.mode) ? p : { ...p, face: dir === 'right' ? -1 : 1 }))
    const t = setTimeout(() => setBlast(null), BLAST_MS)
    return () => {
      clearTimeout(t)
      setBlast(null)
    }
  }, [mate])

  useEffect(() => () => clearTimeout(unswing.current), [])

  // Poke: he freezes where he is and jolts (awake, if he was napping). The drag starts past DRAG_PX.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = walkerRef.current
    if (!el || e.button !== 0) return
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    grab.current = {
      sx: e.clientX,
      sy: e.clientY,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      lastX: e.clientX,
      dragging: false,
    }
    const x = range().clamp(rect.left)
    const y = Math.max(0, groundTop(el) - rect.top)
    setHeld(true)
    setPose((p) => ({ ...p, mode: y > 0 ? 'dangle' : 'jolt', x, y, ms: JOLT_MS, seq: p.seq + 1 }))
  }

  // Held by the collar: he follows the pointer and swings behind it.
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grab.current
    const el = walkerRef.current
    if (!g || !el) return
    if (!g.dragging && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < DRAG_PX) return
    g.dragging = true
    const x = range().clamp(e.clientX - g.offX)
    const ground = groundTop(el)
    const y = Math.min(ground, Math.max(0, ground - (e.clientY - g.offY)))
    const vx = e.clientX - g.lastX
    g.lastX = e.clientX
    setTilt(Math.max(-35, Math.min(35, vx * 1.6)))
    clearTimeout(unswing.current)
    unswing.current = setTimeout(() => setTilt(0), 90)
    setPose((p) => (p.mode === 'dangle' ? { ...p, x, y } : { ...p, mode: 'dangle', x, y, ms: 0, seq: p.seq + 1 }))
  }

  // Let go: he drops back to the floor and comes to, confused. A plain click just lets the jolt play out.
  const onPointerUp = () => {
    const g = grab.current
    if (!g) return
    grab.current = null
    clearTimeout(unswing.current)
    setTilt(0)
    setHeld(false)
    setPose((p) => {
      if (p.y > 0) {
        const ms = Math.max(120, Math.sqrt((2 * p.y) / GRAVITY) * 1000)
        return { ...p, mode: 'fall', y: 0, ms, seq: p.seq + 1 }
      }
      return g.dragging ? { ...p, mode: 'dazed', ms: DAZED_MS, seq: p.seq + 1 } : p
    })
  }

  useEffect(() => {
    const onResize = () => {
      setVw(viewportWidth())
      setPose((p) => {
        const x = range().clamp(p.x)
        if (x === p.x || HANDLED.has(p.mode)) return p
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
  const moving = pose.mode === 'walk' || pose.mode === 'fall'
  const beam = blast && pose.mode !== 'dangle' && pose.mode !== 'fall' ? blast : null
  const mark = pose.mode === 'jolt' ? '!' : pose.mode === 'dangle' ? '!!' : pose.mode === 'dazed' ? '?' : null
  const style = {
    '--x': `${pose.x}px`,
    '--y': `${pose.y}px`,
    '--vw': `${vw}px`,
    '--dur': `${moving ? Math.round(pose.ms) : 0}ms`,
    '--face': pose.face,
    '--tilt': `${tilt * pose.face}deg`,
  } as CSSProperties

  return (
    <div className={`roshi roshi-${pose.mode} ${mood}${beam ? ' roshi-blast' : ''}`} style={style}>
      {beam && (
        <div key={beam.seq} className={`roshi-kame roshi-kame-${beam.dir}`} aria-hidden>
          <span className="roshi-beam">
            <span className="roshi-beam-core" />
          </span>
          <span className="roshi-shout">
            {['KA', 'ME', 'HA', 'ME', 'HA!'].map((s, i) => (
              <span key={i} style={{ '--i': i } as CSSProperties}>
                {s}
              </span>
            ))}
          </span>
          <span className="roshi-flash" />
        </div>
      )}
      <div
        ref={walkerRef}
        className="roshi-walker"
        aria-hidden
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
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
            {beam && <span key={beam.seq} className="roshi-orb" />}
          </span>
          {pose.mode === 'dazed' && (
            <span className="roshi-dizzy">
              <span />
              <span />
              <span />
            </span>
          )}
        </span>
        {pose.mode === 'nap' && <span className="roshi-zzz">z z Z</span>}
        {mark && <span className="roshi-mark">{mark}</span>}
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
