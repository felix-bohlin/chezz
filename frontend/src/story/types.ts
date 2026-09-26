// Dialogue contract for the "Night of Iga" story layer.
// Spec: docs/story/03-dialogue-system.md — keep the unions in sync with lines.json.

export type Side = "tokugawa" | "akechi";

export type Role = "lord" | "commander" | "ninja" | "monk" | "garrison" | "ashigaru";

export type ArmorClass = "none" | "light" | "heavy" | "heaviest";

export type Mood = "calm" | "sly" | "proud" | "fear" | "anger" | "triumph" | "grief";

export type Phase = "opening" | "middlegame" | "endgame";

export type MaterialState = "ahead" | "even" | "behind";

/** Everything a piece can react to. Ordered roughly by priority; see PRIORITY. */
export type Situation =
  // game-level
  | "game_start"
  | "victory"
  | "defeat"
  | "draw"
  // move-level (spoken by the mover unless noted)
  | "checkmate"
  | "mated" // reply: the mated lord
  | "check"
  | "checked" // reply: the checked lord
  | "promotion"
  | "fork"
  | "forked" // reply: most valuable forked piece
  | "capture_up"
  | "capture"
  | "trade"
  | "fallen" // reply: last words of the captured piece
  | "sacrifice"
  | "brilliant"
  | "blunder" // spoken by the opponent's commander, gloating
  | "castle"
  | "en_passant"
  | "hanging" // victim: an undefended piece now attacked
  | "pinned" // victim: a newly pinned piece
  | "king_danger" // victim: the lord whose king zone is under pressure
  | "pawn_near_promotion"
  | "retreat"
  | "development"
  | "quiet"
  // fallback only, never detected
  | "any";

export interface LineConditions {
  phase?: Phase;
  material?: MaterialState; // from the speaker's side
  targetRole?: Role; // captured / attacked / promoted-to role
}

export interface DialogueLine {
  id: string; // "<t|a>.<role>.<situation>.<nn>", e.g. "t.commander.capture.01"
  side: Side | "any";
  role: Role | "any";
  situation: Situation;
  text: string; // may contain {target} {square} {lord} {enemyLord}
  mood: Mood;
  conditions?: LineConditions;
  weight?: number; // default 1
}

/** Lower number = more important. Only the highest-priority primary situation is spoken per ply. */
export const PRIORITY: Partial<Record<Situation, number>> = {
  checkmate: 1,
  draw: 2,
  check: 3,
  promotion: 4,
  fork: 5,
  capture_up: 6,
  capture: 6,
  trade: 6,
  sacrifice: 7,
  brilliant: 8,
  blunder: 8,
  castle: 9,
  en_passant: 10,
  hanging: 11,
  pinned: 12,
  king_danger: 13,
  pawn_near_promotion: 14,
  retreat: 15,
  development: 16,
  quiet: 17,
};

/** "key" display mode shows only situations at or above this priority (plus game events). */
export const KEY_MOMENT_MAX_PRIORITY = 10;

export const ROLE_BY_PIECE: Record<"k" | "q" | "n" | "b" | "r" | "p", Role> = {
  k: "lord",
  q: "commander",
  n: "ninja",
  b: "monk",
  r: "garrison",
  p: "ashigaru",
};

export const ARMOR: Record<Role, ArmorClass> = {
  lord: "heaviest",
  commander: "heavy",
  ninja: "none",
  monk: "light",
  garrison: "heavy",
  ashigaru: "light",
};

/** Used to fill {target}, {lord}, {enemyLord}. */
export const DISPLAY_NAME: Record<Side, Record<Role, string>> = {
  tokugawa: {
    lord: "Lord Ieyasu",
    commander: "Hanzō",
    ninja: "Iga ninja",
    monk: "yamabushi",
    garrison: "castle garrison",
    ashigaru: "ashigaru",
  },
  akechi: {
    lord: "Lord Mitsuhide",
    commander: "Hidemitsu",
    ninja: "Kōka scout",
    monk: "warrior monk",
    garrison: "Akechi garrison",
    ashigaru: "hunter",
  },
};

export type DisplayMode = "off" | "key" | "all";

/** What the dialogue engine emits per ply; the animation system consumes the same event. */
export interface Bubble {
  ply: number;
  square: string; // speaker's square after the move (for anchoring)
  side: Side;
  role: Role;
  situation: Situation;
  lineId: string;
  text: string; // tokens already filled
  mood: Mood;
  isReply: boolean;
  /** Shown in "key" display mode (key-moment primary, or its non-optional reply). */
  key: boolean;
}
