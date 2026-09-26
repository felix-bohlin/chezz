import { marked } from 'marked'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gameAudio, getSettings, isMusicPlaying, setSettings, stopMusic } from '../audio'
import { loadAnalysis, loadGame } from '../lib/data'
import { START_FEN, sideToMove } from '../lib/fen'
import { spriteUrl } from '../pixel/render'
import { buildEnding, buildStory, type PlyStory } from '../story/dialogue'
import { ENDING_TITLE } from '../story/intro'
import { buildSensei, KIND_LABEL, parseSenseiNotes } from '../story/sensei'
import type { Bubble, DisplayMode } from '../story/types'
import type { GameRecord, ManifestEntry } from '../types/game'
import { Board } from './Board'
import { EvalChart } from './EvalChart'
import { MoveTimer, OVER_TOLERANCE_MS } from './MoveTimer'
import { Sensei } from './Sensei'

const SPEEDS = [
  { label: '½×', ms: 2000 },
  { label: '1×', ms: 1000 },
  { label: '2×', ms: 500 },
  { label: '4×', ms: 250 },
]

const BUBBLE_MODES: { mode: DisplayMode; label: string }[] = [
  { mode: 'off', label: 'Off' },
  { mode: 'key', label: 'Key' },
  { mode: 'all', label: 'All' },
]
const BUBBLE_MODE_KEY = 'chezz.bubbles'
const SENSEI_KEY = 'chezz.sensei'
/** The battle's title card holds the stage this long before the lords start talking. */
const TITLE_CARD_MS = 5000

function loadBubbleMode(): DisplayMode {
  try {
    const v = localStorage.getItem(BUBBLE_MODE_KEY)
    if (v === 'off' || v === 'key' || v === 'all') return v
  } catch {
    // storage unavailable — use the default
  }
  return 'key'
}

function loadSenseiOn(): boolean {
  try {
    return localStorage.getItem(SENSEI_KEY) !== 'off'
  } catch {
    return true
  }
}

const readOne = (text: string) => Math.min(4000, Math.max(1500, 1200 + 45 * text.length))

/** How long a ply's bubbles need on screen to be read (03 §5): reply starts 600 ms after the primary. */
function readMs(bubbles: Bubble[]): number {
  return bubbles.reduce((ms, b) => Math.max(ms, (b.isReply ? 600 : 0) + readOne(b.text)), 0)
}

function plyAudio(s: PlyStory) {
  return { situation: s.situation ?? undefined, phase: s.phase, material: s.material, kingInDanger: s.kingInDanger }
}

const OUTCOME = {
  us: { kanji: '勝', word: 'Victory' },
  stockfish: { kanji: '敗', word: 'Defeat' },
  draw: { kanji: '分', word: 'Draw' },
} as const

function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null) return `#${mate}`
  if (cp === null) return '—'
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`
}

interface Props {
  entry: ManifestEntry
  initialPly?: number
}

export function Replay({ entry, initialPly = 0 }: Props) {
  const [game, setGame] = useState<GameRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)

  useEffect(() => {
    loadGame(entry.file).then(setGame, (e) => setError(String(e)))
    if (entry.analysis) loadAnalysis(entry.analysis).then(setAnalysis, () => setAnalysis(null))
  }, [entry.file, entry.analysis])

  if (error) return <div className="px-panel notice">Could not load game: {error}</div>
  if (!game) return <div className="px-panel notice">Unrolling the battle scroll…</div>
  return <ReplayView game={game} analysis={analysis} initialPly={Math.min(initialPly, game.moves.length)} />
}

interface ViewProps {
  game: GameRecord
  analysis?: string | null
  initialPly?: number
  /** Live mode: follows new moves as they arrive and doesn't touch the URL. */
  live?: boolean
  /** Live mode: epoch seconds of the last move, i.e. when the side to move started thinking. */
  liveSince?: number | null
}

export function ReplayView({ game, analysis = null, initialPly = 0, live = false, liveSince = null }: ViewProps) {
  const [ply, setPly] = useState(initialPly)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showScroll, setShowScroll] = useState(false)
  const [bubbleMode, setBubbleMode] = useState<DisplayMode>(loadBubbleMode)
  const [senseiOn, setSenseiOn] = useState(loadSenseiOn)
  const [muted, setMuted] = useState(() => getSettings().muted)
  const moveListRef = useRef<HTMLOListElement>(null)
  const prevTotal = useRef(game.moves.length)
  const audioPly = useRef(initialPly)
  // Title card (docs/story/01): shown when a finished game is opened from the start.
  const [titleCard, setTitleCard] = useState(!live && initialPly === 0 && game.moves.length > 0)

  const total = game.moves.length
  const story = useMemo(() => buildStory(game), [game])
  const ending = useMemo(() => buildEnding(game), [game])
  const bubbles = useMemo(() => {
    const all = story[ply]?.bubbles ?? []
    return bubbleMode === 'off' ? [] : bubbleMode === 'key' ? all.filter((b) => b.key) : all
  }, [story, ply, bubbleMode])

  const sensei = useMemo(() => buildSensei(game, parseSenseiNotes(analysis)), [game, analysis])
  const senseiComment = senseiOn ? sensei.get(ply) : undefined

  const toggleSensei = () => {
    setSenseiOn(!senseiOn)
    try {
      localStorage.setItem(SENSEI_KEY, senseiOn ? 'off' : 'on')
    } catch {
      // non-essential
    }
  }

  const chooseBubbleMode = (mode: DisplayMode) => {
    setBubbleMode(mode)
    try {
      localStorage.setItem(BUBBLE_MODE_KEY, mode)
    } catch {
      // non-essential
    }
  }

  const toggleSound = () => {
    setSettings({ muted: !muted })
    setMuted(!muted)
  }

  // Sound follows the replay: cues only when advancing exactly one ply; jumps just retune the score (05 §6).
  useEffect(() => {
    const prev = audioPly.current
    audioPly.current = ply
    const s = story[ply]
    if (prev === ply || !s) return
    if (ply !== prev + 1) {
      gameAudio.seek(plyAudio(s))
      return
    }
    if (!isMusicPlaying()) gameAudio.start()
    gameAudio.onPly(plyAudio(s))
    if (!live && ply === total) gameAudio.end(game.winner === 'us' ? 'victory' : game.winner === 'stockfish' ? 'defeat' : 'draw')
  }, [ply, story, total, live, game.winner])

  useEffect(() => stopMusic, [])

  // Hidden as soon as the replay moves, or after a few seconds.
  const showTitleCard = titleCard && ply === 0
  useEffect(() => {
    if (!titleCard) return
    const t = setTimeout(() => setTitleCard(false), TITLE_CARD_MS)
    return () => clearTimeout(t)
  }, [titleCard])

  useEffect(() => {
    if (live && total !== prevTotal.current) {
      setPly((p) => (p === prevTotal.current ? total : p))
      prevTotal.current = total
    }
  }, [live, total])
  const seek = useCallback((p: number) => setPly(Math.max(0, Math.min(total, p))), [total])

  useEffect(() => {
    if (!playing) return
    if (ply >= total) {
      setPlaying(false)
      return
    }
    // In "key" mode, autoplay lingers on key moments long enough to read them.
    const hold = bubbleMode === 'key' && bubbles.length ? readMs(bubbles) : 0
    // ...and on the sensei's verdicts, whatever the bubble mode.
    const senseiHold = senseiComment ? readOne(senseiComment.text) + 500 : 0
    const t = setTimeout(() => setPly((p) => p + 1), Math.max(SPEEDS[speed].ms, hold, senseiHold))
    return () => clearTimeout(t)
  }, [playing, ply, total, speed, bubbleMode, bubbles, senseiComment])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowRight') seek(ply + 1)
      else if (e.key === 'ArrowLeft') seek(ply - 1)
      else if (e.key === 'Home') seek(0)
      else if (e.key === 'End') seek(total)
      else if (e.key === ' ') setPlaying((p) => !p)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ply, total, seek])

  useEffect(() => {
    const list = moveListRef.current
    const cur = list?.querySelector<HTMLElement>('.mv.current')
    if (list && cur) {
      const top = cur.offsetTop
      if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - cur.offsetHeight) {
        list.scrollTop = top - list.clientHeight / 2
      }
    }
    if (!live) window.history.replaceState(null, '', `#/game/${game.id}/${ply}`)
  }, [ply, game.id, live])

  const analysisHtml = useMemo(() => (analysis ? (marked.parse(analysis) as string) : ''), [analysis])

  const current = ply > 0 ? game.moves[ply - 1] : null
  const fen = current?.fenAfter ?? game.startFen ?? START_FEN
  const flipped = game.ourColor === 'black'
  const ourArmy = game.ourColor === 'white' ? 'w' : 'b'
  const sfArmy = ourArmy === 'w' ? 'b' : 'w'
  const outcome = OUTCOME[game.winner]
  const lastUs = [...game.moves.slice(0, ply)].reverse().find((m) => m.by === 'us')
  const povSign = game.ourColor === 'white' ? 1 : -1

  const pairs: { no: number; white?: { m: (typeof game.moves)[0]; i: number }; black?: { m: (typeof game.moves)[0]; i: number } }[] = []
  game.moves.forEach((m, i) => {
    const no = Math.floor(i / 2) + 1
    if (i % 2 === 0) pairs.push({ no, white: { m, i } })
    else pairs[pairs.length - 1].black = { m, i }
  })

  const toMove = sideToMove(fen)
  const limitMs = (game.moveTimeSec || 5) * 1000
  const atLiveEdge = live && ply === total

  const general = (army: 'w' | 'b', name: string, sub: string, side: 'top' | 'bottom', isUs: boolean) => {
    const last = [...game.moves.slice(0, ply)].reverse().find((m) => (m.by === 'us') === isUs)
    const thinking = atLiveEdge && toMove === army
    return (
      <div className={`general general-${side}${isUs ? ' general-us' : ''}${thinking ? ' general-thinking' : ''}`}>
        <img className="portrait" src={spriteUrl('k', army)} alt="" />
        <div className="general-text">
          <div className="general-name">{name}</div>
          <div className="general-sub">{sub}</div>
        </div>
        <MoveTimer ms={last?.timeMs ?? null} since={thinking ? (liveSince ?? null) : null} limitMs={limitMs} />
        <div className="general-clan">{army === 'w' ? '白' : '赤'}</div>
      </div>
    )
  }

  const ours = general(ourArmy, `Musashi ${game.engine.version}`, 'Our engine · Rust · 5s/move', 'bottom', true)
  const theirs = general(sfArmy, 'Stockfish', `${game.stockfishVersion} · UCI_Elo ${game.stockfishElo}`, 'top', false)

  return (
    <div className="replay">
      <section className="replay-main">
        {theirs}
        <div className="board-wrap">
          <Board fen={fen} lastMove={current?.uci} flipped={flipped} bubbles={showTitleCard ? [] : bubbles} />
          {showTitleCard && (
            <button className="title-card" onClick={() => setTitleCard(false)} aria-label="Dismiss title card">
              <span className="title-card-kicker">伊賀越え · The Night of Iga</span>
              <span className="title-card-game">── Battle #{game.id} ──</span>
              <span className="title-card-sides">
                <span className="title-card-side">
                  Tokugawa<small>Musashi · {game.ourColor}</small>
                </span>
                <span className="title-card-vs">vs</span>
                <span className="title-card-side">
                  Akechi’s pursuers<small>Stockfish</small>
                </span>
              </span>
              <span className="title-card-elo">Strength of the pursuers: {game.stockfishElo}</span>
            </button>
          )}
          {!live && ply === total && total > 0 && (
            <div className={`result-banner result-${game.winner}`}>
              {game.winner === 'stockfish' && (
                <figure className="shikami">
                  <img src={spriteUrl('k', ourArmy)} alt="Ink portrait of the defeated Ieyasu" />
                  <figcaption>顰像 shikami-zō</figcaption>
                </figure>
              )}
              <div className="result-kanji">{outcome.kanji}</div>
              <div className="result-word">{outcome.word}</div>
              <div className="result-title">{ENDING_TITLE[game.winner]}</div>
              {ending.map((l) => (
                <p key={l.side} className={`result-line side-${l.side}`}>
                  <span className="result-line-who">{l.who}</span> “{l.text}”
                </p>
              ))}
              <div className="result-detail">
                {game.result} · {game.termination}
              </div>
            </div>
          )}
        </div>
        {ours}
        <div className="controls px-panel">
          <button className="px-btn" onClick={() => seek(0)} aria-label="First move">⏮</button>
          <button className="px-btn" onClick={() => seek(ply - 1)} aria-label="Previous move">◀</button>
          <button className="px-btn px-btn-primary" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <button className="px-btn" onClick={() => seek(ply + 1)} aria-label="Next move">▶▎</button>
          <button className="px-btn" onClick={() => seek(total)} aria-label="Last move">⏭</button>
          <input
            className="px-range"
            type="range"
            min={0}
            max={total}
            value={ply}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Move timeline"
          />
          <div className="speed">
            {SPEEDS.map((s, i) => (
              <button key={s.label} className={`px-chip${i === speed ? ' active' : ''}`} onClick={() => setSpeed(i)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="speed" role="group" aria-label="Speech bubbles">
            <span className="control-label" aria-hidden>
              話
            </span>
            {BUBBLE_MODES.map((m) => (
              <button
                key={m.mode}
                className={`px-chip${m.mode === bubbleMode ? ' active' : ''}`}
                onClick={() => chooseBubbleMode(m.mode)}
                aria-pressed={m.mode === bubbleMode}
              >
                {m.label}
              </button>
            ))}
          </div>
          {sensei.size > 0 && (
            <button
              className={`px-chip${senseiOn ? ' active' : ''}`}
              onClick={toggleSensei}
              aria-pressed={senseiOn}
              aria-label={senseiOn ? 'Hide the sensei' : 'Show the sensei'}
              title="The hermit sensei comments on blunders, mistakes and fine moves"
            >
              師 {senseiOn ? 'On' : 'Off'}
            </button>
          )}
          <button
            className={`px-chip${muted ? '' : ' active'}`}
            onClick={toggleSound}
            aria-pressed={!muted}
            aria-label={muted ? 'Turn sound on' : 'Mute sound'}
          >
            {muted ? '♪ Off' : '♪ On'}
          </button>
        </div>
      </section>

      <aside className="replay-side">
        {senseiOn && sensei.size > 0 && <Sensei speech={senseiComment} />}
        <div className="px-panel battle-info">
          <div className="battle-title">
            Battle #{game.id} <span className="battle-elo">vs Elo {game.stockfishElo}</span>
          </div>
          {live ? (
            <div className="battle-outcome live-tag">
              <span className="live-dot" /> LIVE · battle in progress
            </div>
          ) : (
            <div className={`battle-outcome outcome-${game.winner}`}>
              {outcome.kanji} {outcome.word} · {game.result}
            </div>
          )}
          <div className="battle-stats">
            <div>
              <span>Move</span>
              <b>
                {Math.ceil(ply / 2)}/{Math.ceil(total / 2)}
              </b>
            </div>
            <div>
              <span>Musashi eval</span>
              <b>
                {lastUs
                  ? formatEval(
                      lastUs.evalCp === null ? null : lastUs.evalCp * povSign,
                      lastUs.mate === null ? null : lastUs.mate * povSign,
                    )
                  : '0.00'}
              </b>
            </div>
            <div>
              <span>Our depth</span>
              <b>{lastUs?.depth ?? '—'}</b>
            </div>
            <div>
              <span>Our think</span>
              <b>{lastUs ? `${(lastUs.timeMs / 1000).toFixed(1)}s` : '—'}</b>
            </div>
          </div>
        </div>

        <div className="px-panel">
          <EvalChart moves={game.moves} ply={ply} ourColor={game.ourColor} onSeek={seek} />
        </div>

        <div className="px-panel movelist-panel">
          <div className="panel-title">棋譜 Move scroll</div>
          <ol className="movelist" ref={moveListRef}>
            {pairs.map((p) => (
              <li key={p.no}>
                <span className="mv-no">{p.no}.</span>
                {[p.white, p.black].map((x, k) =>
                  x ? (
                    <button
                      key={k}
                      className={`mv${x.i + 1 === ply ? ' current' : ''}${x.m.by === 'us' ? ' mv-us' : ''}`}
                      onClick={() => seek(x.i + 1)}
                    >
                      {x.m.san}
                      {sensei.get(x.i + 1)?.note && (
                        <span className={`mv-glyph glyph-${sensei.get(x.i + 1)!.note!.kind}`}>
                          {KIND_LABEL[sensei.get(x.i + 1)!.note!.kind].glyph}
                        </span>
                      )}
                      <span className={`mv-time${x.m.timeMs > limitMs + OVER_TOLERANCE_MS ? ' mv-time-over' : ''}`}>
                        {(x.m.timeMs / 1000).toFixed(1)}s
                      </span>
                    </button>
                  ) : (
                    <span key={k} />
                  ),
                )}
              </li>
            ))}
          </ol>
        </div>

        {analysis && (
          <div className="px-panel">
            <button className="panel-title scroll-toggle" onClick={() => setShowScroll((s) => !s)}>
              巻物 Sensei's scroll {showScroll ? '▾' : '▸'}
            </button>
            {showScroll && <div className="analysis" dangerouslySetInnerHTML={{ __html: analysisHtml }} />}
          </div>
        )}
      </aside>
    </div>
  )
}
