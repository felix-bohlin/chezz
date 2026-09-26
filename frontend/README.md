# CHEZZ: TOTAL WAR — pixel-art replay frontend

Vite + React + TypeScript. There is no chess library and no backend API: the app reads `../games/`
(served at `/games` by a small plugin in `vite.config.ts`, copied into `dist/games` on build).

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # static site in dist/ (games included)
node scripts/preview-sprites.ts sheet.png   # render every sprite to a PNG for review
```

## Map

| File | What |
|---|---|
| `src/pixel/sprites.ts` | The army: 20×20 pixel grids + clan palettes (白 ivory/indigo vs 赤 crimson/charcoal) |
| `src/pixel/render.ts` | Grid → canvas → data URL (cached), board tiles, capture slash |
| `src/pixel/scenery.ts` | Procedural backdrop: dusk sky, sun, Fuji, pagoda, torii, cherry trees, lanterns |
| `src/lib/fen.ts` | FEN parsing, piece-identity diffing (so moves animate, even when jumping), check detection |
| `src/components/Board.tsx` | Animated board: slide + hop, katana slash on capture, flashing king in check |
| `src/components/Replay.tsx` | Replay screen (controls, keyboard ←/→/Home/End/Space, move scroll, eval chart, analysis scroll) |
| `src/components/Live.tsx` | Live view of the game currently being played (`games/live.json`, polled every 2 s) |
| `src/components/Dojo.tsx` | Home: hero, campaign map of Elo "provinces", battle records |
| `src/types/game.ts` | The games/ contract (mirror of `CLAUDE.md`) |

Routes: `#/` home · `#/game/0007` replay · `#/game/0007/42` replay at ply 42 · `#/live` live battle.

## Polish ideas (not done yet)

- Sound: taiko hit on capture, shamisen sting on check, gong on mate
- Hand-tuned sprite animation frames (attack pose on capture, idle breathing)
- Promotion effect (ashigaru → samurai general transformation)
- Board themes (winter snow / autumn maple) and a day/night toggle for the scenery
