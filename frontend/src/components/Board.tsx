import { useEffect, useRef, useState } from 'react'
import { checkedKingSquare, diffPieces, freshPieces, squareIndex, type BoardPiece } from '../lib/fen'
import { slashUrl, spriteUrl, tileUrl } from '../pixel/render'
import { DISPLAY_NAME, type Bubble } from '../story/types'

interface Props {
  fen: string
  lastMove?: string | null
  flipped?: boolean
  /** Speech bubbles for the current ply (already filtered by display mode). */
  bubbles?: Bubble[]
}

interface Dying extends BoardPiece {
  until: number
}

export function Board({ fen, lastMove, flipped = false, bubbles = [] }: Props) {
  const [pieces, setPieces] = useState<BoardPiece[]>(() => freshPieces(fen))
  const [dying, setDying] = useState<Dying[]>([])
  const prevFen = useRef(fen)

  useEffect(() => {
    if (prevFen.current === fen) return
    prevFen.current = fen
    setPieces((prev) => {
      const { pieces: next, removed } = diffPieces(prev, fen)
      if (removed.length) {
        const until = Date.now() + 600
        setDying((d) => [...d.filter((x) => x.until > Date.now()), ...removed.map((r) => ({ ...r, until }))])
      }
      return next
    })
  }, [fen])

  useEffect(() => {
    if (!dying.length) return
    const t = setTimeout(() => setDying((d) => d.filter((x) => x.until > Date.now())), 650)
    return () => clearTimeout(t)
  }, [dying])

  const pos = (sq: number) => {
    const f = sq % 8
    const r = Math.floor(sq / 8)
    const x = flipped ? 7 - f : f
    const y = flipped ? r : 7 - r
    return { transform: `translate(calc(var(--sq) * ${x}), calc(var(--sq) * ${y}))` }
  }

  // Keep bubbles on the board: flip below on the top row, hug the side on edge files.
  const bubblePlacement = (sq: number) => {
    const x = flipped ? 7 - (sq % 8) : sq % 8
    const y = flipped ? Math.floor(sq / 8) : 7 - Math.floor(sq / 8)
    return `${y === 0 ? ' below' : ''}${x <= 1 ? ' hug-left' : x >= 6 ? ' hug-right' : ''}`
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
        className={`square${sq === from ? ' sq-from' : ''}${sq === to ? ' sq-to' : ''}${sq === check ? ' sq-check' : ''}`}
        style={{ ...pos(sq), backgroundImage: `url(${isLight ? light : dark})` }}
      />,
    )
  }

  const files = flipped ? 'hgfedcba' : 'abcdefgh'
  const ranks = flipped ? '12345678' : '87654321'

  return (
    <div className="board-frame">
      <div className="board">
        {squares}
        {pieces.map((p) => (
          <div key={p.id} className="piece" style={pos(p.sq)}>
            <img
              key={`${p.id}-${p.sq}`}
              className={`sprite hop${p.type === 'k' && p.sq === check ? ' in-check' : ''}`}
              src={spriteUrl(p.type, p.army)}
              alt={`${p.army === 'w' ? 'white' : 'black'} ${p.type}`}
              draggable={false}
              style={{ animationDelay: `0s, ${-(p.id % 7) * 0.37}s` }}
            />
          </div>
        ))}
        {dying.map((p) => (
          <div key={`d${p.id}`} className="piece dying" style={pos(p.sq)}>
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
