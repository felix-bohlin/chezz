// Village furniture: stone lanterns, the well, notice board, Jizō, signposts, teahouse benches,
// banner, sake casks, haystacks, firewood, scarecrow, bamboo fences, laundry, the night-watch
// brazier, Sanpei's boat and nets, Benkei's trough and the torii gate.

import { dot, ellipse, px, type Ctx } from '../engine/pixel'
import type { Prop } from '../world/layout'
import { bambooSprite, bushSprite, irisSprite, reedsSprite, rockSprite, treeSprite } from './nature'
import { build, type Sprite } from './sprite'

export interface PropArt {
  sprite: Sprite
  /** Light source relative to the anchor, lit at night (lanterns, brazier). */
  glow?: { x: number; y: number; r: number; color: string; flame?: boolean }
  /** Smoke/steam source relative to the anchor (incense burner). */
  smoke?: { x: number; y: number }
}

const INK = '#1a1220'
const STONE = { d: '#5d5a58', m: '#87837d', l: '#a9a59e', h: '#c6c2ba' }
const WOOD = { d: '#3d2615', m: '#6a4426', l: '#8f6038', h: '#b07e4c' }

const cache = new Map<string, PropArt>()

export function propArt(p: Prop, seed: number, fenceMask = 0): PropArt | null {
  const key =
    p.kind === 'tree'
      ? `tree:${p.variant}:${seed % 3}`
      : p.kind === 'fence' || p.kind === 'wall'
        ? `${p.kind}:${fenceMask}`
        : ['bamboo', 'bush', 'hydrangea', 'iris', 'reeds', 'rock'].includes(p.kind)
          ? `${p.kind}:${seed % 4}`
          : `${p.kind}:${p.variant ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit
  const art = make(p, seed, fenceMask)
  if (art) cache.set(key, art)
  return art
}

function make(p: Prop, seed: number, fenceMask: number): PropArt | null {
  switch (p.kind) {
    case 'tree':
      return { sprite: treeSprite((p.variant ?? 'broad') as never, seed) }
    case 'bamboo':
      return { sprite: bambooSprite(seed) }
    case 'bush':
      return { sprite: bushSprite(seed, false) }
    case 'hydrangea':
      return { sprite: bushSprite(seed, true) }
    case 'iris':
      return { sprite: irisSprite(seed) }
    case 'reeds':
      return { sprite: reedsSprite(seed) }
    case 'rock':
      return { sprite: rockSprite(seed) }
    case 'lantern':
      return lantern()
    case 'well':
      return well()
    case 'board':
      return board(p.variant === 'contracts')
    case 'jizo':
      return jizo()
    case 'sign':
      return sign()
    case 'bench':
      return bench(p.variant === 'parasol')
    case 'nobori':
      return nobori()
    case 'casks':
      return casks(p.variant === 'one')
    case 'hay':
      return hay()
    case 'firewood':
      return firewood()
    case 'scarecrow':
      return scarecrow()
    case 'fence':
      return fence(fenceMask)
    case 'laundry':
      return laundry()
    case 'brazier':
      return brazier()
    case 'boat':
      return boat()
    case 'nets':
      return nets()
    case 'trough':
      return trough()
    case 'torii':
      return torii()
    case 'wall':
      return wall(fenceMask)
    case 'ship':
      return ship()
    case 'lighthouse':
      return lighthouse()
    case 'grave':
      return grave(Number(p.variant ?? 0))
    case 'incense':
      return incense()
    case 'stall':
      return stall(p.variant ?? 'veg')
    case 'bales':
      return bales()
    case 'crates':
      return crates()
    case 'anchor':
      return anchor()
    case 'redbridge':
      return redbridge(p.w ?? 5)
    case 'komainu':
      return komainu(p.variant === 'fox', p.x % 2 === 0)
    case 'table':
      return table()
    case 'cart':
      return cart(p.variant === 'barrels')
    case 'kago':
      return kago()
    case 'campfire':
      return campfire()
    case 'bedroll':
      return bedroll(seed)
  }
}

function lantern(): PropArt {
  const img = build(
    16,
    30,
    (ctx) => {
      px(ctx, 3, 25, 10, 3, STONE.m) // base
      px(ctx, 3, 25, 10, 1, STONE.l)
      px(ctx, 6, 16, 4, 9, STONE.m) // pillar
      px(ctx, 6, 16, 1, 9, STONE.l)
      px(ctx, 4, 14, 8, 2, STONE.m) // platform
      px(ctx, 4, 8, 8, 6, STONE.m) // firebox
      px(ctx, 6, 9, 4, 4, '#2a2420') // window
      px(ctx, 4, 8, 1, 6, STONE.l)
      px(ctx, 1, 5, 14, 3, STONE.m) // roof
      px(ctx, 1, 5, 14, 1, STONE.h)
      dot(ctx, 1, 4, STONE.m)
      dot(ctx, 14, 4, STONE.m)
      px(ctx, 5, 3, 6, 2, STONE.l)
      px(ctx, 7, 0, 2, 3, STONE.m) // finial
      dot(ctx, 4, 20, '#6b8a46')
      dot(ctx, 11, 26, '#6b8a46')
    },
    { outline: '#3a3632', shadow: { cx: 8, cy: 28, rx: 6, ry: 1.5 } },
  )
  return { sprite: { img, ax: 8, ay: 28 }, glow: { x: 0, y: -17, r: 34, color: '#ffc06a', flame: true } }
}

function well(): PropArt {
  const img = build(
    24,
    34,
    (ctx) => {
      // Roof posts and little gable roof.
      px(ctx, 3, 8, 2, 20, WOOD.m)
      px(ctx, 19, 8, 2, 20, WOOD.m)
      px(ctx, 1, 4, 22, 3, '#4a515e')
      px(ctx, 3, 2, 18, 2, '#5e6878')
      px(ctx, 6, 1, 12, 1, '#77829a')
      px(ctx, 4, 10, 16, 1, WOOD.d) // pulley beam
      px(ctx, 11, 11, 1, 9, '#c9b58a') // rope
      px(ctx, 10, 18, 3, 3, WOOD.l) // bucket
      // Stone ring.
      ellipse(ctx, 12, 26, 10, 5, STONE.m)
      ellipse(ctx, 12, 25, 10, 4, STONE.l)
      ellipse(ctx, 12, 25, 7, 2.5, '#1e2a34')
      ellipse(ctx, 12, 25.5, 5, 1.5, '#2c4a5e')
      px(ctx, 2, 26, 20, 4, STONE.m)
      for (let x = 3; x < 22; x += 4) px(ctx, x, 27, 1, 3, STONE.d)
    },
    { outline: INK, shadow: { cx: 12, cy: 31, rx: 10, ry: 2 } },
  )
  return { sprite: { img, ax: 12, ay: 31 } }
}

function board(contracts = false): PropArt {
  const img = build(
    34,
    30,
    (ctx) => {
      px(ctx, 4, 12, 2, 16, WOOD.m)
      px(ctx, 28, 12, 2, 16, WOOD.m)
      px(ctx, 2, 8, 30, 13, WOOD.l) // board
      px(ctx, 2, 8, 30, 1, WOOD.h)
      px(ctx, 0, 4, 34, 3, '#4a515e') // little roof
      px(ctx, 2, 3, 30, 1, '#6b7790')
      // Posted notices with scribbled lines.
      for (const [x, w] of [
        [4, 8],
        [13, 7],
        [22, 8],
      ]) {
        px(ctx, x, 10, w, 9, '#f1e6cc')
        for (let y = 12; y < 18; y += 2) px(ctx, x + 1, y, w - 2 - (y % 3), 1, '#3d3449')
      }
      dot(ctx, 15, 11, '#d23c2a')
      if (contracts) {
        // Wanted posters with red seals, a crude drawing of something with a plate on its head,
        // and a knife pinning the newest one.
        px(ctx, 13, 10, 7, 9, '#e0d0a8')
        ellipse(ctx, 16, 14, 2, 2, '#4a6a3a')
        px(ctx, 15, 11, 3, 1, '#a8b0a0')
        dot(ctx, 9, 17, '#a02a1e')
        dot(ctx, 27, 17, '#a02a1e')
        dot(ctx, 18, 17, '#a02a1e')
        px(ctx, 24, 9, 1, 5, '#c8ccd4')
        px(ctx, 23, 8, 3, 1, '#3a2a1c')
        px(ctx, 24, 6, 1, 2, '#3a2a1c')
        // A torn corner flapping.
        px(ctx, 4, 19, 3, 2, '#f1e6cc')
      }
    },
    { outline: INK, shadow: { cx: 17, cy: 28, rx: 14, ry: 2 } },
  )
  return { sprite: { img, ax: 16, ay: 28 } }
}

function jizo(): PropArt {
  const img = build(
    14,
    20,
    (ctx) => {
      ellipse(ctx, 7, 14, 5, 5, STONE.m) // body
      ellipse(ctx, 6.5, 13, 3.5, 3.5, STONE.l)
      ellipse(ctx, 7, 6, 3.5, 3.5, STONE.l) // head
      dot(ctx, 6, 6, STONE.d)
      dot(ctx, 8, 6, STONE.d)
      px(ctx, 4, 2, 6, 3, '#d23c2a') // red cap
      px(ctx, 3, 9, 8, 4, '#d23c2a') // red bib
      px(ctx, 4, 12, 6, 1, '#a32a1e')
      px(ctx, 5, 17, 4, 2, '#f4f1ea') // rice ball offering
      dot(ctx, 6, 18, '#2a2233')
    },
    { outline: '#3a3632', shadow: { cx: 7, cy: 18, rx: 6, ry: 1.5 } },
  )
  return { sprite: { img, ax: 7, ay: 18 } }
}

function sign(): PropArt {
  const img = build(
    20,
    24,
    (ctx) => {
      px(ctx, 9, 8, 2, 15, WOOD.m)
      px(ctx, 2, 4, 16, 7, WOOD.l)
      px(ctx, 2, 4, 16, 1, WOOD.h)
      px(ctx, 5, 7, 9, 1, WOOD.d)
      dot(ctx, 4, 7, WOOD.d)
      dot(ctx, 15, 7, WOOD.d)
    },
    { outline: INK, shadow: { cx: 10, cy: 22, rx: 4, ry: 1.5 } },
  )
  return { sprite: { img, ax: 10, ay: 22 } }
}

function bench(parasol: boolean): PropArt {
  const H = parasol ? 48 : 18
  const img = build(
    34,
    H,
    (ctx) => {
      const y = H - 12
      px(ctx, 3, y + 4, 2, 6, WOOD.d)
      px(ctx, 29, y + 4, 2, 6, WOOD.d)
      px(ctx, 1, y, 32, 5, '#c0262f') // red felt
      px(ctx, 1, y, 32, 1, '#e04a4a')
      px(ctx, 1, y + 4, 32, 1, '#8e1a22')
      if (parasol) {
        px(ctx, 25, 8, 1, y - 6, WOOD.m) // pole
        ellipse(ctx, 20, 9, 17, 6, '#a81e26')
        ellipse(ctx, 20, 8, 16, 5, '#d23c2a')
        ellipse(ctx, 18, 6, 9, 2.5, '#e8584a')
        for (let i = -14; i <= 14; i += 7) px(ctx, 20 + i, 9, 1, 3, '#7a141a')
        px(ctx, 19, 2, 2, 2, WOOD.m)
      }
    },
    { outline: INK, shadow: { cx: 17, cy: H - 2, rx: 16, ry: 2 } },
  )
  return { sprite: { img, ax: 16, ay: H - 3 } }
}

function nobori(): PropArt {
  const img = build(
    14,
    48,
    (ctx) => {
      px(ctx, 2, 2, 1, 44, WOOD.d)
      px(ctx, 2, 3, 9, 1, WOOD.d)
      px(ctx, 3, 4, 8, 30, '#c0262f')
      px(ctx, 3, 4, 2, 30, '#e04a4a')
      px(ctx, 3, 31, 8, 3, '#8e1a22')
      // A white tea mark.
      px(ctx, 5, 9, 5, 1, '#f4f1ea')
      px(ctx, 7, 8, 1, 4, '#f4f1ea')
      px(ctx, 5, 13, 5, 1, '#f4f1ea')
      px(ctx, 6, 15, 3, 4, '#f4f1ea')
      dot(ctx, 5, 20, '#f4f1ea')
      dot(ctx, 9, 20, '#f4f1ea')
    },
    { outline: INK, shadow: { cx: 3, cy: 46, rx: 3, ry: 1 } },
  )
  return { sprite: { img, ax: 3, ay: 46 } }
}

function cask(ctx: Ctx, x: number, y: number): void {
  px(ctx, x, y, 12, 12, '#d9c27a')
  px(ctx, x, y, 3, 12, '#ecd892')
  px(ctx, x + 10, y, 2, 12, '#b49a54')
  for (let i = 0; i < 12; i += 2) dot(ctx, x + 4 + (i % 5), y + i, '#b49a54')
  px(ctx, x, y + 2, 12, 1, '#7a5a2a')
  px(ctx, x, y + 9, 12, 1, '#7a5a2a')
  px(ctx, x + 3, y + 4, 6, 4, '#f4f1ea') // label
  px(ctx, x + 5, y + 4, 2, 4, '#c0262f')
  px(ctx, x + 1, y - 2, 10, 2, '#c9b070') // lid
}

function casks(one: boolean): PropArt {
  const W = one ? 16 : 32
  const img = build(
    W,
    one ? 18 : 30,
    (ctx) => {
      if (one) cask(ctx, 2, 4)
      else {
        cask(ctx, 2, 16)
        cask(ctx, 16, 16)
        cask(ctx, 9, 4)
      }
    },
    { outline: '#3d2a14', shadow: { cx: W / 2, cy: one ? 16 : 28, rx: W / 2 - 1, ry: 2 } },
  )
  return { sprite: { img, ax: one ? 8 : 16, ay: one ? 16 : 28 } }
}

function hay(): PropArt {
  const img = build(
    20,
    24,
    (ctx) => {
      for (let y = 2; y < 22; y++) {
        const half = Math.round(2 + (y - 2) * 0.38)
        px(ctx, 10 - half, y, half * 2, 1, '#c9a752')
        px(ctx, 10 - half, y, Math.round(half * 0.6), 1, '#dcbe6a')
        if (y % 3 === 0) px(ctx, 10 + half - 3, y, 3, 1, '#9c7e36')
      }
      px(ctx, 8, 0, 4, 3, '#a68a48')
      px(ctx, 3, 12, 14, 1, '#7a5a2a')
    },
    { outline: '#4a3618', shadow: { cx: 10, cy: 21, rx: 9, ry: 2 } },
  )
  return { sprite: { img, ax: 10, ay: 21 } }
}

function firewood(): PropArt {
  const img = build(
    20,
    20,
    (ctx) => {
      px(ctx, 1, 2, 18, 2, '#5e6878') // board roof
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 4; i++) {
          const x = 2 + i * 4 + (row % 2) * 2
          const y = 6 + row * 4
          px(ctx, x, y, 4, 4, '#8a6036')
          px(ctx, x + 1, y + 1, 2, 2, '#c49a62')
          dot(ctx, x + 1, y + 1, '#a87a46')
        }
    },
    { outline: '#3d2615', shadow: { cx: 10, cy: 18, rx: 9, ry: 2 } },
  )
  return { sprite: { img, ax: 10, ay: 18 } }
}

function scarecrow(): PropArt {
  const img = build(
    22,
    34,
    (ctx) => {
      px(ctx, 10, 10, 2, 22, WOOD.m) // pole
      px(ctx, 2, 13, 18, 2, WOOD.m) // arms
      px(ctx, 6, 13, 10, 10, '#4a6a9a') // ragged kimono
      px(ctx, 6, 13, 3, 10, '#5a7aaa')
      px(ctx, 9, 18, 4, 3, '#c0626a') // patch
      for (const x of [6, 9, 12, 15]) dot(ctx, x, 23, '#4a6a9a')
      px(ctx, 1, 12, 3, 4, '#d9c27a') // straw hands
      px(ctx, 18, 12, 3, 4, '#d9c27a')
      ellipse(ctx, 11, 9, 3.5, 3.5, '#d9c27a') // straw head
      dot(ctx, 10, 9, INK)
      dot(ctx, 12, 9, INK)
      ellipse(ctx, 11, 5, 9, 2.5, '#c9a752') // kasa
      px(ctx, 9, 2, 4, 2, '#dcbe6a')
    },
    { outline: INK, shadow: { cx: 11, cy: 32, rx: 5, ry: 1.5 } },
  )
  return { sprite: { img, ax: 11, ay: 31 } }
}

/** Bamboo fence tile; mask bits: 1 = left, 2 = right, 4 = up, 8 = down neighbours are fence. */
function fence(mask: number): PropArt {
  const horiz = (mask & 3) !== 0 || (mask & 12) === 0
  const vert = (mask & 12) !== 0
  const img = build(
    18,
    24,
    (ctx) => {
      const post = (x: number) => {
        px(ctx, x, 6, 2, 16, '#b59a5a')
        dot(ctx, x, 6, '#d9c27a')
        px(ctx, x, 13, 2, 1, '#8a7038')
      }
      if (horiz) {
        const x0 = mask & 1 ? 0 : 7
        const x1 = mask & 2 ? 18 : 11
        px(ctx, x0, 10, x1 - x0, 2, '#c9ae68')
        px(ctx, x0, 16, x1 - x0, 2, '#c9ae68')
        px(ctx, x0, 11, x1 - x0, 1, '#9c8040')
        px(ctx, x0, 17, x1 - x0, 1, '#9c8040')
      }
      if (vert) {
        const y0 = mask & 4 ? 0 : 8
        const y1 = mask & 8 ? 24 : 21
        px(ctx, 8, y0, 2, y1 - y0, '#c9ae68')
        px(ctx, 9, y0, 1, y1 - y0, '#9c8040')
      }
      post(8)
    },
    { outline: '#4a3a1a' },
  )
  return { sprite: { img, ax: 9, ay: 21 } }
}

function laundry(): PropArt {
  const img = build(
    34,
    30,
    (ctx) => {
      px(ctx, 2, 4, 2, 24, WOOD.m)
      px(ctx, 30, 4, 2, 24, WOOD.m)
      px(ctx, 0, 5, 34, 1, '#c9ae68')
      // A blue cloth, a striped kimono and Gonbei's famous loincloth.
      px(ctx, 5, 6, 7, 9, '#3c5788')
      px(ctx, 5, 6, 2, 9, '#5a74a8')
      px(ctx, 13, 6, 9, 13, '#e0d6bc')
      for (let y = 7; y < 19; y += 3) px(ctx, 13, y, 9, 1, '#b8613a')
      px(ctx, 23, 6, 5, 3, '#f4f1ea')
      px(ctx, 24, 9, 3, 6, '#f4f1ea')
    },
    { outline: INK, shadow: { cx: 17, cy: 28, rx: 15, ry: 2 } },
  )
  return { sprite: { img, ax: 16, ay: 27 } }
}

function brazier(): PropArt {
  const img = build(
    16,
    26,
    (ctx) => {
      // Tripod.
      px(ctx, 3, 12, 1, 12, '#2a2420')
      px(ctx, 12, 12, 1, 12, '#2a2420')
      px(ctx, 7, 12, 2, 12, '#3a322c')
      // Iron basket with logs.
      px(ctx, 2, 6, 12, 7, '#2a2420')
      for (let x = 3; x < 13; x += 3) px(ctx, x, 7, 2, 5, '#4a3e36')
      px(ctx, 3, 5, 10, 2, '#7a4a2a')
    },
    { outline: INK, shadow: { cx: 8, cy: 24, rx: 6, ry: 1.5 } },
  )
  return { sprite: { img, ax: 8, ay: 24 }, glow: { x: 0, y: -21, r: 56, color: '#ffa848', flame: true } }
}

function boat(): PropArt {
  const img = build(
    30,
    16,
    (ctx) => {
      ellipse(ctx, 15, 8, 13, 5, '#6a4426')
      ellipse(ctx, 15, 7, 12, 4, '#8f6038')
      ellipse(ctx, 15, 8, 10, 2.5, '#4a2e18')
      px(ctx, 13, 5, 3, 6, '#a87a46') // seat
      px(ctx, 22, 7, 7, 1, '#b07e4c') // oar
    },
    { outline: '#2a1a0e', shadow: { cx: 15, cy: 12, rx: 13, ry: 2, alpha: 0.35 } },
  )
  return { sprite: { img, ax: 15, ay: 12 } }
}

function nets(): PropArt {
  const img = build(
    22,
    28,
    (ctx) => {
      px(ctx, 2, 2, 2, 24, WOOD.m)
      px(ctx, 18, 2, 2, 24, WOOD.m)
      px(ctx, 2, 3, 18, 1, WOOD.d)
      for (let y = 4; y < 20; y++)
        for (let x = 4; x < 18; x++) if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) dot(ctx, x, y, '#9a9a8a')
      px(ctx, 8, 16, 3, 2, '#7a5a3a') // the sandal
    },
    { outline: '#3a3226', shadow: { cx: 11, cy: 26, rx: 9, ry: 1.5 } },
  )
  return { sprite: { img, ax: 11, ay: 26 } }
}

function trough(): PropArt {
  const img = build(
    18,
    12,
    (ctx) => {
      px(ctx, 1, 3, 16, 6, WOOD.m)
      px(ctx, 2, 4, 14, 3, '#7a9a5a')
      px(ctx, 1, 3, 16, 1, WOOD.h)
      px(ctx, 2, 9, 2, 2, WOOD.d)
      px(ctx, 14, 9, 2, 2, WOOD.d)
    },
    { outline: INK, shadow: { cx: 9, cy: 10, rx: 8, ry: 1.5 } },
  )
  return { sprite: { img, ax: 9, ay: 10 } }
}

function torii(): PropArt {
  const W = 76
  const H = 60
  const img = build(
    W,
    H,
    (ctx) => {
      const red = '#d23c2a'
      const redD = '#a32a1e'
      const redL = '#e8604a'
      // Pillars (slightly leaning in), black feet.
      for (const x of [12, 59]) {
        px(ctx, x, 14, 5, 42, red)
        px(ctx, x, 14, 1, 42, redL)
        px(ctx, x + 4, 14, 1, 42, redD)
        px(ctx, x - 1, 52, 7, 5, '#2a2233')
      }
      // Nuki (lower crossbeam).
      px(ctx, 6, 20, 64, 4, red)
      px(ctx, 6, 20, 64, 1, redL)
      px(ctx, 6, 23, 64, 1, redD)
      // Shimaki + kasagi (top beams), the kasagi black with upswept ends.
      px(ctx, 4, 9, 68, 4, red)
      px(ctx, 4, 12, 68, 1, redD)
      px(ctx, 1, 4, 74, 5, '#2a2233')
      px(ctx, 1, 4, 74, 1, '#4a4058')
      px(ctx, 0, 2, 4, 3, '#2a2233')
      px(ctx, 72, 2, 4, 3, '#2a2233')
      // Plaque.
      px(ctx, 34, 12, 8, 9, '#2a2233')
      px(ctx, 35, 13, 6, 7, '#e0b13c')
      px(ctx, 37, 14, 2, 5, '#2a2233')
    },
    { outline: INK, shadow: { cx: 38, cy: 56, rx: 30, ry: 2, alpha: 0.18 } },
  )
  return { sprite: { img, ax: 38, ay: 56 } }
}

/** Jinbei's market mat: fans, combs, a bolt of cloth and a "rare" tea bowl. */
export function stallSprite(): Sprite {
  const key = 'stall'
  const hit = cache.get(key)
  if (hit) return hit.sprite
  const img = build(
    36,
    16,
    (ctx) => {
      px(ctx, 1, 4, 34, 10, '#c9a752')
      for (let y = 5; y < 14; y += 2) px(ctx, 1, y, 34, 1, '#b49a54')
      // Fans.
      for (const [x, c] of [
        [4, '#d23c2a'],
        [10, '#2f3f73'],
      ] as const) {
        ellipse(ctx, x + 2, 7, 3, 2, c)
        px(ctx, x + 2, 7, 1, 4, '#5a3a22')
      }
      px(ctx, 16, 6, 6, 5, '#7a5a8a') // bolt of cloth
      px(ctx, 16, 6, 6, 1, '#9a7aaa')
      px(ctx, 24, 9, 4, 1, '#e0b13c') // combs
      px(ctx, 24, 11, 4, 1, '#c49a62')
      ellipse(ctx, 31, 8, 3, 2, '#5a8a6a') // tea bowl, slightly broken
      dot(ctx, 33, 7, '#c9a752')
    },
    { outline: '#4a3618', shadow: { cx: 18, cy: 13, rx: 17, ry: 2 } },
  )
  const sprite = { img, ax: 18, ay: 13 }
  cache.set(key, { sprite })
  return sprite
}

// ---------- the town and the harbour ----------

const RF = ['#2c323e', '#3c4453', '#4f5a6c', '#67748c', '#8792aa']

/** Town wall piece; mask bits: 1 = left, 2 = right, 4 = up, 8 = down neighbours are wall. */
function wall(mask: number): PropArt {
  const horiz = (mask & 3) !== 0 || (mask & 12) === 0
  const bottomEnd = (mask & 8) === 0
  const H = 48
  const img = build(
    18,
    H,
    (ctx) => {
      const base = H - 2
      if (horiz) {
        const x0 = mask & 1 ? 0 : 1
        const x1 = mask & 2 ? 18 : 17
        const w = x1 - x0
        // Stone base, plaster, black skirt, tile cap.
        for (let j = 0; j < 16; j += 4)
          for (let i = -((j / 4) % 2) * 3; i < w; i += 6) {
            const sx = Math.max(x0, x0 + i)
            const ex = Math.min(x1, x0 + i + 5)
            if (ex > sx) {
              px(ctx, sx, base - 16 + j, ex - sx, 3, (i + j) % 12 === 0 ? '#8d877c' : '#a29b8c')
              px(ctx, sx, base - 16 + j, ex - sx, 1, '#b8b2a4')
            }
          }
        px(ctx, x0, base - 16, w, 16, '#5e5850')
        for (let j = 0; j < 16; j += 4)
          for (let i = -((j / 4) % 2) * 3; i < w; i += 6) {
            const sx = Math.max(x0, x0 + i)
            const ex = Math.min(x1, x0 + i + 5)
            if (ex > sx) {
              px(ctx, sx, base - 16 + j, ex - sx, 3, (i * 7 + j) % 3 === 0 ? '#8d877c' : '#a29b8c')
              px(ctx, sx, base - 16 + j, ex - sx, 1, '#b8b2a4')
            }
          }
        px(ctx, x0, base - 30, w, 14, '#f2eee4')
        px(ctx, x0, base - 19, w, 3, '#2a2420')
        px(ctx, x0, base - 36, w, 6, RF[2])
        for (let i = x0; i < x1; i += 3) px(ctx, i, base - 36, 1, 6, RF[1])
        px(ctx, x0, base - 37, w, 2, RF[0])
        px(ctx, x0, base - 31, w, 1, RF[4])
      } else {
        // Seen end-on from above: the roof strip, raised to the wall's height.
        px(ctx, 3, 0, 12, 18, RF[2])
        for (let y = 0; y < 18; y += 3) px(ctx, 3, y, 12, 1, RF[1])
        px(ctx, 8, 0, 2, 18, RF[0])
        px(ctx, 3, 0, 1, 18, RF[4])
        if (bottomEnd) {
          px(ctx, 3, 18, 12, 12, '#f2eee4')
          px(ctx, 3, 27, 12, 3, '#2a2420')
          px(ctx, 3, 30, 12, 16, '#9c9587')
          for (let j = 30; j < 46; j += 4) px(ctx, 3, j, 12, 1, '#6e685e')
        }
      }
    },
    { outline: '#1a1220' },
  )
  return { sprite: { img, ax: 9, ay: H - 3 } }
}

function ship(): PropArt {
  const W = 172
  const H = 140
  const img = build(
    W,
    H,
    (ctx) => {
      const deck = H - 30
      // Hull: long and low, bow rising on the left, stern castle on the right.
      for (let x = 6; x < W - 6; x++) {
        const t = (x - 6) / (W - 12)
        const rise = t < 0.15 ? Math.round((0.15 - t) * 70) : t > 0.82 ? Math.round((t - 0.82) * 50) : 0
        const top = deck - rise
        const bottom = H - 8 - (t < 0.1 ? Math.round((0.1 - t) * 60) : 0)
        px(ctx, x, top, 1, bottom - top, '#6a4426')
        px(ctx, x, top, 1, 2, '#8f6038')
        for (let y = top + 5; y < bottom; y += 5) dot(ctx, x, y, '#4a2c17')
        px(ctx, x, bottom - 3, 1, 3, '#2a1a10')
      }
      // A painted eye on the bow.
      ellipse(ctx, 26, deck + 2, 4, 3, '#f4f1ea')
      ellipse(ctx, 26, deck + 2, 2, 2, '#1a1220')
      // Stern cabin with a little roof.
      px(ctx, W - 44, deck - 18, 32, 16, '#8f6038')
      px(ctx, W - 40, deck - 14, 8, 6, '#f2ead4')
      px(ctx, W - 28, deck - 14, 8, 6, '#f2ead4')
      px(ctx, W - 48, deck - 22, 40, 4, '#3c4453')
      // Mast and a huge square sail with a crest.
      px(ctx, 84, 8, 4, deck - 8, '#5a3a22')
      px(ctx, 50, 12, 72, 3, '#5a3a22')
      for (let x = 52; x < 120; x++) {
        const belly = Math.round(Math.sin(((x - 52) / 68) * Math.PI) * 4)
        px(ctx, x, 15 + belly, 1, deck - 28 - belly, (x - 52) % 9 === 0 ? '#d8ccb0' : '#efe6cc')
      }
      ellipse(ctx, 86, 45, 10, 10, '#c0262f')
      ellipse(ctx, 86, 45, 6, 6, '#efe6cc')
      px(ctx, 80, 44, 13, 2, '#c0262f')
      // Rigging and a pennant.
      for (let i = 0; i < 40; i++) {
        dot(ctx, 86 - i, 10 + Math.round(i * 2.4), '#3a2a1a')
        dot(ctx, 88 + i, 10 + Math.round(i * 2.4), '#3a2a1a')
      }
      px(ctx, 88, 4, 12, 3, '#2f3f73')
    },
    { outline: '#1a1220', shadow: { cx: W / 2, cy: H - 6, rx: W / 2 - 4, ry: 4, alpha: 0.35 } },
  )
  return { sprite: { img, ax: W / 2, ay: H - 12 } }
}

function lighthouse(): PropArt {
  const img = build(
    28,
    72,
    (ctx) => {
      px(ctx, 2, 60, 24, 10, STONE.m)
      px(ctx, 2, 60, 24, 2, STONE.l)
      for (let y = 22; y < 60; y++) {
        const inset = Math.round((60 - y) * 0.12)
        px(ctx, 6 + inset, y, 16 - inset * 2, 1, (y >> 2) % 2 ? STONE.m : STONE.l)
      }
      px(ctx, 7, 12, 14, 10, '#3d2615')
      px(ctx, 9, 14, 10, 7, '#f2d8a0')
      for (let x = 10; x < 19; x += 3) px(ctx, x, 14, 1, 7, '#3d2615')
      px(ctx, 4, 8, 20, 4, '#3c4453')
      px(ctx, 8, 5, 12, 3, '#4f5a6c')
      px(ctx, 13, 1, 2, 4, STONE.d)
    },
    { outline: INK, shadow: { cx: 14, cy: 69, rx: 12, ry: 2 } },
  )
  return { sprite: { img, ax: 14, ay: 69 }, glow: { x: 0, y: -51, r: 96, color: '#fff0c0', flame: true } }
}

function grave(v: number): PropArt {
  const img = build(
    16,
    26,
    (ctx) => {
      px(ctx, 2, 20, 12, 4, STONE.m)
      px(ctx, 2, 20, 12, 1, STONE.l)
      if (v === 1) {
        ellipse(ctx, 8, 14, 4, 6, STONE.l)
        px(ctx, 6, 9, 4, 1, STONE.h)
      } else {
        px(ctx, 5, v === 2 ? 10 : 5, 6, v === 2 ? 10 : 15, STONE.l)
        px(ctx, 5, v === 2 ? 10 : 5, 6, 1, STONE.h)
        px(ctx, 10, v === 2 ? 10 : 5, 1, v === 2 ? 10 : 15, STONE.m)
      }
      for (let y = v === 2 ? 12 : 7; y < 18; y += 2) px(ctx, 7, y, 2, 1, STONE.d)
      // Wooden memorial tablets behind, fresh flowers in front.
      if (v !== 1) for (const x of [12, 14]) px(ctx, x, 2 + (x - 12) * 2, 1, 18, '#c9a070')
      px(ctx, 3, 18, 2, 2, '#e8604a')
      px(ctx, 11, 18, 2, 2, '#f2d04a')
    },
    { outline: '#3a3632', shadow: { cx: 8, cy: 23, rx: 7, ry: 1.5 } },
  )
  return { sprite: { img, ax: 8, ay: 23 } }
}

function incense(): PropArt {
  const img = build(
    34,
    34,
    (ctx) => {
      px(ctx, 6, 26, 3, 6, '#4a3a2a')
      px(ctx, 25, 26, 3, 6, '#4a3a2a')
      ellipse(ctx, 17, 22, 13, 6, '#6a5a3a')
      ellipse(ctx, 17, 20, 12, 3, '#8a7a4a')
      ellipse(ctx, 17, 20, 9, 2, '#2a2420')
      // Little roof on posts.
      px(ctx, 8, 8, 2, 12, '#4a3a2a')
      px(ctx, 24, 8, 2, 12, '#4a3a2a')
      px(ctx, 4, 5, 26, 4, '#4a5a4a')
      px(ctx, 8, 2, 18, 3, '#5a6a5a')
      dot(ctx, 17, 1, '#c9a040')
    },
    { outline: INK, shadow: { cx: 17, cy: 31, rx: 14, ry: 2 } },
  )
  return { sprite: { img, ax: 16, ay: 31 }, smoke: { x: 1, y: -12 } }
}

function stall(v: string): PropArt {
  const goods: Record<string, (ctx: Ctx) => void> = {
    fish: (ctx) => {
      for (let x = 5; x < 29; x += 6) {
        px(ctx, x, 18, 5, 2, x % 12 ? '#a9b4bc' : '#c0626a')
        dot(ctx, x + 5, 17, '#a9b4bc')
        dot(ctx, x + 1, 18, INK)
      }
    },
    veg: (ctx) => {
      for (let x = 5; x < 29; x += 5) {
        px(ctx, x, 17, 3, 3, x % 10 ? '#68a548' : '#f4f1ea')
        dot(ctx, x + 1, 16, '#4f8a3a')
      }
      px(ctx, 24, 17, 3, 3, '#5a2f6a')
    },
    fans: (ctx) => {
      const c = ['#d23c2a', '#2f3f73', '#e0b13c', '#f4f1ea']
      for (let i = 0; i < 4; i++) {
        ellipse(ctx, 8 + i * 6, 17, 3, 2, c[i])
        px(ctx, 8 + i * 6, 17, 1, 3, WOOD.m)
      }
    },
    pots: (ctx) => {
      for (let x = 6; x < 29; x += 6) {
        ellipse(ctx, x + 1, 17, 2.5, 2.5, x % 12 ? '#8a5a3a' : '#5a7a6a')
        px(ctx, x, 14, 3, 1, '#4a2c17')
      }
    },
  }
  const stripe = v === 'fish' ? '#2f3f73' : v === 'fans' ? '#c0262f' : v === 'pots' ? '#5a7a6a' : '#5a8a4a'
  const img = build(
    34,
    32,
    (ctx) => {
      px(ctx, 3, 4, 1, 24, WOOD.d)
      px(ctx, 30, 4, 1, 24, WOOD.d)
      for (let x = 1; x < 33; x++) px(ctx, x, 3, 1, 6, Math.floor(x / 4) % 2 ? stripe : '#f1e6cc')
      for (let x = 1; x < 33; x += 4) px(ctx, x, 9, 2, 1, stripe)
      px(ctx, 2, 20, 30, 3, WOOD.l)
      px(ctx, 2, 23, 30, 5, WOOD.m)
      px(ctx, 4, 28, 2, 2, WOOD.d)
      px(ctx, 28, 28, 2, 2, WOOD.d)
      goods[v]?.(ctx)
    },
    { outline: INK, shadow: { cx: 17, cy: 29, rx: 15, ry: 2 } },
  )
  return { sprite: { img, ax: 16, ay: 29 } }
}

function bales(): PropArt {
  const img = build(
    34,
    26,
    (ctx) => {
      const bale = (x: number, y: number) => {
        px(ctx, x, y, 10, 8, '#c9a752')
        px(ctx, x, y, 10, 1, '#dcbe6a')
        px(ctx, x + 2, y, 1, 8, '#9c7e36')
        px(ctx, x + 7, y, 1, 8, '#9c7e36')
        ellipse(ctx, x + 1, y + 4, 1.5, 3.5, '#b49040')
      }
      bale(2, 16)
      bale(12, 16)
      bale(22, 16)
      bale(7, 8)
      bale(17, 8)
    },
    { outline: '#4a3618', shadow: { cx: 17, cy: 24, rx: 16, ry: 2 } },
  )
  return { sprite: { img, ax: 16, ay: 23 } }
}

function crates(): PropArt {
  const img = build(
    18,
    22,
    (ctx) => {
      const crate = (x: number, y: number, s: number) => {
        px(ctx, x, y, s, s, '#a87a46')
        px(ctx, x, y, s, 1, '#c49a62')
        for (let i = x + 3; i < x + s; i += 3) px(ctx, i, y + 1, 1, s - 1, '#7a5232')
        px(ctx, x, y + Math.floor(s / 2), s, 1, '#7a5232')
      }
      crate(1, 10, 10)
      crate(9, 12, 8)
      crate(4, 3, 8)
    },
    { outline: '#3d2615', shadow: { cx: 9, cy: 20, rx: 8, ry: 1.5 } },
  )
  return { sprite: { img, ax: 9, ay: 20 } }
}

function anchor(): PropArt {
  const img = build(
    18,
    14,
    (ctx) => {
      px(ctx, 3, 6, 12, 2, '#3a3a40')
      for (const [x, y] of [
        [2, 4],
        [1, 3],
        [15, 4],
        [16, 3],
        [8, 3],
        [8, 9],
      ])
        px(ctx, x, y, 2, 2, '#3a3a40')
      ellipse(ctx, 14, 10, 2, 2, '#5a4a3a')
      px(ctx, 14, 8, 1, 4, '#c9b58a')
    },
    { outline: INK, shadow: { cx: 9, cy: 11, rx: 8, ry: 1.5 } },
  )
  return { sprite: { img, ax: 9, ay: 11 } }
}

function redbridge(w: number): PropArt {
  const W = w * 16 + 6
  const img = build(
    W,
    30,
    (ctx) => {
      const red = '#d23c2a'
      for (let x = 2; x < W - 2; x++) {
        const t = (x - 2) / (W - 4)
        const lift = Math.round(Math.sin(t * Math.PI) * 8)
        px(ctx, x, 18 - lift, 1, 5, '#8f6038')
        dot(ctx, x, 18 - lift, '#b07e4c')
        px(ctx, x, 11 - lift, 1, 2, red)
        dot(ctx, x, 11 - lift, '#e8604a')
        if ((x - 2) % 10 === 0) {
          px(ctx, x, 11 - lift, 2, 8, red)
          dot(ctx, x, 9 - lift, '#e0b13c')
        }
      }
    },
    { outline: INK },
  )
  return { sprite: { img, ax: W / 2, ay: 26 } }
}

function komainu(fox: boolean, flip: boolean): PropArt {
  const img = build(
    16,
    22,
    (ctx) => {
      px(ctx, 2, 16, 12, 5, STONE.m)
      px(ctx, 2, 16, 12, 1, STONE.l)
      const body = fox ? '#e8e4dc' : STONE.l
      px(ctx, 5, 8, 6, 8, body)
      ellipse(ctx, flip ? 9 : 7, 6, 3, 3, body)
      if (fox) {
        px(ctx, flip ? 7 : 5, 2, 1, 3, body)
        px(ctx, flip ? 10 : 8, 2, 1, 3, body)
        px(ctx, 5, 10, 6, 2, '#d23c2a')
        px(ctx, flip ? 3 : 11, 9, 2, 6, body)
      } else {
        px(ctx, 4, 3, 8, 3, STONE.m)
        for (let x = 4; x < 12; x += 2) dot(ctx, x, 3, STONE.d)
      }
      dot(ctx, flip ? 9 : 6, 6, INK)
    },
    { outline: '#3a3632', shadow: { cx: 8, cy: 20, rx: 6, ry: 1.5 } },
  )
  return { sprite: { img, ax: 8, ay: 20 } }
}

function table(): PropArt {
  const img = build(
    20,
    20,
    (ctx) => {
      px(ctx, 2, 10, 16, 3, '#4a3a6a')
      px(ctx, 2, 13, 16, 2, '#36284e')
      px(ctx, 3, 15, 2, 4, WOOD.d)
      px(ctx, 15, 15, 2, 4, WOOD.d)
      px(ctx, 6, 5, 4, 5, '#8a6038')
      for (let x = 7; x < 10; x++) px(ctx, x, 2, 1, 4, '#d8c9a0')
      px(ctx, 12, 6, 4, 4, '#f1e6cc')
      dot(ctx, 13, 7, '#d23c2a')
    },
    { outline: INK, shadow: { cx: 10, cy: 18, rx: 8, ry: 1.5 } },
  )
  return { sprite: { img, ax: 10, ay: 18 } }
}

function cart(barrels: boolean): PropArt {
  const img = build(
    34,
    26,
    (ctx) => {
      px(ctx, 2, 14, 26, 4, WOOD.l)
      px(ctx, 2, 14, 26, 1, WOOD.h)
      px(ctx, 26, 15, 8, 2, WOOD.m) // handles
      if (barrels)
        for (const x of [4, 12, 20]) {
          px(ctx, x, 6, 7, 8, '#d9c27a')
          px(ctx, x, 8, 7, 1, '#7a5a2a')
          px(ctx, x + 2, 9, 3, 3, '#f4f1ea')
        }
      else
        for (let i = 0; i < 6; i++) {
          px(ctx, 4 + i * 4, 9 + (i % 2), 3, 5, '#f4f1ea')
          px(ctx, 4 + i * 4, 7 + (i % 2), 3, 2, '#68a548')
        }
      ellipse(ctx, 9, 20, 5, 5, WOOD.d)
      ellipse(ctx, 9, 20, 3, 3, WOOD.m)
      dot(ctx, 9, 20, WOOD.d)
    },
    { outline: INK, shadow: { cx: 16, cy: 24, rx: 15, ry: 2 } },
  )
  return { sprite: { img, ax: 16, ay: 24 } }
}

function kago(): PropArt {
  const img = build(
    36,
    30,
    (ctx) => {
      px(ctx, 0, 6, 36, 2, '#3d2615') // carrying pole
      px(ctx, 8, 8, 20, 16, '#2a2233') // lacquered box
      px(ctx, 10, 11, 16, 9, '#c9a040')
      for (let x = 11; x < 26; x += 3) px(ctx, x, 11, 1, 9, '#7a5a1a')
      px(ctx, 6, 3, 24, 4, '#2a2233') // roof
      px(ctx, 8, 2, 20, 1, '#4a4058')
      px(ctx, 9, 24, 2, 4, '#3d2615')
      px(ctx, 25, 24, 2, 4, '#3d2615')
      dot(ctx, 18, 15, '#d23c2a')
    },
    { outline: INK, shadow: { cx: 18, cy: 27, rx: 14, ry: 2 } },
  )
  return { sprite: { img, ax: 16, ay: 27 } }
}

function campfire(): PropArt {
  const img = build(
    20,
    14,
    (ctx) => {
      // Ring of stones, charred logs, a pot on a tripod of sticks.
      for (const [x, y] of [
        [2, 9],
        [5, 11],
        [9, 12],
        [13, 11],
        [16, 9],
        [4, 7],
        [15, 7],
      ])
        px(ctx, x, y, 3, 2, hash3(x, y) ? '#6e6a64' : '#5a5650')
      px(ctx, 6, 8, 8, 2, '#2a1e16')
      px(ctx, 8, 7, 4, 1, '#3a2a1c')
      px(ctx, 7, 9, 6, 1, '#7a3a1a')
      px(ctx, 4, 0, 1, 8, '#4a3422')
      px(ctx, 15, 0, 1, 8, '#4a3422')
      px(ctx, 4, 0, 12, 1, '#4a3422')
      px(ctx, 7, 2, 6, 4, '#2a2626')
      px(ctx, 7, 2, 6, 1, '#4a4644')
    },
    { outline: INK, shadow: { cx: 10, cy: 12, rx: 9, ry: 2 } },
  )
  return { sprite: { img, ax: 10, ay: 12 }, glow: { x: 0, y: -4, r: 60, color: '#ff9a40', flame: true }, smoke: { x: 0, y: -10 } }
}

const hash3 = (x: number, y: number) => ((x * 7 + y * 13) & 3) === 0

function bedroll(seed: number): PropArt {
  const cols = ['#6a5a7a', '#7a5a3a', '#5a6a5a']
  const col = cols[seed % cols.length]
  const img = build(
    16,
    8,
    (ctx) => {
      px(ctx, 1, 2, 14, 5, '#8a7c62')
      px(ctx, 4, 1, 11, 5, col)
      px(ctx, 4, 1, 11, 1, '#9a8a6a')
      ellipse(ctx, 2.5, 3.5, 2, 1.6, '#c4b48a')
    },
    { outline: INK },
  )
  return { sprite: { img, ax: 8, ay: 7 } }
}
