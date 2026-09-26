import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { hermitNosebleedUrl, hermitUrl } from '../pixel/render'
import type { Manifest } from '../types/game'

interface Props {
  manifest: Manifest | null
  /** 0-based slide index from the route (#/keynote/N). */
  slide: number
}

interface Slide {
  kicker: string
  title: string
  body: (m: Manifest | null) => ReactNode
  /** What Master Roshi says on this slide. */
  roshi: (m: Manifest | null) => string
  /** Roshi is overwhelmed: nosebleed. */
  bleed?: boolean
}

const go = (i: number) => (window.location.hash = `#/keynote/${i}`)

/** A left-to-right chain of labelled boxes: the pipeline diagrams on the loop and architecture slides. */
function Flow({ steps, loop }: { steps: [string, string][]; loop?: boolean }) {
  return (
    <div className="kn-flow">
      {steps.map(([k, v], i) => (
        <div key={k} className="kn-flow-step">
          <div className="kn-box">
            <strong>{k}</strong>
            <span>{v}</span>
          </div>
          {i < steps.length - 1 && (
            <span className="kn-arrow" aria-hidden="true">
              ▶
            </span>
          )}
        </div>
      ))}
      {loop && <div className="kn-loopback">↺ and again, until the goal is met</div>}
    </div>
  )
}

/** Big-word cards: one fact each. */
function Cards({ items }: { items: [string, string][] }) {
  return (
    <ul className="kn-cards">
      {items.map(([k, v]) => (
        <li key={k}>
          <b>{k}</b>
          {v}
        </li>
      ))}
    </ul>
  )
}

function Ladder({ m }: { m: Manifest | null }) {
  if (!m) return <p className="kn-dim">Loading the campaign…</p>
  const wins = m.games.filter((g) => g.winner === 'us').length
  const draws = m.games.filter((g) => g.winner === 'draw').length
  const losses = m.games.length - wins - draws
  const max = Math.max(...m.games.map((g) => g.stockfishElo), 1)
  return (
    <>
      <div className="kn-stats">
        <div className="kn-stat">
          <b>{m.highestWin ?? '—'}</b>
          <span>highest Elo beaten</span>
        </div>
        <div className="kn-stat">
          <b>
            {wins}–{draws}–{losses}
          </b>
          <span>wins · draws · losses</span>
        </div>
      </div>
      <div className="kn-bars" role="img" aria-label="Stockfish Elo of every game, coloured by result">
        {m.games.map((g) => (
          <a
            key={g.id}
            href={`#/game/${g.id}`}
            className={`kn-bar kn-${g.winner}`}
            style={{ height: `${(g.stockfishElo / max) * 100}%` }}
            title={`#${g.id} vs ${g.stockfishElo}: ${g.winner === 'us' ? 'win' : g.winner === 'draw' ? 'draw' : 'loss'}`}
          >
            <span>{g.stockfishElo}</span>
          </a>
        ))}
      </div>
      <p className="kn-legend">
        <i className="kn-us" /> win <i className="kn-draw" /> draw <i className="kn-stockfish" /> loss
      </p>
    </>
  )
}

const SLIDES: Slide[] = [
  {
    kicker: 'Chezz: Total War',
    title: 'Beating Stockfish with Claude Code',
    body: () => (
      <p className="kn-lead">
        Our own chess engine vs Stockfish 19.
        <br />
        Every game replayable as a pixel-art battle.
      </p>
    ),
    roshi: () => 'So… you wish to defeat the machine? Hohoho!',
  },
  {
    kicker: 'The mission',
    title: 'Four rules',
    body: () => (
      <Cards
        items={[
          ['5 s', 'per move, both sides'],
          ['Elo', 'the only knob on Stockfish'],
          ['Legal', 'every single move'],
          ['Replay', 'every game, on a board'],
        ]}
      />
    ),
    roshi: () => 'Rules are like my turtle shell. Heavy, but they make you strong.',
  },
  {
    kicker: 'The result',
    title: 'Climbing the ladder',
    body: (m) => <Ladder m={m} />,
    roshi: (m) =>
      m?.highestWin ? `Stockfish at ${m.highestWin}… defeated?! My nose…` : 'Hmm, where did I put the scoreboard…',
    bleed: true,
  },
  {
    kicker: 'Claude Code · 1',
    title: 'CLAUDE.md is the spec',
    body: () => (
      <Cards
        items={[
          ['Contract', 'games/*.json splits backend and frontend'],
          ['Commands', 'one line each: build, play, check'],
          ['Rules', 'each one backed by a script'],
        ]}
      />
    ),
    roshi: () => 'Write it down once. Never explain it again.',
  },
  {
    kicker: 'Claude Code · 2',
    title: 'The training loop',
    body: () => (
      <>
        <Flow
          loop
          steps={[
            ['Play', 'next Elo'],
            ['Check', 'legal, ≤ 5 s'],
            ['Analyze', 'what went wrong'],
            ['Improve', 'one change'],
            ['Test', 'vs last build'],
          ]}
        />
        <p className="kn-lead">
          <code>/loop /ladder-cycle</code> runs it unattended.
        </p>
      </>
    ),
    roshi: () => 'Deliver the milk, plough the field, repeat. That is the Turtle School way.',
  },
  {
    kicker: 'Claude Code · 3',
    title: 'Specialist agents',
    body: () => (
      <Cards
        items={[
          ['Sensei', 'the chess coach: what went wrong'],
          ['Smith', 'the engine dev: which code to fix'],
          ['Skeptics', 'check every claim against the code'],
        ]}
      />
    ),
    roshi: () => 'A master needs good students. And he checks their homework.',
  },
  {
    kicker: 'Claude Code · 4',
    title: 'Trust, but verify',
    body: () => (
      <Cards
        items={[
          ['4×', 'independent legality checks'],
          ['4.7 s', 'hard cap, well under 5 s'],
          ['Gate', 'worse than last build? reverted'],
          ['v0.1.x', 'stamped on every game'],
        ]}
      />
    ),
    roshi: () => 'A trick that looks like a win is still a trick.',
  },
  {
    kicker: 'Architecture',
    title: 'Just files',
    body: () => (
      <>
        <Flow
          steps={[
            ['Engine', 'Rust'],
            ['Referee', 'Python'],
            ['games/', 'JSON'],
            ['Replay', 'React'],
          ]}
        />
        <p className="kn-lead">No API server. No database.</p>
      </>
    ),
    roshi: () => 'No server, no database. Very zen.',
  },
  {
    kicker: 'Architecture',
    title: 'Inside the engine',
    body: () => (
      <Cards
        items={[
          ['Search', 'alpha-beta on every core'],
          ['Eval', 'pawns, king safety, activity'],
          ['Ours', 'only move generation is a library'],
        ]}
      />
    ),
    roshi: () => 'Read the opponent five moves ahead. Or twenty. Rust is fast.',
  },
  {
    kicker: 'Architecture',
    title: 'Inside the replay',
    body: () => (
      <Cards
        items={[
          ['Dumb board', 'each move carries its position'],
          ['Pixel art', 'drawn in code, zero images'],
          ['Story', 'talking pieces, reactive music'],
        ]}
      />
    ),
    roshi: () => 'And yes, I comment on every blunder. Someone has to.',
  },
  {
    kicker: 'Takeaways',
    title: 'What worked',
    body: () => (
      <ol className="kn-takeaways">
        <li>Contract first</li>
        <li>State in files, not chat</li>
        <li>One change, one test</li>
        <li>Small agents, verified</li>
      </ol>
    ),
    roshi: () => 'Four lessons. Easier than the Kamehameha.',
  },
  {
    kicker: '終',
    title: 'Go watch the battles',
    body: () => (
      <div className="kn-end">
        <a className="px-btn px-btn-primary" href="#/">
          ▶ Open the campaign
        </a>
        <a className="px-btn" href="#/about">
          正 Fair play
        </a>
      </div>
    ),
    roshi: () => 'Class dismissed. Now, where are my magazines…',
  },
]

export function Keynote({ manifest, slide }: Props) {
  const i = Math.min(Math.max(slide, 0), SLIDES.length - 1)
  const s = SLIDES[i]
  const root = useRef<HTMLElement>(null)
  const [full, setFull] = useState(false)
  const step = useCallback((d: number) => go(Math.min(Math.max(i + d, 0), SLIDES.length - 1)), [i])

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else root.current?.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) step(1)
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) step(-1)
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(SLIDES.length - 1)
      else if (e.key === 'f' || e.key === 'F') toggleFull()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [step, toggleFull])

  return (
    <section ref={root} className={`keynote${full ? ' kn-full' : ''}`} aria-roledescription="slide deck">
      <article
        key={i}
        className="px-panel kn-slide"
        aria-roledescription="slide"
        aria-label={`${i + 1} of ${SLIDES.length}`}
      >
        <div className="kn-kicker">{s.kicker}</div>
        <h2 className="kn-title">{s.title}</h2>
        <div className="kn-body">{s.body(manifest)}</div>
        <figure className="kn-roshi">
          <blockquote className="kn-bubble">{s.roshi(manifest)}</blockquote>
          <div className="kn-roshi-sprite">
            <img src={hermitUrl()} alt="Master Roshi" draggable={false} />
            {s.bleed && <img className="kn-bleed" src={hermitNosebleedUrl()} alt="" draggable={false} />}
          </div>
        </figure>
      </article>
      <nav className="kn-nav">
        <button className="px-btn" onClick={() => step(-1)} disabled={i === 0} aria-label="Previous slide">
          ◀
        </button>
        <div className="kn-dots">
          {SLIDES.map((x, j) => (
            <button
              key={j}
              className={`kn-dot${j === i ? ' active' : ''}`}
              onClick={() => go(j)}
              aria-label={`Slide ${j + 1}: ${x.title}`}
              aria-current={j === i}
            />
          ))}
        </div>
        <button
          className="px-btn"
          onClick={() => step(1)}
          disabled={i === SLIDES.length - 1}
          aria-label="Next slide"
        >
          ▶
        </button>
        <button className="px-btn" onClick={toggleFull} aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}>
          {full ? '⤡' : '⤢'}
        </button>
      </nav>
      {!full && (
        <p className="kn-hint">
          ← → or space to move · F for fullscreen · {i + 1} / {SLIDES.length}
        </p>
      )}
    </section>
  )
}
