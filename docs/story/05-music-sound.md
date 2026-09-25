# 05 — Music & sound

The Night of Iga has its own score. It is **fully synthesized with the Web Audio API**, so there are no audio files to load or license. It reacts to the **same situations as the dialogue** ([03](03-dialogue-system.md)): a check sounds like a check, and a blunder sounds like a mistake.

Code: [`frontend/src/audio/`](../../frontend/src/audio/). Status: written and typechecked, **not yet wired into the replay UI** (see §6).

## 1. Sound palette

Everything is in the **in scale on D** (D, E♭, G, A, B♭, the *miyako-bushi* mode of *Sakura Sakura*). This makes everything sound Japanese without trying hard, and nothing clashes, except where a clash is deliberate.

| Instrument | Built how (`instruments.ts`) | Used for |
|---|---|---|
| **Koto** | Karplus–Strong plucked string, one buffer rendered and cached per pitch | Melody, arpeggios for victory, defeat, promotion and brilliant moves |
| **Taiko** | Pitched sine thump + noise skin | Pulse at higher tension, check, captures, checkmate |
| **Drone** | Sustained low fifth on D2 (saw + triangles) with a slow low-pass swell | The night: always under the music, louder as tension rises |
| **Gong** | Long inharmonic decay | Game start, checkmate, end of game |
| **Wood click** | Short filtered click (hyōshigi clappers) | Every piece landing, captures, castling |

Mixing (`engine.ts`): one `AudioContext` with a **music** bus and an **sfx** bus into a master, plus a shared **reverb send** built from a synthetic hall impulse. Everything sounds like it's in the same mountain valley.

## 2. The score: generative, in three tension levels

The music never loops audibly because every phrase is chosen live. A koto melody random-walks through the scale in small steps and rests at the end of each phrase, over a drone. The taiko comes in as danger rises.

| Tension | Meaning | Tempo | Koto density | Drone | Taiko |
|---|---|---|---|---|---|
| **0** | Calm night march: opening, material even | 66 bpm | sparse | soft | none |
| **1** | Contact with the enemy: middlegame/endgame, or material imbalance | 80 bpm | medium | medium | 2 hits per 2 bars |
| **2** | The lord is in danger: check or `king_danger` | 100 bpm | dense | loud | driving pulse on every beat |

**Tension rules** (`index.ts → gameAudio.onPly`):
- Target level: `2` if a king is in check or in danger; else `1` if not in the opening or material isn't even; else `0`.
- **Tension rises immediately but falls one level per ply**, so the score doesn't jump straight back to calm after one quiet move.

## 3. Cue per situation

Each ply plays a **wood click** (the piece landing), then the cue for the ply's **primary situation**, the same one the dialogue engine chose. Situations without a cue (`quiet`, `retreat`, `development`, the victim-only replies) stay silent; restraint keeps the big moments big.

| Situation | Cue (`sfx.ts`) | Feel |
|---|---|---|
| `game_start` | Low gong, then a rising 4-note koto figure | The scroll opens |
| `check` | Two taiko hits + koto **D against E♭** (a deliberate clash) | Alarm |
| `checkmate` | 5 accelerating taiko hits into a deep gong | The end of the hunt |
| `capture_up` | Click + heavy taiko + low koto | A big kill |
| `capture` | Click + medium taiko | A kill |
| `trade` | Click + light taiko | Even exchange |
| `fork` | Click + two high koto notes together | Two targets |
| `promotion` | Fast rising 5-note koto run | The ashigaru becomes something more |
| `sacrifice` | Click + falling 3-note figure | Something given up |
| `brilliant` | Very fast high rising run | Sparkle |
| `blunder` | Slow falling E♭–D–E♭ figure | "Uh-oh" |
| `castle` | Two quick clicks | The gate closes |
| `en_passant` | Click + one koto note | A sneaky jab |
| `hanging` / `pinned` | Single low E♭ | Unease |
| `king_danger` | Soft low taiko | Distant drums |
| `pawn_near_promotion` | Single high koto note | Hope |
| `victory` | Two taiko hits, a rising 6-note run, a bright gong | Ieyasu reaches home |
| `defeat` | Slow falling koto line, then a very low gong | The defeated-face portrait |
| `draw` | Two soft koto notes and a quiet gong | Fog over the mountains |

## 4. Scene and timeline

| Moment | What plays |
|---|---|
| **Intro scroll** ([01](01-intro-story.md)) | Tension 0 music starts on the first click (browsers block audio until a user gesture); `game_start` cue when the scroll lands on the board |
| **During replay** | `gameAudio.onPly(...)` for each ply as it plays forward |
| **End screen** | `gameAudio.end("victory" \| "defeat" \| "draw")` stops the music and plays the matching cue |

## 5. Settings

- `master`, `music`, `sfx` volumes (0–1) and `muted`. Defaults: 0.8 / 0.5 / 0.8, unmuted.
- Saved per viewer in `localStorage` (`chezz.audio`); if storage is blocked, the defaults are used.
- UI: a small speaker icon in the replay controls (mute toggle) plus sliders in a settings popover.

## 6. Wiring it in (to do)

```ts
import { installUnlock, gameAudio } from "./audio";

installUnlock();                         // once, in main.tsx

// when a replay starts (after a click):
gameAudio.start();

// every time the replay advances ONE ply forward (autoplay or "next"):
gameAudio.onPly({
  situation: bubbles[ply][0]?.situation,  // primary situation from the dialogue engine
  phase, material,                        // same context values as 03 §2.5 (material from OUR side)
  kingInDanger: inCheck || kingDanger,
});

// when the last ply has played:
gameAudio.end(winner === "us" ? "victory" : winner === "stockfish" ? "defeat" : "draw");
```

Rules for the replay UI:
- **Only play cues when moving forward one ply** (autoplay or step). When the viewer drags the slider, jumps to a move, or steps backward, set the tension for the new position with `setTension` and play no cues. Otherwise scrubbing sounds like a war.
- The dialogue engine isn't written yet. Until it is, `situation` can come from a simple check: `+` in SAN → `check`, `x` → `capture`, `#` → `checkmate`, `O-O` → `castle`, `=` → `promotion`. This gives most of the audio immediately.
