import type { Army, PieceType } from '../pixel/sprites'

export interface BoardPiece {
  id: number
  type: PieceType
  army: Army
  /** 0 = a1 … 63 = h8 */
  sq: number
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function parseFen(fen: string): Omit<BoardPiece, 'id'>[] {
  const out: Omit<BoardPiece, 'id'>[] = []
  const rows = fen.split(' ')[0].split('/')
  rows.forEach((row, i) => {
    const rank = 7 - i
    let file = 0
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch)
        continue
      }
      const lower = ch.toLowerCase() as PieceType
      out.push({ type: lower, army: ch === lower ? 'b' : 'w', sq: rank * 8 + file })
      file++
    }
  })
  return out
}

export function sideToMove(fen: string): Army {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

export function squareName(sq: number): string {
  return 'abcdefgh'[sq % 8] + (Math.floor(sq / 8) + 1)
}

export function squareIndex(name: string): number {
  return (Number(name[1]) - 1) * 8 + 'abcdefgh'.indexOf(name[0])
}

function dist(a: number, b: number): number {
  return Math.abs((a % 8) - (b % 8)) + Math.abs(Math.floor(a / 8) - Math.floor(b / 8))
}

let nextId = 1

/**
 * Carry piece identities from `prev` into the position `fen`, so moved pieces keep their id
 * (and animate) instead of re-mounting. Works for single steps, jumps, and stepping backwards.
 * Returns the new pieces and the ones that disappeared (captures).
 */
export function diffPieces(prev: BoardPiece[], fen: string): { pieces: BoardPiece[]; removed: BoardPiece[] } {
  const target = parseFen(fen)
  const unused = new Set(prev)
  const result: (BoardPiece | null)[] = target.map(() => null)

  target.forEach((t, i) => {
    const same = prev.find((p) => unused.has(p) && p.sq === t.sq && p.type === t.type && p.army === t.army)
    if (same) {
      unused.delete(same)
      result[i] = same
    }
  })
  target.forEach((t, i) => {
    if (result[i]) return
    let best: BoardPiece | null = null
    for (const p of unused) {
      if (p.type !== t.type || p.army !== t.army) continue
      if (!best || dist(p.sq, t.sq) < dist(best.sq, t.sq)) best = p
    }
    if (best) {
      unused.delete(best)
      result[i] = { ...best, sq: t.sq }
    } else {
      result[i] = { ...t, id: nextId++ }
    }
  })
  return { pieces: result as BoardPiece[], removed: [...unused] }
}

export function freshPieces(fen: string): BoardPiece[] {
  return parseFen(fen).map((p) => ({ ...p, id: nextId++ }))
}

/** Square of the king of the side to move if it is attacked, using a light attack check. */
export function checkedKingSquare(fen: string): number | null {
  const pieces = parseFen(fen)
  const stm = sideToMove(fen)
  const king = pieces.find((p) => p.type === 'k' && p.army === stm)
  if (!king) return null
  const at = new Map(pieces.map((p) => [p.sq, p]))
  const kf = king.sq % 8
  const kr = Math.floor(king.sq / 8)
  const enemy = (sq: number) => {
    const p = at.get(sq)
    return p && p.army !== stm ? p : null
  }
  const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8
  const knight = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
  for (const [df, dr] of knight) {
    if (onBoard(kf + df, kr + dr) && enemy((kr + dr) * 8 + kf + df)?.type === 'n') return king.sq
  }
  const pawnDir = stm === 'w' ? 1 : -1
  for (const df of [-1, 1]) {
    const f = kf + df
    const r = kr + pawnDir
    if (onBoard(f, r) && enemy(r * 8 + f)?.type === 'p') return king.sq
  }
  const rays: [number, number, string][] = [
    [1, 0, 'rq'], [-1, 0, 'rq'], [0, 1, 'rq'], [0, -1, 'rq'],
    [1, 1, 'bq'], [1, -1, 'bq'], [-1, 1, 'bq'], [-1, -1, 'bq'],
  ]
  for (const [df, dr, types] of rays) {
    let f = kf + df
    let r = kr + dr
    while (onBoard(f, r)) {
      const p = at.get(r * 8 + f)
      if (p) {
        if (p.army !== stm && types.includes(p.type)) return king.sq
        break
      }
      f += df
      r += dr
    }
  }
  return null
}
