import { useEffect, useMemo, useRef, useState } from 'react'
import { checkedKingSquare, diffPieces, freshPieces, squareIndex, type BoardPiece } from '../lib/fen'
import { slashUrl, spriteUrl, tileUrl } from '../pixel/render'
import type { Army } from '../pixel/sprites'
import { positionReactions } from '../story/reactions'
import { ARMOR, DISPLAY_NAME, ROLE_BY_PIECE, type Bubble } from '../story/types'

interface Props {
  fen: string
  lastMove?: string | null
  flipped?: boolean
  /** Speech bubbles for the current ply (already filtered by display mode). */
  bubbles?: Bubble[]
  /** Which army is the Tokugawa (our engine): only Hanzō, their commander, vanishes in smoke. */
  tokugawa?: Army
}

interface Dying extends BoardPiece {
  until: number
}

/** A move's signature effect (docs/story/04 §2, §6), played once when the board steps forward. */
interface MoveFx {
  kind: 'vanish' | 'leap' | 'promote'
  id: number
  from: number
  to: number
  key: string
}

export function Board({ fen, lastMove, flipped = false, bubbles = [], tokugawa = 'w' }: Props) {
  const [pieces, setPieces] = useState<BoardPiece[]>(() => freshPieces(fen))
  const [dying, setDying] = useState<Dying[]>([])
  const [fx, setFx] = useState<MoveFx | null>(null)
  const prevFen = useRef(fen)

  useEffect(() => {
    if (prevFen.current === fen) return
    prevFen.current = fen
    const from = lastMove ? squareIndex(lastMove.slice(0, 2)) : -1
    const to = lastMove ? squareIndex(lastMove.slice(2, 4)) : -1
    setPieces((prev) => {
      const { pieces: next, removed } = diffPieces(prev, fen)
      // Did this step play `lastMove` forward? (Jumps and steps back get no move effects.)
      const mover = prev.find((p) => p.sq === from)
      const landed = mover && next.find((p) => p.id === mover.id && p.sq === to)
      const promoted = lastMove?.length === 5 && removed.some((r) => r.type === 'p' && r.sq === from)
      const onTo = next.find((p) => p.sq === to)
      let kind: MoveFx['kind'] | null = null
      if (promoted) kind = 'promote'
      else if (landed && mover.type === 'q' && mover.army === tokugawa) kind = 'vanish'
      else if (landed && mover.type === 'n') kind = 'leap'
      setFx(kind && onTo ? { kind, id: onTo.id, from, to, key: `${fen}|${kind}` } : null)

      // The promoted pawn becomes the new piece rather than dying.
      const dead = promoted ? removed.filter((r) => !(r.type === 'p' && r.sq === from)) : removed
      if (dead.length) {
        const until = Date.now() + 800
        setDying((d) => [...d.filter((x) => x.until > Date.now()), ...dead.map((r) => ({ ...r, until }))])
      }
      return next
    })
  }, [fen, lastMove, tokugawa])

  useEffect(() => {
    if (!dying.length) return
    const t = setTimeout(() => setDying((d) => d.filter((x) => x.until > Date.now())), 850)
    return () => clearTimeout(t)
  }, [dying])

  const react = useMemo(() => positionReactions(fen), [fen])

  const visual = (sq: number) => ({
    x: flipped ? 7 - (sq % 8) : sq % 8,
    y: flipped ? Math.floor(sq / 8) : 7 - Math.floor(sq / 8),
  })

  const pos = (sq: number) => {
    const { x, y } = visual(sq)
    return { transform: `translate(calc(var(--sq) * ${x}), calc(var(--sq) * ${y}))` }
  }

  // Keep bubbles on the board: flip below on the top row, hug the side on edge files.
  const bubblePlacement = (sq: number) => {
    const { x, y } = visual(sq)
    return `${y === 0 ? ' below' : ''}${x <= 1 ? ' hug-left' : x >= 6 ? ' hug-right' : ''}`
  }

  // The speaker acts out its line (04 §4). Last words play through the death animation instead.
  const gestures = new Map<number, { mood: string; reply: boolean; key: string }>()
  for (const b of bubbles) {
    if (b.situation === 'fallen') continue
    const sq = squareIndex(b.square)
    if (!gestures.has(sq)) gestures.set(sq, { mood: b.mood, reply: b.isReply, key: `${b.ply}-${b.lineId}` })
  }

  const from = lastMove ? squareIndex(lastMove.slice(0, 2)) : null
  const to = lastMove ? squareIndex(lastMove.slice(2, 4)) : null
  const check = checkedKingSquare(fen)
  const light = tileUrl(true)
  const dark = tileUrl(false)

  const squares = []
  for (let sq = 0; sq < 64; sq++) {
    const isLight = (Math.floor(sq / 8) + (sq % 8)) % 2 === 1
    squares.push(
      <div
        key={sq}
        className={`square${sq === from ? ' sq-from' : ''}${sq === to ? ' sq-to' : ''}${sq === check ? ' sq-check' : ''}${react.hanging.has(sq) ? ' sq-hanging' : ''}`}
        style={{ ...pos(sq), backgroundImage: `url(${isLight ? light : dark})` }}
      />,
    )
  }

  const center = (sq: number) => {
    const { x, y } = visual(sq)
    return { x: x + 0.5, y: y + 0.5 }
  }

  const files = flipped ? 'hgfedcba' : 'abcdefgh'
  const ranks = flipped ? '12345678' : '87654321'

  return (
    <div className="board-frame">
      <div className={`board${react.mated !== null ? ' board-dusk' : ''}`}>
        {squares}
        {react.pins.length > 0 && (
          <svg className="pin-lines" viewBox="0 0 8 8" aria-hidden="true">
            {react.pins.map((p) => {
              const a = center(p.pinner)
              const b = center(p.king)
              return <line key={`${p.pinner}-${p.pinned}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            })}
          </svg>
        )}
        {pieces.map((p) => {
          const moveFx = fx && fx.id === p.id ? fx : null
          const g = gestures.get(p.sq)
          const faces = react.facing.get(p.sq)
          const faceLeft = faces !== undefined && visual(faces).x < visual(p.sq).x
          const kneel = p.type === 'k' && p.sq === react.mated
          return (
            <div
              key={p.id}
              className={`piece${moveFx ? ` fx-${moveFx.kind}` : ''}${react.trembling.has(p.sq) ? ' tremble' : ''}`}
              style={pos(p.sq)}
            >
              <span
                key={g?.key ?? 'still'}
                className={`gesture${g ? ` gesture-${g.mood}${g.reply ? ' gesture-reply' : ''}` : ''}${react.glint.has(p.sq) ? ' glint' : ''}${faceLeft ? ' face-left' : ''}`}
              >
                <img
                  key={`${p.id}-${p.sq}`}
                  className={`sprite hop${p.type === 'k' && p.sq === check && !kneel ? ' in-check' : ''}${kneel ? ' kneel' : ''}`}
                  src={spriteUrl(p.type, p.army)}
                  alt={`${p.army === 'w' ? 'white' : 'black'} ${p.type}`}
                  draggable={false}
                  style={{ animationDelay: `0s, ${-(p.id % 7) * 0.37}s` }}
                />
              </span>
            </div>
          )
        })}
        {fx && (fx.kind === 'vanish' || fx.kind === 'leap') && (
          <>
            {fx.kind === 'vanish' && <div key={`${fx.key}-from`} className="fx-smoke" style={pos(fx.from)} aria-hidden="true" />}
            <div key={`${fx.key}-to`} className={`fx-smoke${fx.kind === 'leap' ? ' small' : ''}`} style={pos(fx.to)} aria-hidden="true" />
          </>
        )}
        {fx?.kind === 'promote' && <div key={fx.key} className="fx-burst" style={pos(fx.to)} aria-hidden="true" />}
        {dying.map((p) => (
          <div key={`d${p.id}`} className={`piece dying die-${ARMOR[ROLE_BY_PIECE[p.type]]} die-${p.type}`} style={pos(p.sq)}>
            <img className="sprite" src={spriteUrl(p.type, p.army)} alt="" draggable={false} />
            <img className="slash" src={slashUrl()} alt="" draggable={false} />
          </div>
        ))}
        {bubbles.map((b) => {
          const sq = squareIndex(b.square)
          // A reply next to the primary speaker would cover it: stack it one bubble further out.
          const primary = b.isReply ? bubbles.find((o) => !o.isReply) : undefined
          const p = primary ? squareIndex(primary.square) : null
          const stacked = p !== null && Math.abs((p % 8) - (sq % 8)) <= 3 && Math.abs(Math.floor(p / 8) - Math.floor(sq / 8)) <= 1
          return (
            <div key={`${b.ply}-${b.lineId}`} className="bubble-anchor" style={pos(sq)}>
              <div
                className={`bubble side-${b.side} mood-${b.mood}${b.isReply ? ' reply' : ''}${stacked ? ' stacked' : ''}${bubblePlacement(sq)}`}
                role="status"
              >
                <div className="bubble-who">{DISPLAY_NAME[b.side][b.role]}</div>
                <div className="bubble-text">{b.text}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="coords coords-files">
        {files.split('').map((f) => (
          <span key={f}>{f}</span>
        ))}
      </div>
      <div className="coords coords-ranks">
        {ranks.split('').map((r) => (
          <span key={r}>{r}</span>
        ))}
      </div>
    </div>
  )
}
