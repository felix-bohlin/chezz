# 01 — Intro story

**Status: implemented.** See `frontend/src/components/IntroScroll.tsx`, `frontend/src/pixel/intro.ts` (the panel paintings, which reuse the army sprites) and `frontend/src/story/intro.ts` (the text). The title card and end screens are in `Replay.tsx`. Panel art is pixel art drawn in code, not sumi-e paintings, to match the frontend's style.

The intro answers one question for the viewer: **why is this match being played?**
Answer: to get Lord Ieyasu home alive, the same goal as protecting the king in chess.

## Format

- An **emakimono** (Japanese picture scroll) unrolls horizontally. Each panel is a sumi-e ink painting with a little red accent (fire, banners, the torii).
- About 30 seconds total, 4–5 seconds per panel. Narration appears as brush-stroke text; optional voice-over later.
- **Skippable** at any time (Esc / click "Skip"). Played automatically only on the first visit (remember this in `localStorage`), and replayable from the menu.
- Ambient sound: wind, distant taiko drums, a single shakuhachi phrase on the last panel.

## Scroll script

| # | Panel (art direction) | Narration |
|---|---|---|
| 1 | **Sakai, dawn.** A quiet port town, merchant ships, Ieyasu drinking tea with a small retinue. | *Summer, 1582. Lord Tokugawa Ieyasu is a guest in Sakai, with only a handful of men.* |
| 2 | **Honnō-ji burning.** Kyoto temple in flames, night sky red. A single figure in the smoke. | *In Kyoto, the temple Honnō-ji burns. Oda Nobunaga, master of the realm, is dead.* |
| 3 | **The betrayal.** Akechi Mitsuhide on horseback, banners with the bellflower crest, army streaming out of Kyoto. | *His own general, Akechi Mitsuhide, has betrayed him. Now Akechi hunts every one of Nobunaga's allies.* |
| 4 | **Cornered.** Ieyasu and 34 men on a road, mountains ahead, torches of the samurai hunters in the valleys. | *Ieyasu is cut off from home. Between him and his castle lie the mountains of Iga, full of bandits, hunters, and Akechi's scouts.* |
| 5 | **Hanzō's oath.** A lone figure kneels before Ieyasu. Behind him, in the trees, dozens of shadows: the Iga ninja. | *One man steps forward. Hattori Hanzō, whom they call the Demon. "I know the Iga roads, my lord. I will bring you home."* |
| 6 | **The board.** The scroll's last panel *becomes* the chessboard: the mountain path turns into a zen-garden grid, and the pieces take their places. | ***Every game is that night, replayed.*** |

The transition in panel 6 is the key shot: the camera pushes into the painting and lands in the 3D scene with the pieces already standing.

## Per-game title card

Shown for about 3 seconds before each game replay. It is built from the `GameRecord`, so it needs no extra data.

```
            THE NIGHT OF IGA
          ── Game 0007 ──
  Tokugawa (Musashi, White)  vs  Akechi's pursuers (Stockfish)
        Strength of the pursuers: 1600
```

- `ourColor` decides which color the Tokugawa play.
- `stockfishElo` is shown as "strength of the pursuers". This is flavor text only; there is no campaign or journey.
- The first dialogue of the game comes right after: `game_start` lines from both lords (see [03](03-dialogue-system.md)).

## End screens

Shown after the final move's bubbles. They reuse the lords' `victory` / `defeat` / `draw` lines from `lines.json`.

| Result | Image | Title | Line (examples) |
|---|---|---|---|
| **We win** | Ieyasu at the gates of Okazaki castle, sunrise | *Ieyasu reaches home.* | "Okazaki's gates. We are home." |
| **We lose** | The *shikami-zō*: an ink portrait of Ieyasu's grimacing, defeated face | *The night was lost.* | "Paint me as I am. I will learn." |
| **Draw** | Fog over the Iga mountains, no figures | *The mountains keep their secret.* | "Neither hunter nor hunted. For now." |

The loss screen is based on a real story: after his defeat at Mikatagahara (1573), Ieyasu reportedly had his defeated face painted and kept the portrait as a reminder never to repeat his mistakes. A loss in Chezz: Total War isn't hidden. It becomes a portrait of the lesson, which suits an engine that improves from its analyzed losses.

## History vs legend (small info box on the intro screen)

> **What really happened?** In June 1582, after Nobunaga's death at Honnō-ji, Tokugawa Ieyasu really did escape from the Sakai area through the Iga and Kōka mountains back to his home province of Mikawa. This journey is known as the *Shinkun Iga-goe*. Tokugawa-era accounts credit Hattori Hanzō Masanari with rallying local Iga and Kōka men to guide and guard him. How much of this was Hanzō's doing, and how "ninja" he really was, is partly legend. Hanzō was a samurai commander of Iga descent, and the "Demon Hanzō" of popular stories grew over the centuries. Akechi Mitsuhide ruled for only about two weeks before he was defeated at Yamazaki, which gave rise to the Japanese phrase *mikka tenka* ("a three-day reign").
>
> The pieces' personalities, and Akechi's generals and monks on the board, are dramatized for the game.

## Tone rules

- Serious and atmospheric in the intro and end screens. The humor lives in the pieces' dialogue (ashigaru, ninja), not in the narration.
- Keep narration to 2 lines or fewer per panel.
- No modern slang anywhere in the narration.
