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

export function Dojo({ manifest, live, onOpen }: Props) {
  const games = manifest.games
  const wins = games.filter((g) => g.winner === 'us').length
  const draws = games.filter((g) => g.winner === 'draw').length
  const losses = games.length - wins - draws

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
        <h1 className="hero-title">CHEZZ</h1>
        <p className="hero-sub">Our engine marches on Stockfish. One province per Elo. Draws do not count.</p>
        <div className="hero-stats">
          <div className="px-panel stat">
            <span>Highest Elo conquered</span>
            <b>{manifest.highestWin ?? '—'}</b>
          </div>
          <div className="px-panel stat">
            <span>Next campaign</span>
            <b>{manifest.nextElo}</b>
          </div>
          <div className="px-panel stat">
            <span>Battles</span>
            <b>
              {wins}勝 {draws}分 {losses}敗
            </b>
          </div>
        </div>
      </header>

      {live?.active && (
        <a className="px-panel live-banner" href="#/live">
          <span className="live-dot" />
          <span className="live-banner-text">
            <b>Battle #{live.id} is being fought right now</b>
            <span>
              chezz {live.engine.version} as {live.ourColor} vs Stockfish UCI_Elo {live.stockfishElo} · move{' '}
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
                  <span className="battle-card-title">
                    #{g.id} · Elo {g.stockfishElo}
                  </span>
                  <span className="battle-card-meta">
                    {RESULT[g.winner].label} as {g.ourColor} · {g.result} · {g.termination}
                  </span>
                  <span className="battle-card-meta">
                    {g.plies} plies · chezz {g.engineVersion} · {g.date.slice(0, 16).replace('T', ' ')}
                    {g.analysis ? ' · 巻物' : ''}
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
