// The hermit sensei: commentary on notable moves of a replay, driven by the Stockfish post-mortem.
// analyze.py ends its report with `<!-- sensei-moves {...} -->` (both sides' blunders, mistakes,
// good and brilliant moves); the analyze-game skill pastes that report into the .analysis.md.
// Pure and deterministic, like the dialogue engine: same game, same comments.

import { fnv1a } from './dialogue'
import linesJson from './sensei-lines.json'

export type SenseiKind = 'blunder' | 'mistake' | 'good' | 'brilliant'

export interface SenseiNote {
  ply: number
  by: 'us' | 'stockfish'
  kind: SenseiKind
  san: string
  /** Stockfish's best move in the position before (equals `san` for good/brilliant). */
  best: string
  /** Eval before and after the move, centipawns from OUR point of view. */
  before: number
  after: number
  /** Centipawns lost (blunder/mistake only). */
  loss?: number
}

export interface SenseiComment extends SenseiNote {
  lineId: string
  text: string
}

interface SenseiLine {
  id: string
  by: SenseiNote['by']
  kind: SenseiKind
  text: string
}

const LINES = linesJson as SenseiLine[]
/** Don't reuse a line within this many comments of the same bucket. */
const RECENT = 4

export const SENSEI_NAME = 'Old Kamejii'

export const KIND_LABEL: Record<SenseiKind, { kanji: string; word: string; glyph: string }> = {
  blunder: { kanji: '大悪手', word: 'Blunder', glyph: '??' },
  mistake: { kanji: '悪手', word: 'Mistake', glyph: '?' },
  good: { kanji: '好手', word: 'Good move', glyph: '!' },
  brilliant: { kanji: '妙手', word: 'Brilliant', glyph: '!!' },
}

const BLOCK_RE = /<!--\s*sensei-moves\s+(\{[\s\S]*?\})\s*-->/

/** The notable moves recorded in an analysis report, or [] for older reports without the block. */
export function parseSenseiNotes(analysis: string | null): SenseiNote[] {
  const m = analysis?.match(BLOCK_RE)
  if (!m) return []
  try {
    const data = JSON.parse(m[1]) as { v: number; moves: SenseiNote[] }
    return Array.isArray(data.moves) ? data.moves : []
  } catch {
    return []
  }
}

function fill(text: string, n: SenseiNote): string {
  return text
    .replaceAll('{san}', n.san)
    .replaceAll('{best}', n.best)
    .replaceAll('{pawns}', ((n.loss ?? 0) / 100).toFixed(1))
}

/** Ply → the sensei's comment on the move that produced it. */
export function buildSensei(gameId: string, notes: SenseiNote[]): Map<number, SenseiComment> {
  const out = new Map<number, SenseiComment>()
  const recent = new Map<string, string[]>()
  for (const n of [...notes].sort((a, b) => a.ply - b.ply)) {
    const bucket = `${n.by}|${n.kind}`
    const used = recent.get(bucket) ?? []
    const usable = LINES.filter(
      (l) => l.by === n.by && l.kind === n.kind && (!l.text.includes('{best}') || (n.best && n.best !== '?' && n.best !== n.san)),
    )
    const fresh = usable.filter((l) => !used.includes(l.id))
    const pool = fresh.length ? fresh : usable
    if (!pool.length) continue
    const line = pool[fnv1a(`${gameId}|${n.ply}|${bucket}`) % pool.length]
    recent.set(bucket, [...used, line.id].slice(-RECENT))
    out.set(n.ply, { ...n, lineId: line.id, text: fill(line.text, n) })
  }
  return out
}
