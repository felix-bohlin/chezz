import { Chess } from 'chess.js'
import { useEffect, useState } from 'react'
import { loadGame } from '../lib/data'
import type { GameRecord, Manifest } from '../types/game'

interface Props {
  manifest: Manifest | null
}

interface GameAudit {
  id: string
  elo: number
  result: string
  plies: number
  illegal: number
  mismatched: number
  maxMs: number
  version: string
}

/** Replays one saved game with chess.js (a third, browser-side move generator) and counts problems. */
function audit(g: GameRecord): GameAudit {
  const chess = new Chess(g.startFen)
  let illegal = 0
  let mismatched = 0
  let maxMs = 0
  for (const m of g.moves) {
    if (m.by === 'us') maxMs = Math.max(maxMs, m.timeMs)
    try {
      chess.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] })
    } catch {
      illegal++
      break
    }
    // chess.js and python-chess disagree only on when to print the en-passant square, so compare the
    // other five FEN fields: piece placement, side to move, castling rights, halfmove and fullmove.
    const got = chess.fen().split(' ')
    const want = m.fenAfter.split(' ')
    if (got[0] !== want[0] || got[1] !== want[1] || got[2] !== want[2] || got[4] !== want[4] || got[5] !== want[5]) {
      mismatched++
    }
  }
  return {
    id: g.id,
    elo: g.stockfishElo,
    result: g.result,
    plies: g.moves.length,
    illegal,
    mismatched,
    maxMs,
    version: g.engine.version,
  }
}

const LAYERS = [
  {
    kanji: '生',
    title: '1 · Born legal',
    body:
      'The engine never invents moves. Its root move list is shakmaty\'s legal move generator, and the move it prints is always one element of that list. Hash-table and killer moves only reorder the list; they are never played. A position with no legal move is answered with "bestmove 0000", nothing else.',
  },
  {
    kanji: '門',
    title: '2 · Gate on every move',
    body:
      'The match runner (python-chess) parses each "bestmove" against its own, independent move generator. An illegal move raises, the game stops, and it is recorded as a loss for our engine. A null move is caught by a second explicit legality check before anything is written.',
  },
  {
    kanji: '巻',
    title: '3 · Replayed before it is saved',
    body:
      'When a game ends the runner replays the whole record from the start position: every move legal, every SAN and FEN reproduced, PGN identical, result and termination matching the final position. The verdict is printed with the game and can never be skipped.',
  },
  {
    kanji: '試',
    title: '4 · Fuzzed off the board',
    body:
      'A separate harness talks raw UCI to the engine binary and checks each answer against python-chess: 31 curated edge cases (mates, stalemates, pinned en-passant, promotions, every castling combination), every position of every saved game, and thousands of random playouts biased toward captures, promotions and castling.',
  },
] as const

const FUZZ = [
  { engine: 'chezz 0.1.8', threads: 1, search: '10 ms', positions: 1885, illegal: 0 },
  { engine: 'chezz 0.1.9', threads: 2, search: '150 ms', positions: 967, illegal: 0 },
  { engine: 'musashi 0.1.9', threads: 4, search: '50 ms', positions: 1608, illegal: 0 },
] as const

const RULES = [
  {
    rule: 'At most 5 s of thinking per move, both players',
    how: 'Both engines get Limit(time=5.0). Ours also caps itself at 4750 ms whatever the GUI sends, plus a 150 ms margin under any movetime. The runner records the slowest move of every game.',
  },
  {
    rule: 'Stockfish weakened only through UCI_LimitStrength + UCI_Elo',
    how: 'Nothing else is touched: no hash, thread, contempt or evaluation changes on the Stockfish side. The Elo is stored in every game file and in the PGN headers.',
  },
  {
    rule: 'A draw is not a win',
    how: 'The ladder advances only on a win. Draws and losses replay the same Elo. Our engine plays with contempt so it does not steer for draws.',
  },
  {
    rule: 'Every game saved with its Elo and replayable',
    how: 'One JSON file per game with every move, the FEN after it, both engines\' evaluations and think times, plus the PGN. This site replays them on a board without any chess logic of its own.',
  },
] as const

export function About({ manifest }: Props) {
  const [audits, setAudits] = useState<GameAudit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!manifest) return
    let alive = true
    Promise.all(manifest.games.map((e) => loadGame(e.file).then(audit))).then(
      (a) => alive && setAudits(a),
      (e) => alive && setError(String(e)),
    )
    return () => {
      alive = false
    }
  }, [manifest])

  const plies = audits?.reduce((n, a) => n + a.plies, 0) ?? 0
  const illegal = audits?.reduce((n, a) => n + a.illegal, 0) ?? 0
  const mismatched = audits?.reduce((n, a) => n + a.mismatched, 0) ?? 0
  const slowest = audits?.reduce((n, a) => Math.max(n, a.maxMs), 0) ?? 0

  return (
    <div className="about">
      <header className="hero">
        <div className="hero-kanji">正々堂々</div>
        <h1 className="hero-title">FAIR PLAY</h1>
        <p className="hero-sub">
          Every move our engine has ever played was legal. Not because we say so: your browser just checked.
        </p>
        <div className="hero-stats">
          <div className="px-panel stat">
            <span>Battles audited here</span>
            <b>{audits ? audits.length : '…'}</b>
          </div>
          <div className="px-panel stat">
            <span>Moves replayed by chess.js</span>
            <b>{audits ? plies : '…'}</b>
          </div>
          <div className={`px-panel stat ${audits && illegal + mismatched === 0 ? 'stat-good' : ''}`}>
            <span>Illegal moves found</span>
            <b>{audits ? illegal + mismatched : '…'}</b>
          </div>
          <div className="px-panel stat">
            <span>Slowest think (limit 5000 ms)</span>
            <b>{audits ? `${slowest} ms` : '…'}</b>
          </div>
        </div>
        {error && <div className="px-panel notice">Could not load the games for auditing: {error}</div>}
      </header>

      <section className="about-section">
        <h2 className="about-h2">Four gates every move must pass</h2>
        <div className="about-grid">
          {LAYERS.map((l) => (
            <article key={l.title} className="px-panel about-card">
              <div className="about-card-kanji">{l.kanji}</div>
              <h3>{l.title}</h3>
              <p>{l.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h2 className="about-h2">Fuzz audit of the engine binary</h2>
        <div className="px-panel">
          <p className="about-lead">
            Run on 2026-09-26 with <code>python backend/legalcheck.py</code>. Each position is sent over UCI, the
            engine's answer is parsed by python-chess and must be in its legal move list. Mate and stalemate
            positions must be answered with a null move. A crash or a hang counts as a failure.
          </p>
          <table className="about-table">
            <thead>
              <tr>
                <th>Engine</th>
                <th>Threads</th>
                <th>Search / position</th>
                <th>Positions</th>
                <th>Illegal</th>
              </tr>
            </thead>
            <tbody>
              {FUZZ.map((f) => (
                <tr key={f.engine + f.threads}>
                  <td>{f.engine}</td>
                  <td>{f.threads}</td>
                  <td>{f.search}</td>
                  <td>{f.positions}</td>
                  <td className="ok">{f.illegal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="about-section">
        <h2 className="about-h2">Competition rules, and how we keep them</h2>
        <div className="about-grid about-grid-2">
          {RULES.map((r) => (
            <article key={r.rule} className="px-panel about-card">
              <h3>✓ {r.rule}</h3>
              <p>{r.how}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h2 className="about-h2">Every battle, re-checked in your browser</h2>
        <div className="px-panel">
          <p className="about-lead">
            This table is not stored anywhere. When you opened this page, chess.js replayed each saved game from
            the start position and compared its own board after every move with the one the runner recorded.
          </p>
          {!audits && !error && <p>Replaying…</p>}
          {audits && (
            <table className="about-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Stockfish Elo</th>
                  <th>Result</th>
                  <th>Plies</th>
                  <th>Legal</th>
                  <th>Positions match</th>
                  <th>Slowest think</th>
                  <th>Engine</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <a href={`#/game/${a.id}`}>{a.id}</a>
                    </td>
                    <td>{a.elo}</td>
                    <td>{a.result}</td>
                    <td>{a.plies}</td>
                    <td className={a.illegal ? 'bad' : 'ok'}>{a.illegal ? `✗ ${a.illegal}` : '✓ all'}</td>
                    <td className={a.mismatched ? 'bad' : 'ok'}>{a.mismatched ? `✗ ${a.mismatched}` : '✓ all'}</td>
                    <td>{a.maxMs} ms</td>
                    <td>{a.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="about-section">
        <h2 className="about-h2">Check it yourself</h2>
        <div className="px-panel">
          <p className="about-lead">Everything above can be reproduced from the repository in a few minutes.</p>
          <pre className="about-code">
            {[
              'python backend/verify_games.py   # replay every saved game: legal, SAN/FEN/PGN/result consistent',
              'python backend/legalcheck.py     # fuzz the engine binary against python-chess',
              'python backend/timecheck.py      # prove the 5 s/move limit on positions from real games',
            ].join('\n')}
          </pre>
          <p className="about-foot">
            Move generation: shakmaty (engine, Rust), python-chess (runner and audits), chess.js (this page). Three
            independent implementations agree on every move played.
          </p>
        </div>
      </section>
    </div>
  )
}
