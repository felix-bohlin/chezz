# Shell of Iga — town prototype

A 2D open-world prototype set in the Chezz: Total War world. You are Kame, Master Roshi's errand turtle,
sent from his island to the walled port town of Kumoi (Ise Province, early summer 1582) to fetch "the
good sake". There is no quest logic yet: it's a town to walk around in and get a feel for.

The tone is Witcher 3 more than Stardew: a muddy, rain-soaked town a year after Nobunaga burned Iga,
refugees camped outside the walls, a burnt-out house nobody talks about, contracts for kappa and nue on
the notice board, and Roshi still mostly worried about sake prices.

```bash
cd game
pnpm install
pnpm dev        # http://localhost:5174
pnpm check      # typecheck + layout check (every door, spot and schedule target reachable)
pnpm build
```

**Controls:** WASD/arrows walk · Shift hurry · Space hide in shell · E talk/look · M map with who's where ·
`[` `]` time speed · P pause · R weather (as it comes / rain / storm / mist / clear) · N sound · G debug view ·
H help. On touch screens: drag to walk, tap to talk, double-tap to hide.

## What's in it

- **Kumoi** (144×112 tiles): a walled town ringed by a moat with four gates, a castle with its own inner
  wall, a town square with market stalls and two notice boards, merchant and craftsmen's streets, inns, a
  brewery, a bathhouse, a smithy, a harbour with piers, a fish market, a shipwright, a merchant ship and a
  lighthouse, and Kōun-ji temple up 108 steps on the hill (gate, main hall, pagoda, bell tower, graveyard).
  Outside the walls: rice paddies and farms, the Iga refugee camp, beaches, woods and an old shrine.
  You start on Roshi's island and swim over.
- **45 people with daily routines** (`src/sim/folk-*.ts`), plus 33 generated passers-by (`src/sim/extras.ts`):
  farmers, guards, merchants, monks, dockworkers, a fishwife you can hear across town, a peddler on market
  days, a fire watchman on night rounds, and four refugees from Iga (an elder, a widow scrubbing barrels for
  burnt rice, an orphan begging in the square, and a deserter who keeps watch at night and doesn't say why).
- **Animals:** chickens, ducks on the moat, cats with favourite spots, Pochi the dog, Benkei the ox, temple
  deer that bow, seagulls, frogs at night, crows that pull up seedlings or watch from the rooftops, and harbour
  rats that come out at dusk and in the rain.
- **Weather and light:** a seeded plan per day (dawn sea mist, rain spells, the odd thunderstorm with
  lightning and taiko thunder), rain streaks, splashes and rings on water and puddles, paper umbrellas,
  drifting fog, dark nights where lanterns, windows and campfires matter, and a desaturated colour grade
  with a vignette.
- **The turtle** swims (faster than it walks) and can hide in its shell. Most people then see a rock; some
  see a kappa.

## How it's built

TypeScript + Canvas 2D + Vite, no runtime dependencies. All art is drawn by code into small canvases at
startup, then weathered (grime, rain streaks, mud splashes) and muted. Roshi's sprite and the koto music
engine are copied from `frontend/`.

| Path | What |
|---|---|
| `src/engine/` | Screen (low-res world canvas scaled by an integer and colour-graded; full-res UI canvas), input, A*, RNG, pixel helpers |
| `src/world/` | `town.ts` the hand-placed town plan, `layout.ts` the data model and builder (pure data), `grid.ts` collision and path costs |
| `src/sim/` | villagers' schedules and lines (`folk-*.ts`), generated passers-by, game clock |
| `src/entities/` | villager timetable runner, animal brains, the turtle |
| `src/art/` | ground, buildings (`kit.ts` parts, `townhouses.ts`, `landmarks.ts`, `camp.ts`), props, nature, people (paper dolls), animals |
| `src/weather.ts` | daily weather plan, rain, fog, lightning, colour grade |
| `src/lighting.ts` | ambient light by hour and the stepped light map |
| `src/game.ts` | update loop, y-sorted rendering, water, lighting, interaction |
| `src/ui/` | speech bubbles, HUD, district banner, dialogue box, title card, map, help |
| `src/audio/` | koto music, temple bell, rain and thunder |

The simulation (`world/`, `sim/`) has no DOM dependency, so `scripts/check.ts` validates the town in Node.
In the browser console, `game` is the live game object (e.g. `game.clock.minutes = 20 * 60`,
`game.weather.mode = 'storm'`).
