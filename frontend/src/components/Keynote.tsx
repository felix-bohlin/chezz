import { useCallback, useEffect, type ReactNode } from 'react'
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
}

const go = (i: number) => (window.location.hash = `#/keynote/${i}`)

/** A left-to-right chain of labelled boxes: the pipeline diagrams on the loop and architecture slides. */
function Flow({ steps, loop }: { steps: { k: string; v: string }[]; loop?: boolean }) {
  return (
    <div className={`kn-flow${loop ? ' kn-flow-loop' : ''}`}>
      {steps.map((s, i) => (
        <div key={s.k} className="kn-flow-step">
          <div className="kn-box">
            <strong>{s.k}</strong>
            <span>{s.v}</span>
          </div>
          {i < steps.length - 1 && <span className="kn-arrow" aria-hidden="true">▶</span>}
        </div>
      ))}
      {loop && <div className="kn-loopback">↺ repeat until the goal is met</div>}
    </div>
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
          <span>highest Stockfish Elo beaten</span>
        </div>
        <div className="kn-stat">
          <b>{m.games.length}</b>
          <span>
            battles · W {wins} / D {draws} / L {losses}
          </span>
        </div>
        <div className="kn-stat">
          <b>{m.nextElo}</b>
          <span>next rung</span>
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
        <i className="kn-us" /> win <i className="kn-draw" /> draw <i className="kn-stockfish" /> loss · click a bar to
        replay it
      </p>
    </>
  )
}

const SLIDES: Slide[] = [
  {
    kicker: 'Chezz: Total War',
    title: 'Beating Stockfish with Claude Code',
    body: () => (
      <>
        <p className="kn-lead">
          We built a chess engine from scratch, pitted it against Stockfish 19, and turned every game into a
          replayable pixel-art battle.
        </p>
        <p className="kn-big">
          Rust engine <em>Musashi</em> · Python arena · React replay app
        </p>
        <p className="kn-dim">Built in about two days, pairing with Claude Code the whole way.</p>
      </>
    ),
  },
  {
    kicker: 'The challenge',
    title: 'Four rules, no exceptions',
    body: () => (
      <ul className="kn-cards">
        <li>
          <b>5 s</b> thinking per move, for both sides
        </li>
        <li>
          <b>UCI_Elo</b> is the only knob on Stockfish's strength
        </li>
        <li>
          <b>Legal</b> moves only, every single time
        </li>
        <li>
          <b>Replay</b>: every game is saved and watchable
        </li>
      </ul>
    ),
  },
  {
    kicker: 'The scoreboard',
    title: 'Climbing the ladder',
    body: (m) => <Ladder m={m} />,
  },
  {
    kicker: 'How we used Claude Code · 1',
    title: 'CLAUDE.md is the spec',
    body: () => (
      <>
        <p className="kn-lead">
          One file tells every session (and every sub-agent) what we're building, what the rules are and how
          to check them.
        </p>
        <ul className="kn-points">
          <li>
            <b>Contract first:</b> the <code>games/*.json</code> format lets backend and frontend work in parallel
            without talking to each other.
          </li>
          <li>
            <b>Commands, not prose:</b> build, play, analyze, verify, each one a single copy-paste line.
          </li>
          <li>
            <b>Rules as tests:</b> each competition rule points to the script that proves we keep it.
          </li>
        </ul>
      </>
    ),
  },
  {
    kicker: 'How we used Claude Code · 2',
    title: 'The ladder loop',
    body: () => (
      <>
        <Flow
          loop
          steps={[
            { k: 'Play', v: 'a game at the next Elo' },
            { k: 'Verify', v: 'every move legal, ≤ 5 s' },
            { k: 'Analyze', v: 'Stockfish post-mortem + 2 agents' },
            { k: 'Improve', v: 'one small engine change' },
            { k: 'Gate', v: 'selfplay vs baseline ≥ 40 %' },
          ]}
        />
        <p className="kn-lead">
          <code>/loop /ladder-cycle</code> under a <code>/goal</code>: Claude runs the whole cycle unattended.
          All state lives on disk, so each lap starts with a fresh, cheap context.
        </p>
      </>
    ),
  },
  {
    kicker: 'How we used Claude Code · 3',
    title: 'A small team of specialists',
    body: () => (
      <div className="kn-agents">
        <div className="kn-agent">
          <b>shogun-sensei</b>
          <span>Chess master. Reads the game and names the chess ideas we got wrong.</span>
        </div>
        <div className="kn-agent">
          <b>engine-smith</b>
          <span>Engine developer. Maps each error onto the Rust code and ranks fixes by expected Elo.</span>
        </div>
        <div className="kn-agent">
          <b>skeptics</b>
          <span>A workflow checks every suggestion against the real source before we act on it.</span>
        </div>
        <p className="kn-dim kn-span">
          Skills package the recipes (<code>analyze-game</code>, <code>ladder-cycle</code>). Analysis runs on
          small models and gets file paths plus a compact report, never whole games pasted in.
        </p>
      </div>
    ),
  },
  {
    kicker: 'How we used Claude Code · 4',
    title: 'Trust, but verify',
    body: () => (
      <ul className="kn-points">
        <li>
          <b>Legality in 4 layers:</b> shakmaty's move generator → python-chess → a replay check on every save →
          a fuzzer over edge cases.
        </li>
        <li>
          <b>Time:</b> the engine caps itself at 4.7 s, and <code>timecheck.py</code> fails any move over 4.85 s.
          Our one breach (5001 ms, game 3) is on record, not hidden.
        </li>
        <li>
          <b>No silent regressions:</b> every change is played against the previous build before it's kept.
          Losers get reverted and written down.
        </li>
        <li>
          <b>Traceable:</b> each engine change bumps the version, which is stamped into every game it plays.
        </li>
      </ul>
    ),
  },
  {
    kicker: 'Architecture',
    title: 'Three processes, one folder',
    body: () => (
      <>
        <Flow
          steps={[
            { k: 'musashi', v: 'Rust UCI engine' },
            { k: 'runner.py', v: 'referee · python-chess' },
            { k: 'games/', v: 'JSON + analysis.md' },
            { k: 'React app', v: 'reads games/ directly' },
          ]}
        />
        <ul className="kn-points">
          <li>The runner talks UCI to both engines, times each move by wall clock and writes one JSON per game.</li>
          <li>
            A tiny Vite plugin serves <code>games/</code> as static files: <b>no API server</b>, no database.
          </li>
          <li>
            A <code>live.json</code> heartbeat lets the app show the game that's being played right now.
          </li>
        </ul>
      </>
    ),
  },
  {
    kicker: 'Architecture · the engine',
    title: 'Inside Musashi',
    body: () => (
      <div className="kn-cols">
        <div>
          <h3>Search</h3>
          <p>
            Alpha-beta with iterative deepening, a transposition table and Lazy SMP threads. Null-move pruning,
            late-move reductions, quiescence, SEE, killer / history / counter-move ordering.
          </p>
        </div>
        <div>
          <h3>Evaluation</h3>
          <p>
            Tapered PeSTO tables plus pawn structure, passed pawns, king safety, mobility and rooks on open files.
            Contempt so we don't settle for draws.
          </p>
        </div>
        <div>
          <h3>Ours vs borrowed</h3>
          <p>
            Only move generation is a library (shakmaty). Search and eval are about 1,600 lines of our own Rust,
            tuned game by game.
          </p>
        </div>
      </div>
    ),
  },
  {
    kicker: 'Architecture · the replay',
    title: 'No chess logic in the frontend',
    body: () => (
      <ul className="kn-points">
        <li>
          Every move carries <code>fenAfter</code>, so the board just draws what it's told.
        </li>
        <li>
          <b>Pixel art in code:</b> sprites, scenery and the hermit are drawn on canvas. There are no image files.
        </li>
        <li>
          <b>Generative audio:</b> the music reacts to the evaluation swing.
        </li>
        <li>
          <b>A story layer:</b> the pieces talk, and the sensei comments on blunders and brilliancies straight from
          the analysis file.
        </li>
        <li>
          <b>Fair-play page:</b> the browser replays every game with a third move generator.
        </li>
      </ul>
    ),
  },
  {
    kicker: 'Takeaways',
    title: 'What made it work',
    body: () => (
      <ol className="kn-takeaways">
        <li>Write the contract down first; let agents work on either side of it.</li>
        <li>Keep state in files, not in the chat, so loops can run for hours.</li>
        <li>One change per cycle, gated by an automatic test.</li>
        <li>Give each agent one job and a small context, and verify what it claims.</li>
        <li>Make the rules executable. A script that fails beats a guideline.</li>
      </ol>
    ),
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
          正 Fair play audit
        </a>
      </div>
    ),
  },
]

export function Keynote({ manifest, slide }: Props) {
  const i = Math.min(Math.max(slide, 0), SLIDES.length - 1)
  const s = SLIDES[i]
  const step = useCallback((d: number) => go(Math.min(Math.max(i + d, 0), SLIDES.length - 1)), [i])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) step(1)
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) step(-1)
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(SLIDES.length - 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [step])

  return (
    <section className="keynote" aria-roledescription="slide deck">
      <article key={i} className="px-panel kn-slide" aria-roledescription="slide" aria-label={`${i + 1} of ${SLIDES.length}`}>
        <div className="kn-kicker">{s.kicker}</div>
        <h2 className="kn-title">{s.title}</h2>
        <div className="kn-body">{s.body(manifest)}</div>
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
        <button className="px-btn" onClick={() => step(1)} disabled={i === SLIDES.length - 1} aria-label="Next slide">
          ▶
        </button>
      </nav>
      <p className="kn-hint">← → or space to move · {i + 1} / {SLIDES.length}</p>
    </section>
  )
}
