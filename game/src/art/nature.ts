// Trees, bamboo, bushes, flowers and rocks. Canopies are built from overlapping clumps, each with a
// dark rim, a mid body and a light top-left, sorted top to bottom so lower clumps overlap — that
// layering is what makes procedural foliage read as pixel art instead of blobs.

import { dot, ellipse, px, type Ctx } from '../engine/pixel'
import { rng, type Rng } from '../engine/rng'
import type { TreeKind } from '../world/layout'
import { build, type Sprite } from './sprite'

interface Leaves {
  dark: string
  mid: string
  light: string
  hi: string
}

const BROAD: Leaves = { dark: '#2c5a2e', mid: '#3f7a3a', light: '#5a9a48', hi: '#80bb62' }
const MAPLE: Leaves = { dark: '#3d6e2a', mid: '#5a9636', light: '#7cb64a', hi: '#a6d46c' }
const PERSIMMON: Leaves = { dark: '#244a2a', mid: '#33663a', light: '#4a8448', hi: '#6aa45a' }
const WILLOW: Leaves = { dark: '#4a7a32', mid: '#6a9a42', light: '#8cbc58', hi: '#b2d880' }
const SACRED: Leaves = { dark: '#234a2a', mid: '#2f6236', light: '#467e44', hi: '#6aa25a' }

function canopy(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, leaves: Leaves, r: Rng, clumpR: [number, number]): void {
  const clumps: { x: number; y: number; r: number }[] = []
  const n = Math.round((rx * ry) / (clumpR[0] * clumpR[1] * 0.55)) + 3
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 0.72
    clumps.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: clumpR[0] + r() * (clumpR[1] - clumpR[0]) })
  }
  clumps.sort((a, b) => a.y - b.y)
  for (const c of clumps) {
    ellipse(ctx, c.x, c.y + 1, c.r, c.r * 0.9, leaves.dark)
    ellipse(ctx, c.x - 0.5, c.y, c.r - 0.8, c.r * 0.8, leaves.mid)
    // Light from the upper left.
    const lift = c.y < cy + ry * 0.2 ? 1 : 0.55
    ellipse(ctx, c.x - 1.2, c.y - c.r * 0.35, c.r * 0.55 * lift, c.r * 0.4 * lift, leaves.light)
    if (c.y < cy && r() < 0.8) dot(ctx, c.x - c.r * 0.45, c.y - c.r * 0.55, leaves.hi)
  }
  // A sprinkle of dark leaf gaps for texture.
  const k = Math.round(rx * ry * 0.06)
  for (let i = 0; i < k; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 0.8
    const x = Math.round(cx + Math.cos(a) * rx * d)
    const y = Math.round(cy + Math.sin(a) * ry * d)
    const data = ctx.getImageData(x, y, 1, 1).data
    if (data[3] > 0) dot(ctx, x, y, leaves.dark)
  }
}

function trunk(ctx: Ctx, x: number, top: number, bottom: number, w: number, col = '#6a4426', dark = '#4a2c17', light = '#8a5c34'): void {
  px(ctx, x, top, w, bottom - top, col)
  px(ctx, x + w - 1, top, 1, bottom - top, dark)
  px(ctx, x, top, 1, bottom - top, light)
  // Root flare.
  px(ctx, x - 1, bottom - 2, w + 2, 2, col)
  px(ctx, x + w, bottom - 2, 1, 2, dark)
  px(ctx, x - 1, bottom - 2, 1, 1, light)
}

const cache = new Map<string, Sprite>()

export function treeSprite(kind: TreeKind, seed: number): Sprite {
  const variant = seed % 3
  const key = `${kind}:${variant}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(seed * 7919 + kind.length * 104729)
  let s: Sprite
  switch (kind) {
    case 'pine':
      s = pine(r)
      break
    case 'cedar':
      s = cedar(r)
      break
    case 'willow':
      s = willow(r)
      break
    case 'sacred':
      s = sacred(r)
      break
    case 'blackpine':
      s = blackpine(r)
      break
    case 'ginkgo':
      s = ginkgo(r)
      break
    default: {
      const leaves = kind === 'maple' ? MAPLE : kind === 'persimmon' ? PERSIMMON : BROAD
      const W = 36
      const H = 46
      const img = build(
        W,
        H,
        (ctx) => {
          trunk(ctx, 16, 24, 43, 4)
          canopy(ctx, 18, 17, 14, 12, leaves, r, kind === 'maple' ? [3, 5] : [4, 7])
          if (kind === 'persimmon')
            for (let i = 0; i < 6; i++) {
              const x = 8 + Math.floor(r() * 20)
              const y = 12 + Math.floor(r() * 12)
              px(ctx, x, y, 2, 2, '#9ab84a')
              dot(ctx, x, y, '#c4d86a')
            }
        },
        { outline: leaves.dark === BROAD.dark ? '#1c3a1e' : '#1e3a1c', shadow: { cx: 18, cy: 43, rx: 11, ry: 3 } },
      )
      s = { img, ax: 18, ay: 43 }
    }
  }
  cache.set(key, s)
  return s
}

function pine(r: Rng): Sprite {
  const W = 40
  const H = 48
  const img = build(
    W,
    H,
    (ctx) => {
      // Twisting trunk.
      let x = 19
      for (let y = 45; y > 12; y--) {
        if (y % 6 === 0) x += r() < 0.5 ? -1 : 1
        px(ctx, x, y, 4, 1, '#6a4a32')
        dot(ctx, x + 3, y, '#4a2e1e')
        dot(ctx, x, y, '#8a6448')
      }
      px(ctx, x - 1, 44, 6, 2, '#6a4a32')
      // Flat cloud pads, the classic niwaki pine.
      const pads = [
        { x: 20, y: 9, rx: 9, ry: 4 },
        { x: 11 + r() * 3, y: 19, rx: 9, ry: 4 },
        { x: 29 - r() * 3, y: 23, rx: 9, ry: 4 },
        { x: 18, y: 31, rx: 8, ry: 3.5 },
      ]
      for (const p of pads) {
        ellipse(ctx, p.x, p.y + 1, p.rx, p.ry, '#1f3f2a')
        ellipse(ctx, p.x, p.y, p.rx - 0.5, p.ry - 0.6, '#2c5638')
        ellipse(ctx, p.x - 1, p.y - 1, p.rx - 2.5, p.ry - 2, '#3f7448')
        for (let i = -p.rx + 2; i < p.rx - 2; i += 2) dot(ctx, p.x + i, p.y - p.ry + 1 + (Math.abs(i) > p.rx * 0.6 ? 1 : 0), '#5a9460')
      }
    },
    { outline: '#14281a', shadow: { cx: 20, cy: 45, rx: 12, ry: 3 } },
  )
  return { img, ax: 21, ay: 45 }
}

/** Wind-bent coastal black pine, leaning away from the sea. */
function blackpine(r: Rng): Sprite {
  const W = 44
  const H = 50
  const lean = r() < 0.5 ? -1 : 1
  const img = build(
    W,
    H,
    (ctx) => {
      let x = 21
      for (let y = 47; y > 14; y--) {
        if (y % 4 === 0) x += lean
        px(ctx, x, y, 3, 1, '#4a3a2e')
        dot(ctx, x + 2, y, '#2e241c')
      }
      const top = x
      const pads = [
        { x: top, y: 12, rx: 11, ry: 4 },
        { x: top - lean * 10, y: 20, rx: 8, ry: 3.5 },
        { x: top + lean * 7, y: 26, rx: 7, ry: 3 },
      ]
      for (const p of pads) {
        ellipse(ctx, p.x, p.y + 1, p.rx, p.ry, '#18301f')
        ellipse(ctx, p.x, p.y, p.rx - 0.5, p.ry - 0.6, '#22422a')
        ellipse(ctx, p.x - 1, p.y - 1, p.rx - 3, p.ry - 2, '#355c3c')
      }
    },
    { outline: '#0e1a12', shadow: { cx: 22, cy: 47, rx: 11, ry: 3 } },
  )
  return { img, ax: 22, ay: 47 }
}

function ginkgo(r: Rng): Sprite {
  const W = 40
  const H = 64
  const img = build(
    W,
    H,
    (ctx) => {
      trunk(ctx, 18, 30, 61, 5, '#7a6a5a', '#5a4a3a', '#9a8a7a')
      canopy(ctx, 20, 26, 15, 22, { dark: '#4a7a2a', mid: '#6a9a3a', light: '#8ab84a', hi: '#b4d870' }, r, [4, 6])
    },
    { outline: '#2a4a1a', shadow: { cx: 20, cy: 61, rx: 12, ry: 3 } },
  )
  return { img, ax: 20, ay: 61 }
}

function cedar(r: Rng): Sprite {
  const W = 26
  const H = 58
  const img = build(
    W,
    H,
    (ctx) => {
      px(ctx, 11, 44, 4, 12, '#7a4a32')
      px(ctx, 14, 44, 1, 12, '#5a3222')
      px(ctx, 10, 54, 6, 2, '#7a4a32')
      const tiers = 5
      for (let t = 0; t < tiers; t++) {
        const top = 2 + t * 8
        const bottom = top + 12
        const maxHalf = 4 + t * 2
        for (let y = top; y <= bottom; y++) {
          const k = (y - top) / (bottom - top)
          const half = Math.round(1 + k * maxHalf + (r() < 0.3 ? 1 : 0))
          px(ctx, 13 - half, y, half * 2, 1, '#2b5038')
          px(ctx, 13 - half, y, Math.max(1, Math.round(half * 0.7)), 1, '#3a6646')
          px(ctx, 13 + half - 2, y, 2, 1, '#203d2c')
          if (y === bottom) px(ctx, 13 - half, y, half * 2, 1, '#203d2c')
        }
        dot(ctx, 11, top + 5, '#4f7f55')
      }
    },
    { outline: '#12261a', shadow: { cx: 13, cy: 55, rx: 8, ry: 2.5 } },
  )
  return { img, ax: 13, ay: 55 }
}

function willow(r: Rng): Sprite {
  const W = 40
  const H = 46
  const img = build(
    W,
    H,
    (ctx) => {
      trunk(ctx, 18, 18, 43, 4, '#5a4632', '#3d2e20', '#7a6448')
      canopy(ctx, 20, 12, 15, 8, WILLOW, r, [4, 6])
      // Drooping strands.
      for (let x = 6; x <= 34; x += 2) {
        const len = 8 + Math.floor(r() * 14) - Math.abs(x - 20) * 0.3
        const y0 = 12 + Math.floor(r() * 4)
        px(ctx, x, y0, 1, len, r() < 0.5 ? WILLOW.mid : WILLOW.light)
        dot(ctx, x, y0 + len, WILLOW.hi)
      }
    },
    { outline: '#2a4a1e', shadow: { cx: 20, cy: 43, rx: 13, ry: 3 } },
  )
  return { img, ax: 20, ay: 43 }
}

function sacred(r: Rng): Sprite {
  const W = 64
  const H = 72
  const img = build(
    W,
    H,
    (ctx) => {
      trunk(ctx, 27, 34, 68, 10, '#5e4430', '#3e2c1e', '#7e5e44')
      // Bark texture.
      for (let y = 36; y < 66; y += 3) dot(ctx, 29 + ((y * 7) % 6), y, '#3e2c1e')
      canopy(ctx, 32, 24, 28, 20, SACRED, r, [6, 9])
      // Shimenawa rope with zigzag paper streamers (shide).
      px(ctx, 25, 50, 14, 3, '#d9c27a')
      for (let x = 25; x < 39; x += 2) dot(ctx, x, 51, '#a68a48')
      for (const sx of [28, 34]) {
        px(ctx, sx, 53, 2, 2, '#f8f6f0')
        px(ctx, sx + 1, 55, 2, 2, '#f8f6f0')
        px(ctx, sx, 57, 2, 2, '#f8f6f0')
      }
    },
    { outline: '#132a18', shadow: { cx: 32, cy: 68, rx: 20, ry: 4 } },
  )
  return { img, ax: 32, ay: 67 }
}

export function bambooSprite(seed: number): Sprite {
  const key = `bamboo:${seed % 4}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(seed * 31 + 7)
  const W = 22
  const H = 60
  const img = build(
    W,
    H,
    (ctx) => {
      const stalks = 3 + Math.floor(r() * 3)
      for (let i = 0; i < stalks; i++) {
        const x = 4 + Math.floor(r() * 13)
        const top = 4 + Math.floor(r() * 14)
        for (let y = top; y < 57; y++) {
          px(ctx, x, y, 2, 1, '#6f9a3e')
          dot(ctx, x, y, '#94c05a')
          if ((y - top) % 8 === 0) {
            px(ctx, x - 1, y, 4, 1, '#a8cc6a')
            px(ctx, x, y + 1, 2, 1, '#4f7a2e')
          }
        }
        // Leaf sprays.
        for (let k = 0; k < 7; k++) {
          const lx = x + Math.floor(r() * 12) - 6
          const ly = top + Math.floor(r() * 18)
          const dir = lx < x ? -1 : 1
          px(ctx, lx, ly, 3, 1, k % 2 ? '#4f8a3a' : '#6aa848')
          dot(ctx, lx + (dir > 0 ? 3 : -1), ly + 1, '#3f6a2e')
        }
      }
    },
    { outline: '#26401c', shadow: { cx: 11, cy: 57, rx: 7, ry: 2 } },
  )
  const s = { img, ax: 11, ay: 57 }
  cache.set(key, s)
  return s
}

export function bushSprite(seed: number, flowers: boolean): Sprite {
  const key = `bush:${flowers}:${seed % 3}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(seed * 13 + (flowers ? 5 : 1))
  const img = build(
    22,
    18,
    (ctx) => {
      canopy(ctx, 11, 9, 9, 6, flowers ? { dark: '#2c5230', mid: '#3a6a3a', light: '#4f8448', hi: '#6aa25a' } : BROAD, r, [3, 5])
      if (flowers) {
        const blues = [
          ['#5a6ad0', '#8a9cf0', '#c4ccfa'],
          ['#7a5ac8', '#a88ae8', '#d8c8f8'],
          ['#4a7ad8', '#7aa8f0', '#bcd8fa'],
        ]
        for (let i = 0; i < 5; i++) {
          const [d, m, l] = blues[Math.floor(r() * blues.length)]
          const x = 4 + Math.floor(r() * 12)
          const y = 3 + Math.floor(r() * 8)
          px(ctx, x, y, 4, 3, d)
          px(ctx, x, y, 3, 2, m)
          dot(ctx, x + 1, y, l)
        }
      }
    },
    { outline: '#1a3418', shadow: { cx: 11, cy: 15, rx: 9, ry: 2.5 } },
  )
  const s = { img, ax: 11, ay: 15 }
  cache.set(key, s)
  return s
}

export function irisSprite(seed: number): Sprite {
  const key = `iris:${seed % 3}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(seed * 17 + 3)
  const img = build(16, 18, (ctx) => {
    for (let i = 0; i < 5; i++) {
      const x = 3 + Math.floor(r() * 10)
      const h = 7 + Math.floor(r() * 6)
      px(ctx, x, 16 - h, 1, h, i % 2 ? '#4f8a3a' : '#68a548')
    }
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const x = 3 + Math.floor(r() * 9)
      const y = 3 + Math.floor(r() * 4)
      px(ctx, x, y, 3, 2, '#6a4ab8')
      dot(ctx, x + 1, y - 1, '#8a6ad8')
      dot(ctx, x + 1, y + 1, '#f2d04a')
      px(ctx, x + 1, y + 2, 1, 3, '#4f8a3a')
    }
  })
  const s = { img, ax: 8, ay: 15 }
  cache.set(key, s)
  return s
}

export function reedsSprite(seed: number): Sprite {
  const key = `reeds:${seed % 3}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(seed * 19 + 11)
  const img = build(16, 24, (ctx) => {
    for (let i = 0; i < 7; i++) {
      const x = 2 + Math.floor(r() * 12)
      const h = 10 + Math.floor(r() * 10)
      px(ctx, x, 22 - h, 1, h, i % 3 ? '#8aa84a' : '#b0b860')
      if (r() < 0.35) px(ctx, x, 22 - h - 3, 1, 4, '#7a4e2a')
    }
  })
  const s = { img, ax: 8, ay: 21 }
  cache.set(key, s)
  return s
}

export function rockSprite(seed: number): Sprite {
  const key = `rock:${seed % 3}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(seed * 23 + 5)
  const w = 8 + Math.floor(r() * 4)
  const img = build(
    20,
    16,
    (ctx) => {
      ellipse(ctx, 10, 10, w * 0.75, 4.5, '#6f6b66')
      ellipse(ctx, 9.5, 9, w * 0.68, 4, '#8d8983')
      ellipse(ctx, 8.5, 8, w * 0.45, 2.5, '#a9a59e')
      ellipse(ctx, 9, 6.5, w * 0.4, 1.5, '#6b8a46')
      dot(ctx, 7, 6, '#86a85a')
    },
    { outline: '#3e3a36', shadow: { cx: 10, cy: 13, rx: 7, ry: 2 } },
  )
  const s = { img, ax: 10, ay: 13 }
  cache.set(key, s)
  return s
}
