// Idle reactions to the position on the board (docs/story/04-animation-reactions.md §3).
// Recomputed from the FEN alone, so scrubbing to any position shows the right state.

import { Chess, type Color, type Square } from 'chess.js'
import { squareIndex } from '../lib/fen'
import { V, hanging, kingSq, pieces, pinned } from './dialogue'

export interface PositionReactions {
  /** Attacked piece (board index) → the square of the attacker it turns to face. */
  facing: Map<number, number>
  /** Attacked foot soldiers tremble. */
  trembling: Set<number>
  /** Valuable pieces attacked and undefended: pulsing warning on their square. */
  hanging: Set<number>
  /** Absolute pins, drawn as an ink line pinner → pinned piece → king. */
  pins: { pinner: number; pinned: number; king: number }[]
  /** Pawns one step from promotion stand taller in a golden glint. */
  glint: Set<number>
  /** Square of a checkmated king, which kneels. */
  mated: number | null
}

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
const idx = (sq: Square) => squareIndex(sq)

export function positionReactions(fen: string): PositionReactions {
  const out: PositionReactions = { facing: new Map(), trembling: new Set(), hanging: new Set(), pins: [], glint: new Set(), mated: null }
  let pos: Chess
  try {
    pos = new Chess(fen, { skipValidation: true })
  } catch {
    return out
  }

  for (const p of pieces(pos)) {
    if (p.type === 'k') continue
    const attackers = pos.attackers(p.sq, other(p.color))
    if (attackers.length) {
      // Face the cheapest attacker — the most dangerous one.
      const worst = attackers.reduce((a, b) => (V[pos.get(b)!.type] < V[pos.get(a)!.type] ? b : a))
      out.facing.set(idx(p.sq), idx(worst))
      if (p.type === 'p') out.trembling.add(idx(p.sq))
    }
    if (p.type === 'p') {
      const rel = p.color === 'w' ? Number(p.sq[1]) : 9 - Number(p.sq[1])
      if (rel === 7) out.glint.add(idx(p.sq))
    }
  }

  for (const color of ['w', 'b'] as Color[]) {
    for (const h of hanging(pos, color)) out.hanging.add(idx(h.sq))
    const king = kingSq(pos, color)
    if (!king) continue
    const before = new Set(pos.attackers(king, other(color)))
    for (const p of pinned(pos, color)) {
      const probe = new Chess(pos.fen(), { skipValidation: true })
      probe.remove(p.sq)
      const pinner = probe.attackers(king, other(color)).find((sq) => !before.has(sq))
      if (pinner) out.pins.push({ pinner: idx(pinner), pinned: idx(p.sq), king: idx(king) })
    }
  }

  if (pos.isCheckmate()) out.mated = idx(kingSq(pos, pos.turn()))
  return out
}
