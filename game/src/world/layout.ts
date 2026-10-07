// Kumoi village, Iga Province: the hand-placed layout. Pure data, no DOM, so scripts/check.ts can
// validate it in node (every door and schedule spot reachable, nothing built on a road or in a river).
//
//   north: shrine on raked gravel, torii, cedar woods        north-east: woods
//   west: bamboo grove, koi pond, a townhouse                 centre: teahouse · brewery · storehouse · guard post
//   main road west→east (Sakai ← · → bridge → Okazaki)        the river runs north→south on the east side
//   south: well square, farm lane, minka, coop, ox pen, fisherman's hut, Kiyo's fields, Gonbei's paddies

import { hash, rng } from '../engine/rng'

export const TILE = 16
export const MAP_W = 72
export const MAP_H = 50

export const T = {
  Grass: 0,
  Road: 1,
  Plaza: 2,
  Gravel: 3,
  Water: 4,
  Paddy: 5,
  Field: 6,
  Bridge: 7,
  Forest: 8,
  Pier: 9,
} as const
export type Tile = (typeof T)[keyof typeof T]

export const CROP = { none: 0, daikon: 1, cabbage: 2, eggplant: 3, cucumber: 4 } as const

export type Dir = 'down' | 'up' | 'left' | 'right'
export interface Pt {
  x: number
  y: number
}
export interface Place extends Pt {
  face?: Dir
}
export interface Area {
  x: number
  y: number
  w: number
  h: number
  /** Only these tile types count as inside the area. */
  only?: Tile[]
}

export type BuildingKind =
  | 'minka'
  | 'minkaOld'
  | 'cottage'
  | 'machiya'
  | 'teahouse'
  | 'brewery'
  | 'kura'
  | 'shrine'
  | 'hut'
  | 'guardpost'
  | 'fishhut'
  | 'coop'

export interface Building {
  id: string
  kind: BuildingKind
  name: string
  x: number
  y: number
  w: number
  h: number
  door: Pt
  /** Text when the turtle inspects the door. */
  text: string | string[]
  /** For houses nobody simulated lives in: [from, to) minutes when the windows glow. */
  litHours?: [number, number][]
}

export type TreeKind = 'pine' | 'cedar' | 'broad' | 'maple' | 'willow' | 'persimmon' | 'sacred'

export type PropKind =
  | 'tree'
  | 'bamboo'
  | 'bush'
  | 'hydrangea'
  | 'iris'
  | 'reeds'
  | 'rock'
  | 'lantern'
  | 'well'
  | 'board'
  | 'jizo'
  | 'sign'
  | 'bench'
  | 'nobori'
  | 'casks'
  | 'hay'
  | 'firewood'
  | 'scarecrow'
  | 'fence'
  | 'laundry'
  | 'brazier'
  | 'boat'
  | 'nets'
  | 'trough'
  | 'torii'

export interface Prop {
  kind: PropKind
  x: number
  y: number
  /** Width in tiles (collision footprint), default 1. */
  w?: number
  variant?: string
  /** Blocks the turtle. */
  solid: boolean
  /** Blocks villagers and animals (default: same as solid). Benches block only the turtle. */
  npcSolid?: boolean
  name?: string
  text?: string | string[]
}

export interface World {
  w: number
  h: number
  tiles: Uint8Array
  crops: Uint8Array
  /** Rice seedlings in a paddy tile: 1 planted, 0 bare water. Changes during play. */
  planted: Uint8Array
  buildings: Building[]
  props: Prop[]
  places: Record<string, Place>
  areas: Record<string, Area>
  riverX: (y: number) => number
  bridge: { x0: number; x1: number; y0: number; y1: number }
}

export const idx = (x: number, y: number) => y * MAP_W + x

/** River centre column per row: it wanders a little but stays put under the bridge. */
function riverCentre(y: number): number {
  return 60 + Math.round(1.4 * Math.sin(y * 0.35) + 0.7 * Math.sin(y * 0.9 + 1.3))
}

export function buildWorld(): World {
  const W = MAP_W
  const H = MAP_H
  const tiles = new Uint8Array(W * H)
  const crops = new Uint8Array(W * H)
  const planted = new Uint8Array(W * H)
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  const get = (x: number, y: number): number => (inside(x, y) ? tiles[idx(x, y)] : T.Forest)
  const set = (x: number, y: number, t: Tile) => {
    if (inside(x, y)) tiles[idx(x, y)] = t
  }
  const fill = (x: number, y: number, w: number, h: number, t: Tile) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, t)
  }

  // --- terrain -------------------------------------------------------------------------------
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x <= 1 || x >= W - 2 || y <= 1 || y >= H - 2) set(x, y, T.Forest)

  // River, north to south.
  for (let y = 0; y < H; y++) {
    const c = riverCentre(y)
    for (let dx = -1; dx <= 1; dx++) set(c + dx, y, T.Water)
  }

  // Koi pond in the north-west.
  for (let y = 6; y <= 18; y++)
    for (let x = 2; x <= 16; x++) {
      const dx = (x + 0.5 - 9.5) / 5.4
      const dy = (y + 0.5 - 12.5) / 3.7
      if (dx * dx + dy * dy <= 1) set(x, y, T.Water)
    }

  // Main road (Sakai in the west, Okazaki in the east) and its bridge.
  for (let x = 0; x < W; x++) for (const y of [25, 26]) if (get(x, y) !== T.Water) set(x, y, T.Road)
  const bx0 = Math.min(riverCentre(25), riverCentre(26)) - 1
  const bx1 = Math.max(riverCentre(25), riverCentre(26)) + 1
  fill(bx0, 25, bx1 - bx0 + 1, 2, T.Bridge)
  const bridge = { x0: bx0, x1: bx1, y0: 25, y1: 26 }

  // Village street in front of the teahouse, brewery, storehouse and guard post, with gaps in the
  // grass verge down to the main road.
  fill(16, 21, 41, 3, T.Plaza)
  for (const [x, w] of [
    [19, 3],
    [30, 4],
    [38, 3],
    [45, 3],
    [52, 3],
  ])
    fill(x, 24, w, 1, T.Plaza)

  // Shrine grounds (raked gravel) and the approach road from the street.
  fill(25, 2, 17, 9, T.Gravel)
  fill(31, 11, 2, 10, T.Road)

  // Well square south of the main road, and lanes down to the farms.
  fill(26, 27, 12, 5, T.Plaza)
  fill(31, 32, 2, 6, T.Road)
  const laneEnd = riverCentre(38) - 2
  fill(3, 38, laneEnd - 3 + 1, 1, T.Road)
  fill(3, 27, 1, 11, T.Road)
  fill(5, 24, 1, 1, T.Road) // townhouse door
  fill(21, 32, 1, 6, T.Road) // cottage path
  // Sanpei's pier.
  const pc = riverCentre(38)
  set(pc - 1, 38, T.Pier)
  set(pc, 38, T.Pier)

  // Kiyo's vegetable fields (two blocks, a grass path down the middle and across).
  fill(4, 40, 8, 3, T.Field)
  fill(4, 44, 8, 3, T.Field)
  fill(13, 40, 9, 3, T.Field)
  fill(13, 44, 9, 3, T.Field)
  for (let y = 40; y <= 46; y++)
    for (let x = 4; x <= 21; x++) {
      if (get(x, y) !== T.Field) continue
      crops[idx(x, y)] = x < 12 ? (y < 43 ? CROP.daikon : CROP.cabbage) : y < 43 ? CROP.eggplant : CROP.cucumber
    }

  // Gonbei's rice paddies: 8 flooded cells separated by grass levees (aze).
  for (const cx of [33, 39, 45, 51]) for (const cy of [40, 44]) fill(cx, cy, cx === 51 ? 6 : 5, 3, T.Paddy)
  for (let y = 40; y <= 46; y++)
    for (let x = 33; x <= 56; x++) if (get(x, y) === T.Paddy && x <= 43 && (y <= 42 || x <= 37)) planted[idx(x, y)] = 1

  // --- buildings --------------------------------------------------------------------------------
  const buildings: Building[] = [
    { id: 'shrine', kind: 'shrine', name: 'Kumoi Shrine', x: 28, y: 3, w: 8, h: 5, door: { x: 31, y: 8 }, text: ['An offering box. You have no coins.', 'You offer a respectful nod instead. The kami nod back. Probably.'] },
    { id: 'hut', kind: 'hut', name: "Kakuzen's hut", x: 37, y: 4, w: 4, h: 4, door: { x: 38, y: 8 }, text: 'A sign: "Meditation in progress. Do not disturb." Snoring from inside.' },
    { id: 'teahouse', kind: 'teahouse', name: "Oume's Teahouse", x: 17, y: 15, w: 7, h: 6, door: { x: 20, y: 21 }, text: ['The curtain reads: TEA · DANGO · GOSSIP.', 'The gossip is free. The dango is not.'] },
    { id: 'brewery', kind: 'brewery', name: 'Kurozaemon Brewery', x: 35, y: 14, w: 9, h: 7, door: { x: 39, y: 21 }, text: ['A sign on the door: NO TURTLES.', 'It has a little drawing of a turtle with a line through it. Very specific.'] },
    { id: 'kura', kind: 'kura', name: 'Storehouse', x: 45, y: 16, w: 4, h: 5, door: { x: 46, y: 21 }, text: 'Locked. It smells of sake. Your errand is in there. So close.' },
    { id: 'guard', kind: 'guardpost', name: 'Guard post', x: 52, y: 18, w: 4, h: 3, door: { x: 53, y: 21 }, text: 'A guard post. Inside: one spear, one helmet, and a lot of dango skewers.' },
    { id: 'houseA', kind: 'machiya', name: 'Townhouse', x: 3, y: 19, w: 6, h: 5, door: { x: 5, y: 24 }, text: 'Somebody inside is practising the shakuhachi. Badly.', litHours: [[300, 390], [1080, 1320]] },
    { id: 'houseB', kind: 'cottage', name: 'Cottage', x: 19, y: 28, w: 6, h: 4, door: { x: 21, y: 32 }, text: 'A cottage. A note on the door: "Gone to Kyoto. Back never. Love, the Yamadas."', litHours: [[1110, 1290]] },
    { id: 'kiyo', kind: 'minkaOld', name: "Kiyo's farmhouse", x: 6, y: 32, w: 6, h: 5, door: { x: 8, y: 37 }, text: 'A sign: "Turtles will be made into soup." Underneath, smaller: "Eventually."' },
    { id: 'gonbei', kind: 'minka', name: "Gonbei's farmhouse", x: 37, y: 32, w: 7, h: 5, door: { x: 40, y: 37 }, text: 'Muddy sandals in four sizes. A chewed one in a fifth size: Pochi.' },
    { id: 'coop', kind: 'coop', name: 'Chicken coop', x: 46, y: 31, w: 3, h: 3, door: { x: 47, y: 34 }, text: 'The chicken coop. It smells of ambition.' },
    { id: 'fishhut', kind: 'fishhut', name: "Sanpei's hut", x: 53, y: 33, w: 4, h: 4, door: { x: 54, y: 37 }, text: 'A board nailed by the door: "BIGGEST CARP: 3 shaku." Someone has crossed it out and written "1".' },
  ]

  // --- props ------------------------------------------------------------------------------------
  const props: Prop[] = []
  const add = (p: Prop) => props.push(p)
  const tree = (x: number, y: number, variant: TreeKind) => add({ kind: 'tree', x, y, variant, solid: true })

  add({ kind: 'torii', x: 30, y: 11, w: 4, solid: true, name: 'Torii', text: 'The torii gate. Past it is the kami’s ground. Wipe your feet. All four.' })
  add({ kind: 'tree', x: 26, y: 7, variant: 'sacred', solid: true, name: 'Sacred camphor', text: ['A camphor tree older than the village, wrapped in a straw rope.', 'The rope means a kami lives here. You bow. A leaf falls on your head. Accepted.'] })
  for (const [x, y] of [
    [29, 9],
    [34, 9],
    [30, 14],
    [33, 14],
    [30, 18],
    [33, 18],
    [26, 27],
    [37, 31],
    [24, 21],
  ])
    add({ kind: 'lantern', x, y, solid: true, name: 'Stone lantern', text: 'A stone lantern. At night a candle burns in it. By day a spider lives in it.' })

  add({ kind: 'well', x: 28, y: 28, solid: true, name: 'Well', text: 'You look down the well. A turtle looks back up. Handsome fellow.' })
  add({
    kind: 'board',
    x: 35,
    y: 27,
    w: 2,
    solid: true,
    name: 'Notice board',
    text: [
      'NOTICE: Lord Oda Nobunaga honours Kyoto with a visit. He stays at Honnō-ji temple with a modest escort.',
      'All is calm in the realm. Nothing could possibly go wrong.',
      'LOST: one sandal, left foot. Answers to "Sanpei’s sandal". Reward: a fish (small).',
      'Market day every third day. Jinbei the peddler brings combs, fans and rumours.',
    ],
  })
  add({ kind: 'jizo', x: 11, y: 23, solid: true, name: 'Jizō', text: ['A stone Jizō in a red bib, guardian of travellers.', 'Someone left him a rice ball. You consider it. You leave it. Good turtle.'] })
  add({ kind: 'sign', x: 2, y: 24, solid: true, name: 'Signpost', text: ['← SAKAI. Roshi’s island is that way.', 'Roshi’s sake is this way.'] })
  add({ kind: 'sign', x: 68, y: 24, solid: true, name: 'Signpost', text: ['OKAZAKI → Three provinces. Mountains, bandits, ninja.', 'Not recommended for turtles.'] })

  add({ kind: 'bench', x: 17, y: 22, w: 2, variant: 'parasol', solid: true, npcSolid: false, name: 'Bench', text: 'A teahouse bench under a red parasol. The red felt is warm from the sun.' })
  add({ kind: 'bench', x: 22, y: 22, w: 2, solid: true, npcSolid: false, name: 'Bench', text: 'A teahouse bench. Someone left a dango skewer. Heisuke, probably.' })
  add({ kind: 'nobori', x: 16, y: 21, solid: true, name: 'Banner', text: 'A banner: 茶 (tea). Flapping in the breeze like it’s proud of it.' })
  add({ kind: 'casks', x: 43, y: 21, w: 2, solid: true, name: 'Sake casks', text: ['Straw-wrapped sake casks, stacked high.', 'You knock on one. It sloshes. Your errand sloshes.', 'Kurozaemon is watching you. You were just admiring the straw.'] })
  add({ kind: 'casks', x: 49, y: 20, w: 1, variant: 'one', solid: true, name: 'Sake cask', text: 'An empty cask. It still smells wonderful.' })

  add({ kind: 'brazier', x: bx0 - 1, y: 24, solid: true, name: 'Brazier', text: 'An iron fire basket for the night watch. Warm. Very warm. Turtle-roasting warm.' })

  add({ kind: 'hay', x: 24, y: 34, solid: true, name: 'Haystack', text: 'A haystack. Perfect for a nap. You’re a turtle; everything is perfect for a nap.' })
  add({ kind: 'hay', x: 28, y: 35, solid: true, name: 'Haystack', text: 'A haystack. A child-shaped dent in one side. Taro’s "ninja hideout".' })
  add({ kind: 'firewood', x: 12, y: 37, solid: true, name: 'Firewood', text: 'Firewood, stacked with terrifying precision. Kiyo did this.' })
  add({ kind: 'laundry', x: 34, y: 33, w: 2, solid: true, name: 'Laundry', text: 'Gonbei’s spare loincloth, flapping proudly. You look away respectfully.' })
  add({ kind: 'scarecrow', x: 44, y: 43, solid: true, name: 'Scarecrow', text: ['Gonbei’s scarecrow. The crows use it as a perch.', 'It’s had a hard life.'] })
  add({ kind: 'trough', x: 14, y: 32, solid: true, name: 'Trough', text: 'Benkei’s trough. Licked clean. Then licked again, just in case.' })
  add({ kind: 'nets', x: 57, y: 35, solid: true, name: 'Fishing nets', text: 'Fishing nets drying on poles. One has a sandal in it. Left foot.' })
  add({ kind: 'boat', x: riverCentre(41), y: 41, solid: true, name: 'Boat', text: 'Sanpei’s boat. Painted on the side: "BIG CARP". Ambitious.' })

  // Fences: chicken yard (gate at the bottom) and the ox pen (gate at the bottom).
  const fenceRect = (x0: number, y0: number, x1: number, y1: number, gates: Pt[]) => {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue
        if (gates.some((g) => g.x === x && g.y === y)) continue
        add({ kind: 'fence', x, y, solid: true, name: 'Fence' })
      }
  }
  fenceRect(45, 30, 51, 37, [{ x: 48, y: 37 }])
  fenceRect(13, 31, 18, 36, [{ x: 16, y: 36 }])

  // Hand-placed trees.
  tree(27, 13, 'pine')
  tree(14, 21, 'pine')
  tree(10, 19, 'maple')
  tree(13, 18, 'willow')
  tree(26, 33, 'persimmon')
  tree(50, 22 + 0, 'maple')
  tree(24, 38 + 2, 'persimmon')
  tree(29, 41, 'broad')
  tree(35, 37, 'maple')
  for (const y of [8, 15, 30, 44]) tree(riverCentre(y) - 2, y, 'willow')
  for (const [x, y] of [
    [16, 15],
    [15, 13],
    [24, 13],
    [3, 16],
  ])
    tree(x, y, 'maple')

  // Flowers and bushes that frame the buildings.
  for (const [x, y] of [
    [24, 16],
    [25, 17],
    [28, 16],
    [16, 19],
    [34, 11],
    [27, 10],
    [36, 10],
    [9, 24],
    [44, 31],
    [36, 31],
  ])
    add({ kind: 'hydrangea', x, y, solid: true, name: 'Hydrangea', text: 'Hydrangeas. Blue this year. Kiyo says that means the soil is sour. Like Kiyo.' })

  // Irises around the pond's south and east shore, reeds along the river.
  for (let y = 6; y <= 18; y++)
    for (let x = 2; x <= 17; x++) {
      if (get(x, y) !== T.Grass) continue
      const nearWater = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => get(x + dx, y + dy) === T.Water)
      if (nearWater && hash(x, y, 5) < 0.45) add({ kind: 'iris', x, y, solid: false })
    }

  // --- named places (tile coordinates villagers walk to) ---------------------------------------
  const places: Record<string, Place> = {
    shrineFront: { x: 32, y: 9, face: 'up' },
    meditate: { x: 12, y: 17, face: 'up' },
    pondBank: { x: 8, y: 17, face: 'up' },
    teaCounter: { x: 21, y: 22, face: 'down' },
    teaBench1: { x: 17, y: 22, face: 'down' },
    teaBench2: { x: 18, y: 22, face: 'down' },
    teaBench3: { x: 22, y: 22, face: 'down' },
    teaBench4: { x: 23, y: 22, face: 'down' },
    well: { x: 28, y: 29, face: 'up' },
    alms: { x: 30, y: 28, face: 'down' },
    fishStand: { x: 27, y: 30, face: 'down' },
    stall: { x: 32, y: 29, face: 'down' },
    laundry: { x: 34, y: 34, face: 'up' },
    gonbeiStep: { x: 41, y: 37, face: 'down' },
    callKids: { x: 40, y: 38, face: 'left' },
    oxGate: { x: 16, y: 37, face: 'up' },
    bridgeWest: { x: bx0 - 1, y: 25, face: 'right' },
    pierEnd: { x: pc, y: 38, face: 'right' },
    riverbank: { x: riverCentre(19) - 2, y: 19, face: 'right' },
    westEdge: { x: 0, y: 25, face: 'left' },
    patrolA: { x: 49, y: 23 },
    patrolB: { x: 36, y: 29 },
    patrolC: { x: 8, y: 26 },
    patrolD: { x: 27, y: 22 },
    // Mike the cat's favourite spots.
    catTea: { x: 24, y: 22 },
    catWell: { x: 29, y: 29 },
    catBrew: { x: 35, y: 22 },
    catShrine: { x: 33, y: 10 },
    // Pochi waits at the door when the children are inside.
    dogBed: { x: 41, y: 37 },
  }
  for (const b of buildings) places[`door:${b.id}`] = { x: b.door.x, y: b.door.y, face: 'down' }

  const areas: Record<string, Area> = {
    paddies: { x: 33, y: 40, w: 24, h: 7, only: [T.Paddy] },
    fields: { x: 4, y: 40, w: 18, h: 7, only: [T.Field] },
    chickenYard: { x: 46, y: 31, w: 5, h: 6 },
    oxPen: { x: 14, y: 32, w: 4, h: 4 },
    meadow: { x: 22, y: 33, w: 9, h: 4, only: [T.Grass] },
    square: { x: 26, y: 27, w: 12, h: 5, only: [T.Plaza] },
    teaFront: { x: 16, y: 21, w: 9, h: 3, only: [T.Plaza] },
    brewYard: { x: 36, y: 21, w: 9, h: 3, only: [T.Plaza] },
    shrineGrounds: { x: 25, y: 8, w: 17, h: 3, only: [T.Gravel] },
    pond: { x: 2, y: 6, w: 15, h: 13, only: [T.Water] },
    pondShore: { x: 3, y: 16, w: 12, h: 3, only: [T.Grass] },
  }

  // --- scattered nature -------------------------------------------------------------------------
  const blocked = new Uint8Array(W * H) // where random scatter may not go
  const block = (x: number, y: number, w = 1, h = 1) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (inside(i, j)) blocked[idx(i, j)] = 1
  }
  for (const b of buildings) {
    block(b.x - 1, b.y - 1, b.w + 2, b.h + 2)
    block(b.door.x - 1, b.door.y, 3, 2)
  }
  for (const p of props) block(p.x - 1, p.y - 1, (p.w ?? 1) + 2, 3)
  for (const p of Object.values(places)) block(p.x - 1, p.y - 1, 3, 3)
  for (const a of Object.values(areas)) block(a.x - 1, a.y - 1, a.w + 2, a.h + 2)
  block(13, 31, 6, 7)
  block(45, 30, 7, 8)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = get(x, y)
      if (t !== T.Grass && t !== T.Forest) block(x, y)
      // Keep a one-tile verge along roads and the river so paths stay readable.
      if (t === T.Road || t === T.Plaza || t === T.Water || t === T.Bridge || t === T.Gravel) block(x - 1, y - 1, 3, 3)
    }

  const r = rng(1582)
  const zone = (x0: number, y0: number, x1: number, y1: number, density: number, kinds: TreeKind[]) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (blocked[idx(x, y)] || get(x, y) !== T.Grass) continue
        if (r() < density) {
          tree(x, y, kinds[Math.floor(r() * kinds.length)])
          block(x, y)
        }
      }
  }
  // Cedars around the shrine, woods in the north-east and across the river.
  zone(21, 2, 24, 12, 0.55, ['cedar'])
  zone(42, 2, 44, 12, 0.55, ['cedar'])
  zone(45, 2, 57, 13, 0.35, ['cedar', 'broad', 'broad', 'pine'])
  zone(riverCentre(10) + 2, 2, 69, 47, 0.42, ['cedar', 'broad', 'broad', 'maple'])

  // Bamboo grove north of the pond.
  for (let y = 2; y <= 6; y++)
    for (let x = 2; x <= 20; x++) {
      if (get(x, y) !== T.Grass || blocked[idx(x, y)]) continue
      if (r() < 0.6) {
        add({ kind: 'bamboo', x, y, solid: true })
        block(x, y)
      }
    }

  // Border forest: trees on the forest band (decoration only; the band itself blocks movement).
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (get(x, y) !== T.Forest) continue
      const nearRoad = [-1, 0, 1].some((d) => get(x, y + d) === T.Road || get(x + d, y) === T.Road)
      if (nearRoad) continue
      if (hash(x, y, 11) < 0.62) {
        const v: TreeKind = y < 3 ? 'cedar' : hash(x, y, 12) < 0.5 ? 'broad' : x > 60 ? 'cedar' : 'pine'
        add({ kind: 'tree', x, y, variant: v, solid: false })
      }
    }

  // Bushes, rocks and the odd small tree on leftover grass.
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      if (blocked[idx(x, y)] || get(x, y) !== T.Grass) continue
      const v = r()
      if (v < 0.035) {
        add({ kind: 'bush', x, y, solid: true, name: 'Bush', text: 'A bush. It rustles. Probably a ninja. Probably a sparrow.' })
        block(x - 1, y - 1, 3, 3)
      } else if (v < 0.05) {
        add({ kind: 'rock', x, y, solid: true, name: 'Rock', text: 'A mossy rock. You feel a certain kinship.' })
        block(x - 1, y - 1, 3, 3)
      } else if (v < 0.06) {
        tree(x, y, r() < 0.5 ? 'maple' : 'broad')
        block(x - 1, y - 1, 3, 3)
      }
    }
  // Reeds along the river banks.
  for (let y = 2; y < H - 2; y++) {
    const c = riverCentre(y)
    for (const x of [c - 2, c + 2])
      if (get(x, y) === T.Grass && !props.some((p) => p.x === x && p.y === y) && hash(x, y, 21) < 0.35)
        add({ kind: 'reeds', x, y, solid: false })
  }

  return { w: W, h: H, tiles, crops, planted, buildings, props, places, areas, riverX: riverCentre, bridge }
}

/** Tile columns a prop occupies for collision. A torii only blocks at its two pillars. */
export function propColumns(p: Prop): number[] {
  const w = p.w ?? 1
  if (p.kind === 'torii') return [p.x, p.x + w - 1]
  return Array.from({ length: w }, (_, i) => p.x + i)
}
