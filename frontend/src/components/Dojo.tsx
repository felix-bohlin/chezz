import type { LiveState } from '../lib/data'
import { spriteUrl } from '../pixel/render'
import type { Manifest, ManifestEntry } from '../types/game'

interface Props {
  manifest: Manifest
  live: LiveState | null
  onOpen: (id: string) => void
}

const RESULT = {
  us: { kanji: '勝', label: 'Victory' },
  stockfish: { kanji: '敗', label: 'Defeat' },
  draw: { kanji: '分', label: 'Draw' },
} as const

type Status = 'conquered' | 'contested' | 'next' | 'locked'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Dojo({ manifest, live, onOpen }: Props) {
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

  const statusOf = (elo: number): { status: Status; win?: ManifestEntry; attempts: number } => {
    const at = games.filter((g) => g.stockfishElo === elo)
    const win = at.find((g) => g.winner === 'us')
    if (win) return { status: 'conquered', win, attempts: at.length }
    if (elo === manifest.nextElo) return { status: at.length ? 'contested' : 'next', attempts: at.length }
    return { status: 'locked', attempts: at.length }
  }

  return (
    <div className="dojo">
      <header className="hero">
        <div className="hero-kanji">戦国</div>
        <h1 className="hero-title">
          CHEZZ
          <span className="hero-title-war">TOTAL WAR</span>
        </h1>
        <p className="hero-sub">Our engine marches on Stockfish. One province per Elo. Draws do not count.</p>
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

      <section className="px-panel campaign">
        <div className="panel-title">天下統一 Campaign map</div>
        <div className="provinces">
          {manifest.ladder.map((elo, i) => {
            const s = statusOf(elo)
            return (
              <button
                key={elo}
                className={`province province-${s.status}`}
                disabled={!s.win}
                onClick={() => s.win && onOpen(s.win.id)}
                title={
                  s.status === 'conquered'
                    ? `Conquered in battle #${s.win!.id}. Click to replay`
                    : s.attempts
                      ? `${s.attempts} battle(s), not yet won`
                      : 'Not yet attempted'
                }
              >
                {i > 0 && <span className="road" />}
                <span className="province-flag">
                  {s.status === 'conquered' ? (
                    <img src={spriteUrl('p', 'w')} alt="" />
                  ) : s.status === 'locked' ? (
                    <span className="fog">霧</span>
                  ) : (
                    <img src={spriteUrl('r', 'b')} alt="" />
                  )}
                </span>
                <span className="province-elo">{elo}</span>
                <span className="province-state">
                  {s.status === 'conquered' ? '制圧' : s.status === 'locked' ? '—' : s.status === 'next' ? '次' : '交戦'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

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
