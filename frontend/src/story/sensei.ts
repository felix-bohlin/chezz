// The hermit sensei: commentary on notable moves of a replay, driven by the Stockfish post-mortem.
// analyze.py ends its report with `<!-- sensei-moves {...} -->` (both sides' blunders, mistakes,
// good and brilliant moves); the analyze-game skill pastes that report into the .analysis.md.
// Pure and deterministic, like the dialogue engine: same game, same comments.

import { fnv1a } from "./dialogue";
import type { GameRecord } from "../types/game";
import linesJson from "./sensei-lines.json";

export type SenseiKind = "blunder" | "mistake" | "good" | "brilliant";

export interface SenseiNote {
  ply: number;
  by: "us" | "stockfish";
  kind: SenseiKind;
  san: string;
  /** Stockfish's best move in the position before (equals `san` for good/brilliant). */
  best: string;
  /** Eval before and after the move, centipawns from OUR point of view. */
  before: number;
  after: number;
  /** Centipawns lost (blunder/mistake only). */
  loss?: number;
}

/** Not tied to a move: the greeting before the first move and the verdict after the last. */
export type SenseiOccasion = "intro" | "victory" | "defeat" | "draw";

/** One thing the sensei says at a ply: a verdict on the move just played, or an occasion line. */
export interface SenseiSpeech {
  ply: number;
  lineId: string;
  text: string;
  note?: SenseiNote;
  occasion?: SenseiOccasion;
}

interface SenseiLine {
  id: string;
  by?: SenseiNote["by"];
  kind: SenseiKind | SenseiOccasion;
  text: string;
}

const LINES = linesJson as SenseiLine[];
/** Don't reuse a line within this many comments of the same bucket. */
const RECENT = 4;

export const SENSEI_NAME = "Master Roshi";

export const KIND_LABEL: Record<
  SenseiKind,
  { kanji: string; word: string; glyph: string }
> = {
  blunder: { kanji: "大悪手", word: "Blunder", glyph: "??" },
  mistake: { kanji: "悪手", word: "Mistake", glyph: "?" },
  good: { kanji: "好手", word: "Good move", glyph: "!" },
  brilliant: { kanji: "妙手", word: "Brilliant", glyph: "!!" },
};

const BLOCK_RE = /<!--\s*sensei-moves\s+(\{[\s\S]*?\})\s*-->/;

/** The notable moves recorded in an analysis report, or [] for older reports without the block. */
export function parseSenseiNotes(analysis: string | null): SenseiNote[] {
  const m = analysis?.match(BLOCK_RE);
  if (!m) return [];
  try {
    const data = JSON.parse(m[1]) as { v: number; moves: SenseiNote[] };
    return Array.isArray(data.moves) ? data.moves : [];
  } catch {
    return [];
  }
}

function fill(text: string, n: SenseiNote): string {
  return text
    .replaceAll("{san}", n.san)
    .replaceAll("{best}", n.best)
    .replaceAll("{pawns}", ((n.loss ?? 0) / 100).toFixed(1));
}

const OCCASION: Record<GameRecord["winner"], SenseiOccasion> = {
  us: "victory",
  stockfish: "defeat",
  draw: "draw",
};

function occasionLine(
  game: GameRecord,
  occasion: SenseiOccasion,
  ply: number,
): SenseiSpeech {
  const pool = LINES.filter((l) => l.kind === occasion);
  const line = pool[fnv1a(`${game.id}|${occasion}`) % pool.length];
  return { ply, lineId: line.id, text: line.text, occasion };
}

/**
 * Ply → what the sensei says there: a greeting at ply 0, a verdict on every notable move, and the
 * final word after the last move (unless the last move itself earned a comment). Empty without notes.
 */
export function buildSensei(
  game: GameRecord,
  notes: SenseiNote[],
): Map<number, SenseiSpeech> {
  const out = new Map<number, SenseiSpeech>();
  if (!notes.length) return out;
  out.set(0, occasionLine(game, "intro", 0));
  const recent = new Map<string, string[]>();
  for (const n of [...notes].sort((a, b) => a.ply - b.ply)) {
    const bucket = `${n.by}|${n.kind}`;
    const used = recent.get(bucket) ?? [];
    const usable = LINES.filter(
      (l) =>
        l.by === n.by &&
        l.kind === n.kind &&
        (!l.text.includes("{best}") ||
          (n.best && n.best !== "?" && n.best !== n.san)),
    );
    const fresh = usable.filter((l) => !used.includes(l.id));
    const pool = fresh.length ? fresh : usable;
    if (!pool.length) continue;
    const line = pool[fnv1a(`${game.id}|${n.ply}|${bucket}`) % pool.length];
    recent.set(bucket, [...used, line.id].slice(-RECENT));
    out.set(n.ply, {
      ply: n.ply,
      lineId: line.id,
      text: fill(line.text, n),
      note: n,
    });
  }
  const last = game.moves.length;
  if (last > 0 && !out.has(last))
    out.set(last, occasionLine(game, OCCASION[game.winner], last));
  return out;
}
