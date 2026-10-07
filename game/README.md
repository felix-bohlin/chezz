# Shell of Iga — village prototype

A 2D open-world prototype set in the Chezz: Total War world. You are Kame, Master Roshi's errand turtle,
sent to Kumoi village (Iga Province, early summer 1582) to fetch "the good sake". For now there is no
quest logic: it's a village to walk around in and get a feel for.

```bash
cd game
pnpm install
pnpm dev        # http://localhost:5174
pnpm check      # typecheck + layout check (every door, spot and schedule target reachable)
pnpm build
```

**Controls:** WASD/arrows walk · Shift hurry · Space hide in shell · E talk/look · M map with who's where ·
`[` `]` time speed · P pause · N music · G debug view · H help. On touch screens: drag to walk, tap to talk, double-tap
to hide.

## What's in it

- **Village:** shrine with torii and raked gravel, teahouse, sake brewery with its cedar ball, storehouse,
  guard post and bridge, two farmhouses, a townhouse, a cottage, a fisherman's hut, a well square, a koi pond,
  a bamboo grove, rice paddies, vegetable fields, a river, and woods.
- **People with daily routines** (`src/sim/cast.ts`): Gonbei and Ohana plant rice, their kids chase chickens
  with Pochi the dog, Kiyo weeds and gossips, Oume runs the teahouse, Kurozaemon hauls casks, Kakuzen
  blows his conch at dawn (and naps at one), Heisuke patrols and keeps night watch, Sanpei fishes and tells
  tall tales, and Jinbei the peddler walks in from Sakai on market days (every third day).
- **Animals:** hens, a rooster and chicks that flee from you, ducks and koi on the pond, Mike the calico
  cat, Benkei the ox, frogs at night, and crows that pull up Gonbei's seedlings (the proverb, simulated).
- **Day and night:** a 12-minute day at 1×, dawn and dusk tints, lanterns, lit windows, chimney smoke,
  the night-watch brazier, fireflies.
- **The turtle** swims (faster than it walks) and can hide in its shell. Most villagers then see a rock.
  Kiyo doesn't.

## How it's built

TypeScript + Canvas 2D + Vite, no runtime dependencies. All art is drawn by code into small canvases at
startup, in the same style as the replay frontend (Roshi's sprite and the koto music engine are copied
from `frontend/`).

| Path | What |
|---|---|
| `src/engine/` | Screen (low-res world canvas scaled by an integer, full-res UI), input, A*, RNG, pixel helpers |
| `src/world/` | `layout.ts` the hand-placed village (pure data), `grid.ts` collision and path costs |
| `src/sim/` | `cast.ts` villagers, schedules and lines; `clock.ts` game time |
| `src/entities/` | villager timetable runner, animal brains, the turtle |
| `src/art/` | ground, buildings, props, nature, people (paper dolls), animals, turtle |
| `src/game.ts` | update loop, y-sorted rendering, night lighting, interaction |
| `src/ui/` | speech bubbles, HUD, dialogue box, title card, map, help |

The simulation (`world/`, `sim/`) has no DOM dependency, so `scripts/check.ts` validates the layout in Node.
In the browser console, `game` is the live game object (e.g. `game.clock.minutes = 20 * 60`).
