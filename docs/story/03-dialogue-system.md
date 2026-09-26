# 03 — Dialogue system

This spec explains how the frontend decides, for every ply, **which piece speaks and what it says**. It is all computed in the browser from the `GameRecord`, costs no tokens, and is deterministic.

- Types: [`frontend/src/story/types.ts`](../../frontend/src/story/types.ts)
- Line data: [`frontend/src/story/lines.json`](../../frontend/src/story/lines.json)
- Implementation: [`frontend/src/story/dialogue.ts`](../../frontend/src/story/dialogue.ts), where `buildStory(game)` returns a `PlyStory` (bubbles, situation, phase, material, danger) per ply
- Library: `chess.js` ≥ 1.0 (`attackers`, `isAttacked`, `remove`, `move()` flags)

## 1. Pipeline

```
for ply i = 1..N (plus ply 0 for game start):
  prev   = new Chess(moves[i-1].fenAfter  or start FEN)
  move   = prev.move(uci)            // chess.js Move: piece, captured, promotion, flags, from, to
  after  = new Chess(moves[i].fenAfter)
  ctx    = buildContext(prev, after, move, evals, i)
  events = detectSituations(ctx)                 // §2
  primary = highest-priority event               // PRIORITY in types.ts
  bubbles[i] = [ speak(primary), reply(primary)? ]   // §3, §4
```

**Compute all bubbles once**, forward from ply 0, when a game loads, and cache them as `Bubble[][]` indexed by ply. Scrubbing, stepping and jumping only read from this array. Anti-repeat (§4) depends on the earlier plies, so the result must be computed in order and never on the fly.

`ctx` contains: `mover` (color), `moverSide` / `otherSide` (`tokugawa|akechi`), `move`, `prev`, `after`, `ply`, `phase`, `material` (per side), and `evals` (white-POV series, §2.4).

## 2. Situations

### 2.1 Priority table

At most **2 bubbles per ply**: one primary and one optional reply. The primary is the detected situation with the lowest priority number.

| Pri | Situation | Detection | Speaker | Reply |
|---|---|---|---|---|
| 1 | `checkmate` | `after.isCheckmate()` | checking piece | mated lord → `mated` |
| 2 | `draw` | `after.isDraw()` (stalemate, repetition, 50-move, insufficient material) | Tokugawa lord | Akechi lord → `draw` |
| 3 | `check` | `after.inCheck()` | checking piece (see 2.3) | checked lord → `checked` |
| 4 | `promotion` | `move.flags` has `p` | promoted piece (speaks as `ashigaru`) | — |
| 5 | `fork` | moved piece attacks ≥2 "real targets" (2.3) | mover | most valuable target → `forked` (`all` mode only) |
| 6 | `capture_up` | capture, `value(captured) > value(piece)` | mover | captured piece → `fallen` if its value ≥3 |
| 6 | `trade` | capture, equal value, and mover is attacked on `to` | mover | same as above |
| 6 | `capture` | any other capture | mover | same as above |
| 7 | `sacrifice` | see 2.3 | mover | — |
| 8 | `brilliant` | sacrifice that the evals say is sound (2.4) | mover | — |
| 8 | `blunder` | eval collapse for the mover (2.4) | **opponent's commander** (lord if no commander) | — |
| 9 | `castle` | `move.flags` has `k` or `q` | the rook (`rider`) | lord → `castle` (`all` mode only) |
| 10 | `en_passant` | `move.flags` has `e` (classified **instead of** `capture`) | mover | — |
| 11 | `hanging` | newly undefended and attacked enemy piece (2.3) | **the victim** | — |
| 12 | `pinned` | newly pinned enemy piece (2.3) | **the victim** | — |
| 13 | `king_danger` | pressure on the enemy king zone increased (2.3) | **the victim lord** | its commander → `king_danger` (`all` mode only) |
| 14 | `pawn_near_promotion` | pawn moved to relative rank 6 or 7 | mover | — |
| 15 | `retreat` | non-capture, non-pawn move toward own back rank | mover | — |
| 16 | `development` | knight or bishop leaves its starting square, fullmove ≤ 12 | mover | — |
| 17 | `quiet` | none of the above | mover | — |

**Game-level events**, outside the priority table:
- **Ply 0:** `game_start` from the Tokugawa lord, then a reply from the Akechi lord.
- **After the last ply:** the end screen ([01](01-intro-story.md#end-screens)) shows `victory` from the winner's lord and `defeat` from the loser's lord, or `draw` from both. These use `GameRecord.winner`, so resignation, time forfeit and adjudication are covered too.

### 2.2 Piece values

`p=1, n=3, b=3, r=5, q=9, k=100` (only used for comparisons).

### 2.3 Detection details

```ts
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const me = move.color, them = me === "w" ? "b" : "w";

// defenders/attackers of a square (chess.js ≥1.0)
const attackersOf = (pos, sq, color) => pos.attackers(sq, color);   // Square[]

// checking piece: prefer the mover; otherwise first attacker of the king (discovered check)
checker = attackersOf(after, kingSq(after, them), me).includes(move.to)
        ? move.to : attackersOf(after, kingSq(after, them), me)[0];

// fork: "real targets" = enemy king, or enemy piece with value ≥3 that is
//        worth more than the mover or undefended
targets = enemyPieces(after).filter(t =>
  attackersOf(after, t.sq, me).includes(move.to) &&
  (t.type === "k" || (V[t.type] >= 3 &&
     (V[t.type] > V[move.piece] || attackersOf(after, t.sq, them).length === 0))));
fork = targets.length >= 2;

// sacrifice: a valuable piece steps into danger without winning equal material
sacrifice = V[move.piece] >= 3 && !move.promotion &&
  (V[move.captured] ?? 0) < V[move.piece] &&
  attackersOf(after, move.to, them).some(sq =>
     V[after.get(sq).type] < V[move.piece] ||
     attackersOf(after, move.to, me).length === 0);

// hanging: enemy piece (value ≥3, not king) attacked by us, zero defenders,
//          and NOT already hanging in prev. Victim = most valuable one.
// pinned:  for each enemy non-king piece P: clone `after`, remove(P.sq);
//          pinned if their king is now attacked by us. Only NEW pins (not pinned in prev).
//          Victim = most valuable newly pinned piece.
// king_danger: zone = their king square + its 8 neighbours;
//          pressure = number of DISTINCT squares of our pieces attacking any zone square;
//          fire if pressure >= 2 AND pressure(after) > pressure(prev).
// retreat: rank moves toward own back rank (white: toRank < fromRank), not a capture, not a pawn.
// pawn_near_promotion: pawn, relative rank of `to` is 6 or 7, not a promotion.
```

### 2.4 Evals (`blunder` / `brilliant`)

`evalCp` in the `GameRecord` is recorded by whichever engine made the move, and it is **already from White's point of view**, clamped to ±2000 (see `CLAUDE.md` and `frontend/src/types/game.ts`). A mate score shows up as ±2000 with `mate` set, and is treated as missing here:

```ts
E[i] = moves[i].mate == null ? moves[i].evalCp ?? undefined : undefined
```

- **blunder at ply i:** `sign(mover) * (E[i+1] - E[i-1]) <= -150`, where `E[i+1]` is the opponent's evaluation after replying. If `E[i+1]` is missing, use `E[i]`. Skip when both |E| > 600 (the game is already decided).
- **brilliant at ply i:** `sacrifice` is detected AND `sign(mover) * (E[i] - E[i-1]) >= -50` (the engine still thinks it is fine after giving material away).
- **Stockfish zero-eval noise:** Stockfish sometimes records exactly `0` in clearly decided positions. A `0` next to an eval of |E| ≥ 200 is treated as missing.
- If any eval needed is missing, skip these situations. The ply falls through to its next situation.

### 2.5 Context values used by line conditions

- `phase`: `opening` if fullmove ≤ 10; `endgame` if total non-pawn, non-king material on the board ≤ 26 (queens off, or equivalent); else `middlegame`.
- `material`: from the **speaker's** side, material difference ≥ +3 → `ahead`, ≤ −3 → `behind`, else `even`.
- `targetRole`: the captured, attacked, forked or pinned piece's role; for `promotion`, the role promoted **to**.

## 3. Speaker

- `side` = speaker's color mapped via `ourColor` (Tokugawa = ours; for a bare FEN, White = Tokugawa).
- `role` = `ROLE_BY_PIECE[piece.type]`.
- Promotion speaks as `ashigaru` (the pawn celebrates becoming something bigger).
- `fallen` reply is anchored on the capture square while the death animation plays.
- If the chosen speaker has **no line** after the full fallback chain (§4), there is no bubble for this ply. The animation reaction still fires.

## 4. Line selection

```ts
function pickLine(side, role, situation, ctx, recentIds): DialogueLine | null {
  const chain = [
    [side, role, situation],
    [side, role, SITUATION_FALLBACK[situation]],   // may be undefined → skip
    [side, role, "any"],
    [side, "any", "any"],
  ];
  for (const [s, r, sit] of chain) {
    if (!sit) continue;
    let pool = lines.filter(l => l.side === s && l.role === r && l.situation === sit
                              && conditionsMatch(l.conditions, ctx));
    if (!pool.length) continue;
    const fresh = pool.filter(l => !recentIds.has(l.id));   // last 10 plies
    if (fresh.length) pool = fresh;
    const h = fnv1a(`${ctx.fen}|${ctx.ply}|${s}|${r}|${sit}`);
    return weightedPick(pool, h, l => (l.weight ?? 1) * (l.conditions ? 3 : 1));
  }
  return null;
}

const SITUATION_FALLBACK = {
  capture_up: "capture", trade: "capture", en_passant: "capture",
  brilliant: "sacrifice", forked: "hanging", checked: "king_danger",
  mated: "defeat", checkmate: "check",
};
```

Rules:
- **Conditions** must *all* match. A line without conditions always matches. Matching conditional lines get 3× weight, so a situation-specific line (e.g. "We are few. That is enough." when `behind`) is preferred but doesn't always win.
- **Deterministic:** hash = FNV-1a 32-bit of the string above. The same game always gives the same bubbles, on every machine.
- **Anti-repeat:** a line used in the last 10 plies is skipped unless it is the only option.
- **Quiet chatter:** in `all` mode, a `quiet` bubble is shown only when `h % 2 === 0`, so about half of quiet moves stay silent. Silence is part of the atmosphere.

### Template tokens

| Token | Filled with |
|---|---|
| `{target}` | `DISPLAY_NAME[targetSide][targetRole]` (the target's own side) |
| `{square}` | `move.to` |
| `{lord}` | speaker side's lord display name |
| `{enemyLord}` | the other side's lord display name |

If a token can't be filled (e.g. `{target}` on a line reached through the `any` fallback), skip that line and choose again from the pool.

## 5. Display

**Modes** (toggle in the replay UI, remembered per viewer):
- `off`: no bubbles (reactions still play).
- `key`: only situations with priority ≤ 10 (`KEY_MOMENT_MAX_PRIORITY`), plus game events. **Default.**
- `all`: every ply, including victim situations, replies and quiet chatter.

**Timing:**
- In autoplay, a bubble is visible for `clamp(1200 + 45 ms × chars, 1500, 4000)` ms. The reply appears 600 ms after the primary.
- When stepping manually, bubbles stay until the next step.
- Autoplay waits for bubbles to finish before the next move only in `key` mode, so the key moments get their time.

**Anchoring:** above the speaker's piece in 3D (billboarded, always facing the camera) and above the tile in 2D. Keep the bubble inside the viewport; flip it below the piece near the top edge.

**Mood → bubble style** (the same `mood` also cues the reaction, see [04](04-animation-reactions.md)):

| Mood | Bubble style |
|---|---|
| `calm` | Rice-paper white, soft rounded brush outline |
| `sly` | Indigo paper, narrow, a small smoke curl on the tail |
| `proud` | Gold-leaf edge, slightly larger text |
| `fear` | Wobbly thin outline, the bubble trembles slightly |
| `anger` | Jagged brush edge, red ink |
| `triumph` | Large, with a red *hanko* seal stamp in the corner |
| `grief` | Grey ink wash; fades out slowly |

**Side accent:** Tokugawa bubbles use a small hollyhock crest, Akechi bubbles a bellflower crest. The viewer should always know who's talking without reading the text.

## 6. Worked example

Scholar's mate, with Tokugawa as White. The lines shown are examples; the exact pick depends on the hash.

| Ply | Move | Detected (primary) | Speaker | Example line | Reply |
|---|---|---|---|---|---|
| 0 | — | `game_start` | Ieyasu | "Patience. The road home is long." | Mitsuhide: "Bring me Tokugawa's head." |
| 1 | e4 | `quiet` | Tokugawa ashigaru | "Is it far to Okazaki?" | — |
| 2 | e5 | `quiet` | hunter | "Search the paddies, lads." | — |
| 3 | Bc4 | `development` | yamabushi | "Let us walk the slanted way." | — |
| 4 | Nc6 | `development` | Kōka scout | "Kōka sees everything." | — |
| 5 | Qh5 | `pinned` (f7 is pinned to e8 by Qh5; this beats `king_danger`) | **hunter on f7** (victim) | "Can't move, can't run. Great." | — |
| 6 | Nf6?? | `blunder` (eval swing), which beats `development` and `hanging` (Qh5 is attacked by Nf6) | **Hanzō** (opponent's commander) | "A mistake. I will not let it pass." | — |
| 7 | Qxf7# | `checkmate` | Hanzō | "It is finished. Go home, my lord." | Mitsuhide: "So the fox escapes the hound." |
| end | 1-0 | end screen | Ieyasu / Mitsuhide | "Okazaki's gates. We are home." / "Three days. My reign lasted three days." | — |

Without evals, ply 6 falls through to `hanging`: Hanzō (the attacked queen) says "They reach for me. Let them try." It is still appropriate, which is the point of the priority chain.

## 7. Writing lines

- **Max 60 characters.** A bubble must be readable in about 2 seconds.
- **Stay in voice.** Check the role's voice rules in [02-cast.md](02-cast.md). Hanzō never uses more than a few words; ashigaru never sound heroic, except when promoting.
- **Fit the situation exactly.** A `fallen` line is last words. A `hanging` line is spoken *before* anything happens. A `blunder` line is the **opponent** gloating.
- **No modern slang or chess jargon.** The only exception: "check" said clumsily by an ashigaru.
- **Tokens only where they will be filled:** `{target}` only in `capture`, `capture_up`, `trade`, `fork` and `promotion` lines, where the target is unambiguous (the captured piece, the most valuable forked piece, or the promoted-to role).
- **Ids** follow `<t|a>.<role>.<situation>.<nn>`, for example `t.ninja.fork.03`. Never reuse or renumber an id; old ids may be referenced in saved notes.
- **Coverage target:** every role × side has ≥2 `any` lines, and at least 1 line for every situation it can actually trigger. Pawns never trigger `retreat` or `development`, and only lords are `checked`/`mated`.
- **Validate** after editing: `node frontend/scripts/check-lines.mjs`. It checks the JSON, unique ids, that enums match `types.ts`, the 60-character limit, and minimum coverage.
