# The Night of Iga: story layer for chezz

**Pitch.** June 1582. Oda Nobunaga has just been betrayed and killed at Honnō-ji. Tokugawa Ieyasu is trapped far from home with a handful of men, and Akechi Mitsuhide's army is hunting him. Legend says Hattori Hanzō, the "Demon Hanzō", led him through the mountains of Iga to safety. **Every chess game in chezz is that night, replayed.** Our engine plays the Tokugawa side. Stockfish plays Akechi's pursuers. The pieces are people: they talk, they are afraid, they gloat, and they move according to who they are and how much armor they wear.

There is **no campaign or Elo progression** in the story. Games run as tests against Stockfish, and the story layer is driven entirely by the **position**: each ply's FEN (plus the move that led to it) decides who speaks, what they say, and how every piece behaves.

## Documents

| Doc | What it covers | Who needs it |
|---|---|---|
| [01-intro-story.md](01-intro-story.md) | Intro scroll script, per-game title card, end screens, history vs legend | FE (intro screen), art |
| [02-cast.md](02-cast.md) | The 6 roles on both sides: personality, voice rules, armor, look | Anyone writing lines, modeling pieces |
| [03-dialogue-system.md](03-dialogue-system.md) | **The core spec**: situation detection, priority, speaker choice, line selection, data schema, worked example | FE (implementation), line writers |
| [04-animation-reactions.md](04-animation-reactions.md) | Movement by role and armor, idle reactions, capture and death, check, mate, promotion | FE (3D + 2D) |
| [05-music-sound.md](05-music-sound.md) | Generative score, tension levels, one sound cue per situation, settings | FE (audio) |

## Code

| File | What it is |
|---|---|
| [`frontend/src/story/types.ts`](../../frontend/src/story/types.ts) | The dialogue contract: `Situation`, `Role`, `Mood`, `DialogueLine`, `Bubble`, priorities, armor and display names |
| [`frontend/src/story/lines.json`](../../frontend/src/story/lines.json) | The line database (282 starter lines, both sides, all roles) |
| [`frontend/scripts/check-lines.mjs`](../../frontend/scripts/check-lines.mjs) | Validator. Run `node frontend/scripts/check-lines.mjs` after editing lines |

## How it fits together

```
GameRecord (games/*.json)          ← from the backend, unchanged contract
  moves[i].fenAfter, uci, evalCp
        │
        ▼
detectSituations(prevFen, fen, move, evals)      03-dialogue-system.md
        │  → primary situation (+ optional reply)
        ▼
pickSpeaker → pickLine(lines.json)                03-dialogue-system.md
        │  → Bubble { square, role, side, situation, text, mood }
        ├──────────────► speech bubble (3D & 2D)
        └──────────────► animation / reaction      04-animation-reactions.md
```

**No backend changes are needed.** Everything is computed in the frontend from data the `GameRecord` already has, using `chess.js` for attacks and legality. It costs zero tokens at runtime and gives deterministic output: the same position always shows the same line.

## Fit with the current frontend

The frontend in `frontend/` is a **2D pixel-art canvas** (`src/pixel/`), not a 3D scene. For now:
- In [04-animation-reactions.md](04-animation-reactions.md), the **2D column applies**. The 3D descriptions set the mood and target for later polish.
- The existing sprites already match most of the cast: ashigaru, ninja, sōhei monk, samurai general, shōgun. The **rook** is a castle keep (tenshu); the `rider` role in [02-cast.md](02-cast.md) is a proposal to replace it.
- Music and sound: [05-music-sound.md](05-music-sound.md) and `frontend/src/audio/`.

## Ownership

- The line database is plain data. Anyone can add lines; follow the voice rules in [02-cast.md](02-cast.md) and the writing rules in [03-dialogue-system.md](03-dialogue-system.md#writing-lines).
- **Implemented:** the dialogue engine (`frontend/src/story/dialogue.ts`), speech bubbles on the replay board (`Board.tsx`, with an Off / Key / All toggle), and music and sound following the replay (`Replay.tsx`, with a ♪ toggle).
- **Implemented:** the intro scroll (`components/IntroScroll.tsx`, with panels painted in `pixel/intro.ts` and text in `story/intro.ts`), the per-game title card, and the end screens with the lords' closing lines (`Replay.tsx`, `buildEnding` in `story/dialogue.ts`).
- **Not yet implemented:** the piece reactions in [04](04-animation-reactions.md).
