import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { playMapClose, playProvince } from '../audio'
import { closeTo, navigateMap, STATE, type Castle, type Status } from '../lib/warmap'
import { japanMap } from '../pixel/japan'
import { spriteUrl } from '../pixel/render'
import type { ManifestEntry } from '../types/game'

const RESULT = {
  us: { kanji: '勝', label: 'Victory' },
  stockfish: { kanji: '敗', label: 'Defeat' },
  draw: { kanji: '分', label: 'Draw' },
} as const

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Keeps a <dialog> shown while `open` is true: as a modal, or (the drawer) not. */
function useDialog(open: boolean, modal = true) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (modal) d.showModal()
      else d.show()
    }
    if (!open && d.open) d.close()
  }, [open, modal])
  return ref
}

// ---------- The map itself (used inline on the home page and full screen) ----------

export function CastleIcon({ status }: { status: Status }) {
  if (status === 'conquered') return <img src={spriteUrl('p', 'w')} alt="" />
  if (status === 'locked') return <span className="fog">?</span>
  return <img src={spriteUrl('r', 'b')} alt="" />
}

interface BoardProps {
  castles: Castle[]
  /** Makes the castles clickable (full-screen map). */
  onCastle?: (c: Castle) => void
  selected?: number
}

export function JapanBoard({ castles, onCastle, selected }: BoardProps) {
  const japan = japanMap()
  return (
    <div className="japan" style={{ aspectRatio: `${japan.w} / ${japan.h}`, '--ar': japan.w / japan.h } as CSSProperties}>
      <svg viewBox={`0 0 ${japan.w} ${japan.h}`} aria-hidden="true">
        <g shapeRendering="crispEdges">
          <rect className="jp-sea" width={japan.w} height={japan.h} />
          <path className="jp-waves" d={japan.waves} />
          <path className="jp-shallows" d={japan.shallows} />
          <path className="jp-coast" d={japan.coast} />
          <path className="jp-land" d={japan.land} />
        </g>
        {castles.slice(1).map((c, i) => (
          <line
            key={c.elo}
            className={`jp-road${c.status === 'locked' ? '' : ' jp-road-taken'}`}
            x1={castles[i].x}
            y1={castles[i].y}
            x2={c.x}
            y2={c.y}
          />
        ))}
      </svg>
      {castles.map((c) => {
        const body = (
          <>
            <span className="province-flag">
              <CastleIcon status={c.status} />
            </span>
            <span className="castle-label">
              <span className="province-elo">{c.elo}</span>
              <span className="castle-name">{c.province.name}</span>
            </span>
          </>
        )
        const props = {
          className: `castle province-${c.status} castle-label-${c.province.label}${c.elo === selected ? ' castle-selected' : ''}`,
          style: { left: `${(c.x / japan.w) * 100}%`, top: `${(c.y / japan.h) * 100}%` },
        }
        return onCastle ? (
          <button
            key={c.elo}
            {...props}
            onClick={() => onCastle(c)}
            aria-label={`${c.province.name}, Stockfish ${c.elo}: ${STATE[c.status]}`}
          >
            {body}
          </button>
        ) : (
          <span key={c.elo} {...props}>
            {body}
          </span>
        )
      })}
    </div>
  )
}

// ---------- Full-screen campaign map + province drawer ----------

interface WarMapProps {
  open: boolean
  elo?: number
  castles: Castle[]
  nextElo: number
  onReplay: (id: string) => void
}

export function WarMap({ open, elo, castles, nextElo, onReplay }: WarMapProps) {
  const mapRef = useDialog(open)
  const selected = open ? castles.find((c) => c.elo === elo) : undefined
  // Non-modal, so the castles stay clickable while a province is open.
  const drawerRef = useDialog(!!selected, false)
  const conquered = castles.filter((c) => c.status === 'conquered').length
  const fighting = castles.find((c) => c.elo === nextElo)

  const closeMap = () => {
    playMapClose()
    closeTo('#/')
  }
  const closeDrawer = () => closeTo('#/map')

  return (
    <dialog
      ref={mapRef}
      className="warmap"
      aria-label="Campaign map"
      onCancel={(e) => {
        // Esc closes the province drawer first, then the map.
        e.preventDefault()
        if (selected) closeDrawer()
        else closeMap()
      }}
    >
      <header className="warmap-bar">
        <div className="warmap-title">
          <span className="warmap-kanji">天下統一</span>
          <span>Campaign map</span>
        </div>
        <div className="warmap-summary">
          <span>
            <b>{conquered}</b>/{castles.length} provinces
          </span>
          {fighting && (
            <span>
              Now besieging <b>{fighting.province.name}</b> · Stockfish {fighting.elo}
            </span>
          )}
        </div>
        <button className="px-btn" onClick={closeMap} autoFocus>
          ✕ Close <kbd>Esc</kbd>
        </button>
      </header>
      <div className="warmap-stage">
        {open && (
          <JapanBoard
            castles={castles}
            selected={selected?.elo}
            onCastle={(c) => {
              if (c.elo === elo) return
              playProvince()
              navigateMap(c.elo)
            }}
          />
        )}
      </div>
      <p className="warmap-hint">Click a castle to read its battle scrolls</p>

      <dialog ref={drawerRef} className="province-drawer" aria-label={selected ? `${selected.province.name} battles` : 'Province'}>
        {selected && <ProvincePanel key={selected.elo} castle={selected} onClose={closeDrawer} onReplay={onReplay} />}
      </dialog>
    </dialog>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pd-stat">
      <span>{label}</span>
      <b>{children}</b>
    </div>
  )
}

function ProvincePanel({ castle, onClose, onReplay }: { castle: Castle; onClose: () => void; onReplay: (id: string) => void }) {
  const { games, province, status, elo, win } = castle
  const count = (w: ManifestEntry['winner']) => games.filter((g) => g.winner === w).length
  const wins = games.filter((g) => g.winner === 'us')
  const fastest = wins.length ? wins.reduce((a, b) => (b.plies < a.plies ? b : a)) : undefined
  const slowest = Math.max(0, ...games.map((g) => g.ourMaxMoveMs ?? 0))
  const versions = [...new Set(games.map((g) => g.engineVersion))]

  return (
    <div className="pd">
      <header className={`pd-head province-${status}`}>
        <span className="pd-flag province-flag">
          <CastleIcon status={status} />
        </span>
        <div className="pd-title">
          <span className="pd-kanji">{province.kanji}</span>
          <span className="pd-name">{province.name} province</span>
          <span className="pd-elo">Stockfish UCI_Elo {elo}</span>
        </div>
        <button className="px-btn pd-close" onClick={onClose} aria-label="Close province">
          ✕
        </button>
      </header>

      <div className={`pd-status province-${status}`}>{STATE[status]}</div>

      {games.length === 0 ? (
        <p className="pd-empty">
          Fog hangs over {province.name}. No battle has been fought here yet; the ladder only marches on after a
          victory at the province before it.
        </p>
      ) : (
        <>
          <div className="pd-stats">
            <Stat label="Battles">{games.length}</Stat>
            <Stat label="Won · drawn · lost">
              {count('us')} · {count('draw')} · {count('stockfish')}
            </Stat>
            <Stat label="Fastest win">{fastest ? plural(Math.ceil(fastest.plies / 2), 'move', 'moves') : '—'}</Stat>
            <Stat label="Slowest move">{slowest ? `${(slowest / 1000).toFixed(2)} s` : '—'}</Stat>
          </div>
          <p className="pd-note">
            {win
              ? `Taken in battle #${win.id}${games.length > 1 ? ` after ${plural(games.indexOf(win), 'failed assault', 'failed assaults')}` : ''}.`
              : `Still holding out after ${plural(games.length, 'assault', 'assaults')}.`}{' '}
            Engine {versions.length > 1 ? `versions ${versions[0]} → ${versions[versions.length - 1]}` : `version ${versions[0]}`}.
          </p>
          <h3 className="pd-section">合戦 Battles</h3>
          <ol className="pd-games">
            {[...games].reverse().map((g) => (
              <li key={g.id} className={`pd-game outcome-${g.winner}`}>
                <span className="battle-kanji">{RESULT[g.winner].kanji}</span>
                <div className="pd-game-body">
                  <div className="pd-game-head">
                    <b>Battle #{g.id}</b>
                    <span>
                      {RESULT[g.winner].label} {g.result}
                    </span>
                  </div>
                  <div className="pd-game-date">{when(g.date)}</div>
                  <div className="battle-card-chips">
                    <span className="chip">
                      <i className={`chip-swatch chip-${g.ourColor}`} /> {cap(g.ourColor)}
                    </span>
                    <span className="chip">{cap(g.termination.replace(/_/g, ' '))}</span>
                    <span className="chip">{Math.ceil(g.plies / 2)} moves</span>
                    <span className="chip">v{g.engineVersion}</span>
                    {g.ourMaxMoveMs != null && <span className="chip">max {(g.ourMaxMoveMs / 1000).toFixed(1)} s</span>}
                    {g.analysis && <span className="chip chip-scroll">巻物 analysis</span>}
                  </div>
                </div>
                <button className="px-btn px-btn-primary pd-replay" onClick={() => onReplay(g.id)}>
                  Replay ▶
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
