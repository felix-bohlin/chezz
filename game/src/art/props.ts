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
}

const INK = '#1a1220'
const STONE = { d: '#5d5a58', m: '#87837d', l: '#a9a59e', h: '#c6c2ba' }
const WOOD = { d: '#3d2615', m: '#6a4426', l: '#8f6038', h: '#b07e4c' }

const cache = new Map<string, PropArt>()

export function propArt(p: Prop, seed: number, fenceMask = 0): PropArt | null {
  const key =
    p.kind === 'tree'
      ? `tree:${p.variant}:${seed % 3}`
      : p.kind === 'fence'
        ? `fence:${fenceMask}`
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
      return board()
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

function board(): PropArt {
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
