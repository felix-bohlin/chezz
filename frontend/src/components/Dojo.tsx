import type { CSSProperties } from 'react'
import type { LiveState } from '../lib/data'
import { japanMap, provincesFor } from '../pixel/japan'
import type { Manifest } from '../types/game'
import { openWarMap, type Castle, type Status } from '../lib/warmap'
import { JapanBoard, WarMap } from './WarMap'

interface Props {
  manifest: Manifest
  live: LiveState | null
  onOpen: (id: string) => void
  /** From the #/map[/elo] route: the full-screen campaign map and the province open on it. */
  map: { open: boolean; elo?: number }
}

const RESULT = {
  us: { kanji: '勝', label: 'Victory' },
  stockfish: { kanji: '敗', label: 'Defeat' },
  draw: { kanji: '分', label: 'Draw' },
} as const

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Dojo({ manifest, live, onOpen, map }: Props) {
  const games = manifest.games
  const wins = games.filter((g) => g.winner === 'us').length
  const draws = games.filter((g) => g.winner === 'draw').length
  const losses = games.length - wins - draws
  const best = manifest.highestWin == null ? undefined : games.find((g) => g.winner === 'us' && g.stockfishElo === manifest.highestWin)
  const fighting = games.filter((g) => g.stockfishElo === manifest.nextElo)
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const fightingSummary = fighting.length
    ? [
        plural(fighting.length, 'attempt', 'attempts'),
        ...(['draw', 'stockfish'] as const)
          .map((w) => [fighting.filter((g) => g.winner === w).length, w] as const)
          .filter(([n]) => n > 0)
          .map(([n, w]) => (w === 'draw' ? plural(n, 'draw', 'draws') : plural(n, 'loss', 'losses'))),
      ].join(' · ')
    : 'First attempt coming up'
  const pct = (n: number) => `${games.length ? (n / games.length) * 100 : 0}%`

  const statusOf = (elo: number): Pick<Castle, 'status' | 'win' | 'games'> => {
    const at = games.filter((g) => g.stockfishElo === elo)
    const win = at.find((g) => g.winner === 'us')
    const status: Status = win ? 'conquered' : elo !== manifest.nextElo ? 'locked' : at.length ? 'contested' : 'next'
    return { status, win, games: at }
  }

  const japan = japanMap()
  const provinces = provincesFor(manifest.ladder.length)
  const castles: Castle[] = manifest.ladder.map((elo, i) => {
    const s = statusOf(elo)
    const tip =
      s.status === 'conquered'
        ? `Conquered in battle #${s.win!.id}`
        : s.games.length
          ? `${plural(s.games.length, 'battle', 'battles')}, not yet won`
          : 'Not yet attempted'
    return { elo, ...s, tip, province: provinces[i], ...japan.at(provinces[i].at) }
  })

  return (
    <div className="dojo">
      {live?.active && (
        <a className="px-panel live-banner" href="#/live">
          <span className="live-dot" />
          <span className="live-banner-text">
            <b>Battle #{live.id} is being fought right now</b>
            <span>
              Musashi {live.engine.version} as {live.ourColor} vs Stockfish UCI_Elo {live.stockfishElo} · move{' '}
              {Math.ceil(live.moves.length / 2) || 1}
            </span>
          </span>
          <span className="px-btn px-btn-primary">Watch ▶</span>
        </a>
      )}

      <section className="campaign war-table" aria-label="Campaign map" style={{ '--ar': japan.w / japan.h } as CSSProperties}>
        <button className="japan-open" onClick={() => openWarMap()} aria-label="Open the full-screen campaign map">
          <JapanBoard castles={castles} />
          <span className="japan-open-hint">⛶ Open the war map</span>
        </button>
      </section>

      <header className="hero dojo-hero">
        <div className="hero-stats">
          {best ? (
            <a className="px-panel stat stat-best" href={`#/game/${best.id}`}>
              <span>Best win vs Stockfish</span>
              <b>
                {best.stockfishElo}
                <small> Elo</small>
              </b>
              <em>Battle #{best.id} · watch the replay ›</em>
            </a>
          ) : (
            <div className="px-panel stat stat-best">
              <span>Best win vs Stockfish</span>
              <b>—</b>
              <em>No win yet</em>
            </div>
          )}
          <div className="px-panel stat stat-now">
            <span>Now fighting</span>
            <b>
              <small>Stockfish </small>
              {manifest.nextElo}
            </b>
            <em>{fightingSummary}</em>
          </div>
          <div className="px-panel stat stat-record">
            <span>All battles</span>
            <div className="record">
              <span className="rec rec-win">
                <i aria-hidden="true">勝</i>
                <b>{wins}</b>
                {wins === 1 ? 'win' : 'wins'}
              </span>
              <span className="rec rec-draw">
                <i aria-hidden="true">分</i>
                <b>{draws}</b>
                {draws === 1 ? 'draw' : 'draws'}
              </span>
              <span className="rec rec-loss">
                <i aria-hidden="true">敗</i>
                <b>{losses}</b>
                {losses === 1 ? 'loss' : 'losses'}
              </span>
            </div>
            <div className="record-bar" aria-hidden="true">
              <span className="rec-win" style={{ width: pct(wins) }} />
              <span className="rec-draw" style={{ width: pct(draws) }} />
              <span className="rec-loss" style={{ width: pct(losses) }} />
            </div>
          </div>
        </div>
      </header>

      <WarMap open={map.open} elo={map.elo} castles={castles} nextElo={manifest.nextElo} onReplay={onOpen} />

      <section className="px-panel battles">
        <div className="panel-title">合戦記録 Battle records</div>
        {games.length === 0 ? (
          <p className="empty">No battles yet. Run the ladder: python backend/runner.py --elo auto</p>
        ) : (
          <div className="battle-grid">
            {[...games].reverse().map((g) => (
              <button key={g.id} className={`battle-card outcome-${g.winner}`} onClick={() => onOpen(g.id)}>
                <span className="battle-kanji">{RESULT[g.winner].kanji}</span>
                <span className="battle-card-body">
                  <span className="battle-card-head">
                    <span className="battle-card-title">Elo {g.stockfishElo}</span>
                    <span className="battle-card-result">
                      {RESULT[g.winner].label} {g.result}
                    </span>
                  </span>
                  <span className="battle-card-sub">Battle #{g.id}</span>
                  <span className="battle-card-chips">
                    <span className="chip">
                      <i className={`chip-swatch chip-${g.ourColor}`} /> {cap(g.ourColor)}
                    </span>
                    <span className="chip">{cap(g.termination.replace(/_/g, ' '))}</span>
                    <span className="chip">{Math.ceil(g.plies / 2)} moves</span>
                    <span className="chip">v{g.engineVersion}</span>
                    {g.analysis && <span className="chip chip-scroll">巻物 analysis</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
