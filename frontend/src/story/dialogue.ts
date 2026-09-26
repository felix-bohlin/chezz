// Dialogue engine: turns a GameRecord into speech bubbles for every ply.
// Spec: docs/story/03-dialogue-system.md. Pure and deterministic — same game, same bubbles.

import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import type { GameRecord } from '../types/game'
import linesJson from './lines.json'
import {
  DISPLAY_NAME,
  KEY_MOMENT_MAX_PRIORITY,
  PRIORITY,
  ROLE_BY_PIECE,
  type Bubble,
  type DialogueLine,
  type MaterialState,
  type Phase,
  type Role,
  type Side,
  type Situation,
} from './types'

const LINES = linesJson as DialogueLine[]

/** Everything the UI and audio need for one ply (index 0 = start position). */
export interface PlyStory {
  ply: number
  /** Primary situation of this ply (null at ply 0 or when nothing could be detected). */
  situation: Situation | null
  bubbles: Bubble[]
  phase: Phase
  /** From OUR side (the Tokugawa). */
  material: MaterialState
  /** A king is in check or under heavy pressure — drives the music's top tension level. */
  kingInDanger: boolean
}

const V: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }
const RECENT_PLIES = 10
const DANGER_PRESSURE = 3

interface Placed {
  sq: Square
  type: PieceSymbol
  color: Color
}

interface Speech {
  situation: Situation
  sq: Square
  color: Color
  role: Role
  target?: { role: Role; color: Color }
}

interface Detected {
  primary: Speech
  reply?: Speech & { optional?: boolean }
}

// ── board helpers ──────────────────────────────────────────────────────────

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')

function pieces(pos: Chess, color?: Color): Placed[] {
  const out: Placed[] = []
  for (const row of pos.board()) {
    for (const p of row) if (p && (!color || p.color === color)) out.push({ sq: p.square, type: p.type, color: p.color })
  }
  return out
}

function kingSq(pos: Chess, color: Color): Square {
  return pos.findPiece({ type: 'k', color })[0]
}

const mostValuable = (list: Placed[]) => list.reduce<Placed | undefined>((a, b) => (!a || V[b.type] > V[a.type] ? b : a), undefined)

/** Pieces of `color` (value ≥3, not king) attacked by the enemy and not defended. */
function hanging(pos: Chess, color: Color): Placed[] {
  return pieces(pos, color).filter(
    (p) => p.type !== 'k' && V[p.type] >= 3 && pos.attackers(p.sq, other(color)).length > 0 && pos.attackers(p.sq, color).length === 0,
  )
}

/** Pieces of `color` absolutely pinned to their king. */
function pinned(pos: Chess, color: Color): Placed[] {
  const king = kingSq(pos, color)
  if (!king || pos.isAttacked(king, other(color))) return []
  return pieces(pos, color).filter((p) => {
    if (p.type === 'k') return false
    const probe = new Chess(pos.fen(), { skipValidation: true })
    probe.remove(p.sq)
    return probe.isAttacked(king, other(color))
  })
}

/** Distinct enemy pieces attacking the king of `color` or the squares around it. */
function pressure(pos: Chess, color: Color): number {
  const king = kingSq(pos, color)
  if (!king) return 0
  const f = king.charCodeAt(0) - 97
  const r = Number(king[1])
  const attackers = new Set<Square>()
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const nf = f + df
      const nr = r + dr
      if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue
      for (const a of pos.attackers(`${String.fromCharCode(97 + nf)}${nr}` as Square, other(color))) attackers.add(a)
    }
  }
  return attackers.size
}

function material(pos: Chess, color: Color): number {
  let sum = 0
  for (const p of pieces(pos)) if (p.type !== 'k') sum += p.color === color ? V[p.type] : -V[p.type]
  return sum
}

function phaseOf(pos: Chess): Phase {
  const fullmove = Number(pos.fen().split(' ')[5])
  if (fullmove <= 10) return 'opening'
  const heavy = pieces(pos).reduce((s, p) => s + (p.type === 'k' || p.type === 'p' ? 0 : V[p.type]), 0)
  return heavy <= 26 ? 'endgame' : 'middlegame'
}

const materialState = (diff: number): MaterialState => (diff >= 3 ? 'ahead' : diff <= -3 ? 'behind' : 'even')

const sameSet = (a: Placed[], p: Placed) => a.some((x) => x.sq === p.sq && x.type === p.type)

// ── situation detection (03 §2) ────────────────────────────────────────────

function detect(before: Chess, after: Chess, move: Move, evals: (number | undefined)[], ply: number): Detected {
  const me = move.color
  const them = other(me)
  const role = (t: PieceSymbol) => ROLE_BY_PIECE[t]
  const mover: Speech = { situation: 'quiet', sq: move.to, color: me, role: role(move.piece) }
  const say = (situation: Situation, extra: Partial<Speech> = {}): Speech => ({ ...mover, situation, ...extra })
  const lordOf = (c: Color): Speech => ({ situation: 'quiet', sq: kingSq(after, c), color: c, role: 'lord' })

  const checker = () => {
    const atk = after.attackers(kingSq(after, them), me)
    const sq = atk.includes(move.to) ? move.to : atk[0]
    const p = after.get(sq)
    return p ? { sq, role: role(p.type) } : { sq: move.to, role: mover.role }
  }

  // 1–3: mate, draw, check
  if (after.isCheckmate()) return { primary: say('checkmate', checker()), reply: { ...lordOf(them), situation: 'mated' } }
  if (after.isDraw() || after.isStalemate()) {
    const tokugawa = sideColor.tokugawa
    return {
      primary: { ...lordOf(tokugawa), situation: 'draw' },
      reply: { ...lordOf(other(tokugawa)), situation: 'draw' },
    }
  }
  if (after.inCheck()) return { primary: say('check', checker()), reply: { ...lordOf(them), situation: 'checked' } }

  // 4: promotion — the pawn celebrates, as a pawn
  if (move.promotion) return { primary: say('promotion', { role: 'ashigaru', target: { role: role(move.promotion), color: me } }) }

  // 5: fork
  const targets = pieces(after, them).filter(
    (t) =>
      after.attackers(t.sq, me).includes(move.to) &&
      (t.type === 'k' || (V[t.type] >= 3 && (V[t.type] > V[move.piece] || after.attackers(t.sq, them).length === 0))),
  )
  if (targets.length >= 2) {
    const victim = mostValuable(targets.filter((t) => t.type !== 'k'))
    const best = victim ?? targets[0]
    return {
      primary: say('fork', { target: { role: role(best.type), color: them } }),
      reply: victim && { situation: 'forked', sq: victim.sq, color: them, role: role(victim.type), optional: true },
    }
  }

  // 6: captures (en passant is classified separately at 10)
  const isEp = move.flags.includes('e')
  if (move.captured && !isEp) {
    const cap = move.captured
    const recapturable = after.attackers(move.to, them).length > 0
    const situation: Situation = V[cap] > V[move.piece] ? 'capture_up' : V[cap] === V[move.piece] && recapturable ? 'trade' : 'capture'
    return {
      primary: say(situation, { target: { role: role(cap), color: them } }),
      reply: V[cap] >= 3 ? { situation: 'fallen', sq: move.to, color: them, role: role(cap) } : undefined,
    }
  }

  // 7–8: sacrifice / brilliant, blunder
  const attackersHere = after.attackers(move.to, them)
  const sacrifice =
    V[move.piece] >= 3 &&
    move.piece !== 'k' &&
    attackersHere.length > 0 &&
    (attackersHere.some((sq) => V[after.get(sq)!.type] < V[move.piece]) || after.attackers(move.to, me).length === 0)
  const sign = me === 'w' ? 1 : -1
  const eBefore = evals[ply - 1]
  const eNow = evals[ply]
  const eNext = evals[ply + 1] ?? eNow
  if (sacrifice) {
    const sound = eBefore !== undefined && eNow !== undefined && sign * (eNow - eBefore) >= -50
    return { primary: say(sound ? 'brilliant' : 'sacrifice') }
  }
  if (eBefore !== undefined && eNext !== undefined && !(Math.abs(eBefore) > 600 && Math.abs(eNext) > 600)) {
    if (sign * (eNext - eBefore) <= -150) {
      const queen = after.findPiece({ type: 'q', color: them })[0]
      return { primary: queen ? { situation: 'blunder', sq: queen, color: them, role: 'commander' } : { ...lordOf(them), situation: 'blunder' } }
    }
  }

  // 9–10: castle, en passant
  if (move.flags.includes('k') || move.flags.includes('q')) {
    const rank = me === 'w' ? '1' : '8'
    const rookSq = `${move.flags.includes('k') ? 'f' : 'd'}${rank}` as Square
    return {
      primary: { situation: 'castle', sq: rookSq, color: me, role: 'garrison' },
      reply: { ...lordOf(me), situation: 'castle', optional: true },
    }
  }
  if (isEp) return { primary: say('en_passant', { target: { role: 'ashigaru', color: them } }) }

  // 11–13: victims speak
  const hangBefore = hanging(before, them)
  const newlyHanging = mostValuable(hanging(after, them).filter((p) => !sameSet(hangBefore, p)))
  if (newlyHanging) return { primary: { situation: 'hanging', sq: newlyHanging.sq, color: them, role: role(newlyHanging.type) } }

  const pinBefore = pinned(before, them)
  const newlyPinned = mostValuable(pinned(after, them).filter((p) => !sameSet(pinBefore, p)))
  if (newlyPinned) return { primary: { situation: 'pinned', sq: newlyPinned.sq, color: them, role: role(newlyPinned.type) } }

  const pAfter = pressure(after, them)
  if (pAfter >= 2 && pAfter > pressure(before, them)) {
    const queen = after.findPiece({ type: 'q', color: them })[0]
    return {
      primary: { ...lordOf(them), situation: 'king_danger' },
      reply: queen ? { situation: 'king_danger', sq: queen, color: them, role: 'commander', optional: true } : undefined,
    }
  }

  // 14–17: the mover's own moment
  const toRank = Number(move.to[1])
  const fromRank = Number(move.from[1])
  const relRank = me === 'w' ? toRank : 9 - toRank
  if (move.piece === 'p' && (relRank === 6 || relRank === 7)) return { primary: say('pawn_near_promotion') }
  if (move.piece !== 'p' && (me === 'w' ? toRank < fromRank : toRank > fromRank)) return { primary: say('retreat') }
  const homes: Record<Color, string[]> = { w: ['b1', 'g1', 'c1', 'f1'], b: ['b8', 'g8', 'c8', 'f8'] }
  const fullmove = Number(before.fen().split(' ')[5])
  if ((move.piece === 'n' || move.piece === 'b') && homes[me].includes(move.from) && fullmove <= 12) return { primary: say('development') }
  return { primary: say('quiet') }
}

// side ↔ color mapping, set per game in buildStory (03 §3)
const sideColor: Record<Side, Color> = { tokugawa: 'w', akechi: 'b' }
const sideOf = (c: Color): Side => (c === sideColor.tokugawa ? 'tokugawa' : 'akechi')

// ── line selection (03 §4) ─────────────────────────────────────────────────

const SITUATION_FALLBACK: Partial<Record<Situation, Situation>> = {
  capture_up: 'capture',
  trade: 'capture',
  en_passant: 'capture',
  brilliant: 'sacrifice',
  forked: 'hanging',
  checked: 'king_danger',
  mated: 'defeat',
  checkmate: 'check',
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

interface PickContext {
  fen: string
  ply: number
  phase: Phase
  material: MaterialState
  targetRole?: Role
}

function conditionsMatch(line: DialogueLine, ctx: PickContext): boolean {
  const c = line.conditions
  if (!c) return true
  if (c.phase && c.phase !== ctx.phase) return false
  if (c.material && c.material !== ctx.material) return false
  if (c.targetRole && c.targetRole !== ctx.targetRole) return false
  return true
}

function pickLine(side: Side, role: Role, situation: Situation, ctx: PickContext, recent: Set<string>): { line: DialogueLine; hash: number } | null {
  const chain: [Side, Role | 'any', Situation | undefined][] = [
    [side, role, situation],
    [side, role, SITUATION_FALLBACK[situation]],
    [side, role, 'any'],
    [side, 'any', 'any'],
  ]
  for (const [s, r, sit] of chain) {
    if (!sit) continue
    let pool = LINES.filter(
      (l) => l.side === s && l.role === r && l.situation === sit && conditionsMatch(l, ctx) && (ctx.targetRole || !l.text.includes('{target}')),
    )
    if (!pool.length) continue
    const fresh = pool.filter((l) => !recent.has(l.id))
    if (fresh.length) pool = fresh
    const hash = fnv1a(`${ctx.fen}|${ctx.ply}|${s}|${r}|${sit}`)
    const weight = (l: DialogueLine) => (l.weight ?? 1) * (l.conditions ? 3 : 1)
    let n = hash % pool.reduce((sum, l) => sum + weight(l), 0)
    for (const l of pool) {
      n -= weight(l)
      if (n < 0) return { line: l, hash }
    }
  }
  return null
}

function fill(text: string, speakerSide: Side, target: Speech['target'], square: string): string {
  const enemy: Side = speakerSide === 'tokugawa' ? 'akechi' : 'tokugawa'
  const name = target ? DISPLAY_NAME[sideOf(target.color)][target.role] : ''
  return text
    .replace(/\b([Aa]) \{target\}/g, (_, a: string) => (/^[aeiouAEIOU]/.test(name) ? `${a}n ${name}` : `${a} ${name}`))
    .replaceAll('{target}', name)
    .replaceAll('{square}', square)
    .replaceAll('{lord}', DISPLAY_NAME[speakerSide].lord)
    .replaceAll('{enemyLord}', DISPLAY_NAME[enemy].lord)
}

// ── public API ─────────────────────────────────────────────────────────────

function assignSides(game: GameRecord): Color {
  sideColor.tokugawa = game.ourColor === 'white' ? 'w' : 'b'
  sideColor.akechi = other(sideColor.tokugawa)
  return sideColor.tokugawa
}

export interface EndingLine {
  side: Side
  who: string
  text: string
  mood: DialogueLine['mood']
}

/** The two lords' closing lines for the end screen (01 §End screens): winner first, or Tokugawa first on a draw. */
export function buildEnding(game: GameRecord): EndingLine[] {
  assignSides(game)
  const fen = game.moves.at(-1)?.fenAfter ?? game.startFen
  const pos = new Chess(fen, { skipValidation: true })
  const say = (side: Side, situation: Situation): EndingLine | null => {
    const color = sideColor[side]
    const ctx: PickContext = { fen, ply: game.moves.length, phase: phaseOf(pos), material: materialState(material(pos, color)) }
    const picked = pickLine(side, 'lord', situation, ctx, new Set())
    return picked && { side, who: DISPLAY_NAME[side].lord, text: fill(picked.line.text, side, undefined, kingSq(pos, color) ?? ''), mood: picked.line.mood }
  }
  const lines =
    game.winner === 'us'
      ? [say('tokugawa', 'victory'), say('akechi', 'defeat')]
      : game.winner === 'stockfish'
        ? [say('akechi', 'victory'), say('tokugawa', 'defeat')]
        : [say('tokugawa', 'draw'), say('akechi', 'draw')]
  return lines.filter((l): l is EndingLine => l !== null)
}

/** Compute the story for every ply of a game, forward from ply 0 (03 §1). Index = ply. */
export function buildStory(game: GameRecord): PlyStory[] {
  const us = assignSides(game)

  const raw = [0, ...game.moves.map((m) => (m.mate == null ? (m.evalCp ?? undefined) : undefined))]
  // Stockfish sometimes reports exactly 0 in clearly decided positions; a 0 next to a big eval is noise.
  const big = (e: number | undefined) => e !== undefined && Math.abs(e) >= 200
  const evals = raw.map((e, i) => (e === 0 && i > 0 && (big(raw[i - 1]) || big(raw[i + 1])) ? undefined : e))
  const used: string[][] = []
  const recent = () => new Set(used.slice(-RECENT_PLIES).flat())

  const speak = (s: Speech, ply: number, pos: Chess, isReply: boolean, key: boolean): Bubble | null => {
    const side = sideOf(s.color)
    const ctx: PickContext = {
      fen: pos.fen(),
      ply,
      phase: phaseOf(pos),
      material: materialState(material(pos, s.color)),
      targetRole: s.target?.role,
    }
    const picked = pickLine(side, s.role, s.situation, ctx, recent())
    if (!picked) return null
    // Quiet chatter: about half of quiet moves stay silent (03 §4).
    if (s.situation === 'quiet' && picked.hash % 2 === 1) return null
    return {
      ply,
      square: s.sq,
      side,
      role: s.role,
      situation: s.situation,
      lineId: picked.line.id,
      text: fill(picked.line.text, side, s.target, s.sq),
      mood: picked.line.mood,
      isReply,
      key,
    }
  }

  const start = new Chess(game.startFen, { skipValidation: true })
  const out: PlyStory[] = []

  // Ply 0: both lords open the night.
  const opening = [
    speak({ situation: 'game_start', sq: kingSq(start, us), color: us, role: 'lord' }, 0, start, false, true),
    speak({ situation: 'game_start', sq: kingSq(start, other(us)), color: other(us), role: 'lord' }, 0, start, true, true),
  ].filter((b): b is Bubble => b !== null)
  used.push(opening.map((b) => b.lineId))
  out.push({ ply: 0, situation: null, bubbles: opening, phase: 'opening', material: 'even', kingInDanger: false })

  let prevFen = game.startFen
  game.moves.forEach((m, i) => {
    const ply = i + 1
    const before = new Chess(prevFen, { skipValidation: true })
    const after = new Chess(prevFen, { skipValidation: true })
    let move: Move | null = null
    try {
      move = after.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] })
    } catch {
      // Illegal per chess.js (should not happen with python-chess output) — show the position silently.
    }
    const pos = new Chess(m.fenAfter, { skipValidation: true })
    prevFen = m.fenAfter

    const danger = pos.inCheck() || pressure(pos, 'w') >= DANGER_PRESSURE || pressure(pos, 'b') >= DANGER_PRESSURE
    const base = { ply, phase: phaseOf(pos), material: materialState(material(pos, us)), kingInDanger: danger }
    if (!move) {
      used.push([])
      out.push({ ...base, situation: null, bubbles: [] })
      return
    }

    const d = detect(before, pos, move, evals, ply)
    const key = (PRIORITY[d.primary.situation] ?? 99) <= KEY_MOMENT_MAX_PRIORITY
    const bubbles: Bubble[] = []
    const first = speak(d.primary, ply, pos, false, key)
    if (first) bubbles.push(first)
    if (d.reply) {
      const reply = speak(d.reply, ply, pos, true, key && !d.reply.optional)
      if (reply) bubbles.push(reply)
    }
    used.push(bubbles.map((b) => b.lineId))
    out.push({ ...base, situation: d.primary.situation, bubbles })
  })
  return out
}
