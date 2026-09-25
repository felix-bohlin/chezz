# 04 — Animation & reactions

Pieces are characters, so they should **move like who they are**. Two things drive the motion:

1. **Armor class** sets the physical feel of every move: speed, weight and landing.
2. **Role** adds a signature on top: the ninja's somersault, Hanzō's vanish, the rider's gallop.

Reactions come from the **same events as dialogue**. The dialogue engine's `Bubble` (situation, mood, square) is the trigger for animations as well, so the talking and the acting always match. Reactions play even when bubbles are turned off.

The 2D view uses the simplified versions listed in the last column of each table. The 2D fallback is about clarity, so it gets fewer effects.

## 1. Armor classes → motion parameters

| Armor | Roles | Duration (per square) | Motion | Landing | Sound | 2D |
|---|---|---|---|---|---|---|
| `none` | ninja | 90 ms, min 350 ms | Arcing jump, high lift | Silent; small smoke puff | Cloth whoosh | Tile slides fast with a slight arc |
| `light` | monk, ashigaru | 160 ms | Walk or jog with a small bob | Soft | Straw sandals, spear rattle | Normal slide |
| `heavy` | rider, commander* | 220 ms | Heavy stride, no lift | **Dust burst + 2–3 px board tremor** | Armor clank, hooves | Slide with a small bump on landing |
| `heaviest` | lord | 300 ms | Slow, deliberate steps | Dust; nearby friendly pieces bow slightly | Heavy armor, drum tap | Slow slide |

\* Hanzō is heavy but overrides his movement with the vanish (see §2). Hidemitsu uses the normal heavy stride.

Implementation hint: a single `motionProfile(role, side)` returns `{ durationPerSquare, lift, bob, landingFx, tremor, sound }`. Every move animation reads from it, so tuning happens in one place.

## 2. Role move signatures

| Role | 3D move animation | Notes |
|---|---|---|
| **lord** | Slow walk with a banner-bearer following half a step behind | Never hurries, even when escaping check (the tension comes from the red glow, not speed) |
| **commander – Hanzō** | Dissolves into black smoke → reappears at the target in a crouch → stands | The only piece that teleports; it makes the queen feel supernatural |
| **commander – Hidemitsu** | Heavy armored march, sword drawn on captures | Mirrors the Tokugawa riders' weight |
| **ninja** | Crouch → somersault over any piece in the way → silent landing | The knight's L-jump becomes the ninja's leap; the "jumping over pieces" rule is now character |
| **monk** | Glides along the diagonal, robes and prayer beads swaying, staff held level | Almost no bob; it should feel like floating |
| **rider** | Gallop along the file or rank; the horse rears on long moves (≥4 squares) | Dust trail along the path |
| **ashigaru** | Nervous jog, spear bobbing; double-step (2 squares) is a hurried scramble | Glances left and right on arrival |

**Castling:** the rider gallops first and turns to face outward like a guard. The lord then walks behind it. Speech order matches: rider "To your side, my lord!", then the lord's reply.

## 3. Reactions to position state

These are **idle** reactions. They run while a position is displayed and are recomputed from the current FEN, not only on the ply the situation fired, so scrubbing to any position shows the right state.

| State | Detected from | Reaction (3D) | 2D |
|---|---|---|---|
| **Attacked piece** | enemy attacks its square | Turns to face the strongest attacker. Ashigaru tremble; riders and commanders raise their weapons; monks close their eyes; ninja crouch lower | Small red corner mark on the tile |
| **Hanging** (attacked, undefended) | as in 03 §2.3 | Above plus a faint pulsing outline | Pulsing red outline |
| **Pinned** | as in 03 §2.3 | A thin **ink line** (sumi brushstroke) runs from the pinner through the pinned piece to the piece behind it; the pinned piece strains against it | Ink line drawn across tiles |
| **King in check** | `inCheck()` | The lord glows red; a single **war-drum** hit; adjacent friendly pieces turn toward the lord | Red tile glow |
| **King danger** | zone pressure ≥2 (03 §2.3) | Friendly pieces within 2 squares lean or step half a step toward the lord; wind picks up and petals scatter | None |
| **Pawn near promotion** | relative rank 6–7 | Ashigaru stands taller, looks toward the last rank; a faint golden glint | Gold dot on the tile |
| **Defended piece** | own attackers ≥1 | Nothing. Calm is the default | — |

Budget: at most one idle loop per piece, and all idle animations pause while a move animation plays.

## 4. Mood → reaction

When a bubble appears, the speaker plays a short gesture (≤ 800 ms) matching its `mood`:

| Mood | Gesture |
|---|---|
| `calm` | Slight nod |
| `sly` | Head tilt; ninja flip a blade |
| `proud` | Chest out, weapon raised |
| `fear` | Step back, tremble |
| `anger` | Weapon stamp; riders' horses rear |
| `triumph` | Weapon raised high, small burst of petals (Tokugawa) or embers (Akechi) |
| `grief` | Head bowed |

## 5. Capture & death (by armor)

The capturing piece's move signature plays first. The captured piece then dies according to its **own** armor, while its `fallen` bubble (if any) is shown at the capture square.

| Victim | Death animation | 2D |
|---|---|---|
| `none` (ninja) | Vanishes in a puff of smoke; a single shuriken drops and fades | Tile fades to smoke |
| `light` (monk) | Kneels, bows, fades like ink in water | Tile fades |
| `light` (ashigaru) | Drops the spear and runs off the edge of the platform (Tokugawa); hunters drop their torch | Tile slides off the board |
| `heavy` (rider, commander) | Falls backward with a **thud**, dust burst, board tremor, then sinks and fades | Tile shakes, then fades |
| `heaviest` (lord) | Never captured. See checkmate | — |

Captured pieces reappear as small figures in a "fallen" row beside the board. This is the captured-material display, in character.

## 6. Special moves

**Promotion.** The ashigaru reaches the last rank, kneels, and a burst of light and petals wraps it in armor. It then **transforms** into the new role's model (commander, rider, monk or ninja) and plays that role's `proud` gesture. The bubble is the ashigaru's `promotion` line (for example, "Look at me now! Armor! A title!"). In 2D, the tile flips over like a shogi piece promoting.

**En passant.** The capturing ashigaru turns sideways, jabs with the spear, then steps forward. The victim plays the ashigaru death animation.

**Check.** Drum hit, red glow on the lord, and the checking piece raises its weapon. The primary bubble goes to the checker, and the `checked` reply goes to the lord.

**Checkmate.**
1. The checking piece strikes a final pose; the scene holds for 1 second.
2. The mated lord **kneels** and lays down its fan or sword.
3. The ink-wash scene darkens except for the winning side; petals (Tokugawa win) or embers (Akechi win) drift down.
4. Transition to the end screen ([01](01-intro-story.md#end-screens)).

**Draw.** Fog rolls across the board; both lords lower their weapons; transition to the draw end screen.

## 7. Scene ambience by game state

Small global cues that follow the eval and material (optional, polish):

| State | Ambience |
|---|---|
| Opening | Dusk light, calm wind, crickets |
| Middlegame | Night, torches lit around the platform |
| Endgame | Pre-dawn blue light, wind stronger |
| Tokugawa clearly winning (eval > +300 for us) | Fewer torches on the Akechi side; more petals |
| Akechi clearly winning | Torches close in around the platform edge |

## 8. Event contract (shared with dialogue)

The animation system subscribes to the same per-ply output as the bubbles:

```ts
interface PlyEvents {
  ply: number;
  move: { from: string; to: string; piece: Role; side: Side; flags: string; captured?: Role; promotion?: Role };
  bubbles: Bubble[];        // from the dialogue engine (types.ts); may be empty
}
// Order of playback per ply:
// 1. move signature (§2)   2. capture/death of victim (§5)
// 3. primary bubble + mood gesture (§4)   4. reply bubble + gesture
// 5. idle reactions recomputed for the new position (§3)
```

A reaction needs only `(role, side, armor, mood, situation)`. No piece-specific code should live in the dialogue engine, and no dialogue logic should live in the animation code.
