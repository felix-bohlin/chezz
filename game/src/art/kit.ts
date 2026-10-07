// Shared building parts: roofs (thatch, clay tile, boards), posts, shoji, lattice, noren curtains,
// stone footings, namako walls, paper lanterns, and the frame/finish helpers every building uses.

import { canvas, dot, ellipse, grime, mix, mute, outline, px, type Ctx } from '../engine/pixel'
import { hash, noise } from '../engine/rng'
import { TILE, type Building } from '../world/layout'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface BuildingArt {
  img: HTMLCanvasElement
  /** Sprite pixel that sits on the footprint's bottom-left corner. */
  ax: number
  ay: number
  windows: Rect[]
  /** Lanterns and fires; lit at night during `hours` [from, to) minutes (default: evenings). */
  lamps: { x: number; y: number; r: number; color: string; hours?: [number, number] }[]
  chimney?: { x: number; y: number }
}

export const INK = '#1a1220'
export const TH = ['#5a3e1e', '#7c5c2c', '#9e7c3c', '#bc9850', '#d8b86c']
export const TH_OLD = ['#4a3a20', '#665230', '#82703e', '#9c8a50', '#b4a266']
export const RF = ['#2c323e', '#3c4453', '#4f5a6c', '#67748c', '#8792aa']
export const DARKWOOD = '#3d2615'
export const WOODM = '#6a4426'
export const WOODL = '#8f6038'
export const PLASTER = '#e8dec6'
export const PLASTER_D = '#cbbf9f'

export const PAD = 2

// ---------- roofs ----------

export function trapezoid(top: number, bottom: number, x0: number, x1: number, inset: number, y: number): [number, number] {
  const t = (y - top) / Math.max(1, bottom - top)
  return [Math.round(x0 + inset * (1 - t)), Math.round(x1 - inset * (1 - t))]
}

export function thatchRoof(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, inset: number, seed: number, old = false): void {
  const pal = old ? TH_OLD : TH
  for (let y = top; y <= bottom; y++) {
    const [l, r] = trapezoid(top, bottom, x0, x1, inset, y)
    for (let x = l; x <= r; x++) {
      const v = noise(x / 2.1, y / 11, seed) * 0.8 + hash(x, y, seed) * 0.2
      let k = v < 0.32 ? 1 : v < 0.56 ? 2 : v < 0.8 ? 3 : 4
      const rel = (x - l) / Math.max(1, r - l)
      if (rel > 0.78) k = Math.max(0, k - 1)
      if (y - top < 4) k = Math.min(4, k + 1)
      let c = pal[k]
      if (old && noise(x / 7, y / 5, seed + 9) > 0.7) c = k > 2 ? '#7f8f45' : '#62723a'
      // The thick cut edge of the thatch at the eaves.
      if (y > bottom - 6) c = y === bottom ? pal[0] : x % 2 ? pal[3] : pal[4]
      if (y === bottom - 6) c = pal[1]
      dot(ctx, x, y, c)
    }
  }
}

export function ridgeCap(ctx: Ctx, l: number, r: number, y: number, dark = '#3a2716', light = '#5e4528'): void {
  px(ctx, l, y, r - l, 7, dark)
  px(ctx, l, y, r - l, 1, light)
  for (let x = l + 4; x < r - 4; x += 10) {
    px(ctx, x, y - 2, 3, 9, '#24180c')
    dot(ctx, x, y - 2, '#4a3220')
  }
}

export function tileRoof(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, inset: number, pal = RF): void {
  for (let y = top; y <= bottom; y++) {
    const [l, r] = trapezoid(top, bottom, x0, x1, inset, y)
    for (let x = l; x <= r; x++) {
      const ch = (x - l) % 4
      let k = ch === 0 ? 1 : ch === 1 ? 3 : 2
      if ((y - top) % 6 === 5) k = Math.max(0, k - 1)
      if ((x - l) / Math.max(1, r - l) > 0.8) k = Math.max(0, k - 1)
      let c = pal[k]
      if (y > bottom - 3) c = y === bottom ? pal[0] : ch === 1 || ch === 2 ? pal[4] : pal[1]
      dot(ctx, x, y, c)
    }
  }
  // Ridge with onigawara end tiles.
  const [l, r] = trapezoid(top, bottom, x0, x1, inset, top)
  px(ctx, l - 2, top - 5, r - l + 5, 6, pal[0])
  px(ctx, l - 2, top - 5, r - l + 5, 1, pal[3])
  px(ctx, l - 4, top - 8, 6, 9, pal[1])
  px(ctx, r - 1, top - 8, 6, 9, pal[1])
  px(ctx, l - 4, top - 8, 6, 1, pal[4])
  px(ctx, r - 1, top - 8, 6, 1, pal[4])
}

export function boardRoof(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, inset: number): void {
  for (let y = top; y <= bottom; y++) {
    const [l, r] = trapezoid(top, bottom, x0, x1, inset, y)
    for (let x = l; x <= r; x++) {
      const plank = Math.floor((x - l) / 5)
      const shade = hash(plank, 3, 99)
      let c = shade < 0.33 ? '#6e5a44' : shade < 0.66 ? '#7e6a52' : '#8e7a60'
      if ((x - l) % 5 === 4) c = '#4e3e2e'
      if (y === bottom) c = '#3e3024'
      dot(ctx, x, y, c)
    }
  }
}

/** River stones weighing down a board roof. */
export function roofStones(ctx: Ctx, l: number, r: number, y: number): void {
  for (let x = l + 4; x < r - 4; x += 9) {
    ellipse(ctx, x, y, 3, 2, '#8d8983')
    dot(ctx, x - 1, y - 1, '#b0aba2')
  }
}

// ---------- facade pieces ----------

export function post(ctx: Ctx, x: number, y: number, h: number): void {
  px(ctx, x, y, 3, h, DARKWOOD)
  px(ctx, x, y, 1, h, '#5a3a22')
}

export function shoji(ctx: Ctx, x: number, y: number, w: number, h: number): Rect {
  px(ctx, x, y, w, h, '#5a3a22')
  px(ctx, x + 1, y + 1, w - 2, h - 2, '#f2ead4')
  for (let i = x + 4; i < x + w - 1; i += 4) px(ctx, i, y + 1, 1, h - 2, '#b9a888')
  for (let j = y + 4; j < y + h - 1; j += 4) px(ctx, x + 1, j, w - 2, 1, '#b9a888')
  return { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }
}

export function planks(ctx: Ctx, x: number, y: number, w: number, h: number, base = WOODM, line = '#4a2e1a'): void {
  px(ctx, x, y, w, h, base)
  for (let j = y + 3; j < y + h; j += 4) px(ctx, x, j, w, 1, line)
}

export function lattice(ctx: Ctx, x: number, y: number, w: number, h: number, bar: string, back: string): Rect {
  px(ctx, x, y, w, h, back)
  for (let i = x; i < x + w; i += 2) px(ctx, i, y, 1, h, bar)
  px(ctx, x, y, w, 1, bar)
  px(ctx, x, y + h - 1, w, 1, bar)
  return { x, y, w, h }
}

export function noren(ctx: Ctx, cx: number, y: number, w: number, h: number, col: string, mark: string): void {
  const strips = 3
  const sw = Math.floor((w - (strips - 1)) / strips)
  for (let i = 0; i < strips; i++) {
    const x = cx - Math.floor(w / 2) + i * (sw + 1)
    px(ctx, x, y, sw, h, col)
    px(ctx, x, y + h - 1, sw, 1, mix(col, '#000000', 0.35))
  }
  ellipse(ctx, cx, y + Math.floor(h / 2), 2, 2, mark)
}

export function stoneBase(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  px(ctx, x, y, w, h, '#77736f')
  for (let i = x; i < x + w; i += 6) {
    px(ctx, i + 1, y + 1, 4, h - 2, hash(i, y, 5) < 0.5 ? '#938f88' : '#a7a29a')
    dot(ctx, i + 1, y + 1, '#b9b4ab')
  }
}

export function namako(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const a = (i + j) % 7 === 0
      const b = (i - j + 700) % 7 === 0
      dot(ctx, x + i, y + j, a || b ? '#e8e4dc' : (i + j) % 2 ? '#3a3e48' : '#444955')
    }
}

export function chochin(ctx: Ctx, x: number, y: number): void {
  px(ctx, x - 1, y - 2, 2, 2, '#2a2233')
  ellipse(ctx, x, y + 3, 3, 4, '#d23c2a')
  ellipse(ctx, x - 1, y + 2, 1, 2, '#f06a50')
  px(ctx, x - 2, y + 7, 4, 1, '#2a2233')
}

// ---------- buildings ----------


export function frame(b: Building, extraTop: number): { W: number; H: number; doorX: number; ctx: Ctx; img: HTMLCanvasElement } {
  const W = b.w * TILE + PAD * 2
  const H = b.h * TILE + extraTop
  const [img, ctx] = canvas(W, H)
  const doorX = (b.door.x - b.x) * TILE + 8 + PAD
  return { W, H, doorX, ctx, img }
}

export function finish(img: HTMLCanvasElement, art: Omit<BuildingArt, 'img' | 'ax' | 'ay'>): BuildingArt {
  grime(img, img.width * 31 + img.height * 7 + art.windows.length)
  mute(img, 0.18)
  outline(img, INK)
  return { img, ax: PAD, ay: img.height, ...art }
}


/** Tiny 3×5 pixel font for signs. */
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  E: ['###', '#..', '##.', '#..', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  K: ['#.#', '##.', '#..', '##.', '#.#'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  S: ['###', '#..', '###', '..#', '###'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  ' ': ['...', '...', '...', '...', '...'],
}

export function pixelText(ctx: Ctx, text: string, x: number, y: number, color: string): void {
  let cx = x
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[' ']
    g.forEach((row, j) => {
      for (let i = 0; i < 3; i++) if (row[i] === '#') dot(ctx, cx + i, y + j, color)
    })
    cx += ch === ' ' ? 3 : 4
  }
}

export function textWidth(text: string): number {
  let w = 0
  for (const ch of text) w += ch === ' ' ? 3 : 4
  return w - 1
}

/** Dark clay-tile roof with flared (upturned) eave corners, used by castles, gates and temples. */
export function flaredRoof(ctx: Ctx, cx: number, top: number, bottom: number, wTop: number, wBottom: number, pal = RF, flare = 3): void {
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top)
    const half = Math.round((wTop + (wBottom - wTop) * t * t) / 2)
    for (let x = cx - half; x <= cx + half; x++) {
      const ch = (x - (cx - half)) % 4
      let k = ch === 0 ? 1 : ch === 1 ? 3 : 2
      if ((y - top) % 5 === 4) k = Math.max(0, k - 1)
      if (x > cx + half * 0.6) k = Math.max(0, k - 1)
      if (y >= bottom - 1) k = y === bottom ? 0 : 4
      dot(ctx, x, y, pal[k])
    }
  }
  // Upturned corners.
  const half = Math.round(wBottom / 2)
  for (let i = 0; i < flare; i++) {
    dot(ctx, cx - half - 1 - i, bottom - 1 - i, pal[0])
    dot(ctx, cx + half + 1 + i, bottom - 1 - i, pal[0])
    dot(ctx, cx - half - 1 - i, bottom - 2 - i, pal[3])
    dot(ctx, cx + half + 1 + i, bottom - 2 - i, pal[3])
  }
}

/** Big irregular river stones (ishigaki), for castle bases, gates and walls. */
export function ishigaki(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 0): void {
  px(ctx, x, y, w, h, '#5e5850')
  for (let j = 0; j < h; j += 4) {
    const off = ((j / 4) % 2) * 3
    for (let i = -off; i < w; i += 6) {
      const sw = 5 + (hash(i + seed, j, 7) < 0.3 ? 1 : 0)
      const c = hash(i + seed, j, 8)
      const col = c < 0.3 ? '#8d877c' : c < 0.7 ? '#9c9587' : '#aca596'
      const x0 = Math.max(x, x + i)
      const x1 = Math.min(x + w, x + i + sw)
      if (x1 > x0) {
        px(ctx, x0, y + j, x1 - x0, 3, col)
        px(ctx, x0, y + j, x1 - x0, 1, '#b8b2a4')
        if (hash(i, j + seed, 9) < 0.15) dot(ctx, x0 + 1, y + j + 2, '#6b8a46')
      }
    }
  }
}

/** White plaster wall band with a black board skirt and optional dark windows. */
export function plasterBand(ctx: Ctx, x: number, y: number, w: number, h: number, windows: number, out?: Rect[]): void {
  px(ctx, x, y, w, h, '#f2eee4')
  px(ctx, x + w - 3, y, 3, h, '#d8d2c4')
  px(ctx, x, y + h - 4, w, 4, '#2a2420')
  for (let i = x + 1; i < x + w; i += 3) dot(ctx, i, y + h - 3, '#3e3630')
  if (windows > 0) {
    const ww = 6
    const gap = (w - windows * ww) / (windows + 1)
    for (let k = 0; k < windows; k++) {
      const wx = Math.round(x + gap + k * (ww + gap))
      const wy = y + 2
      const wh = Math.max(3, h - 9)
      px(ctx, wx, wy, ww, wh, '#2a2420')
      for (let i = wx + 1; i < wx + ww; i += 2) px(ctx, i, wy, 1, wh, '#5a4a3a')
      out?.push({ x: wx, y: wy, w: ww, h: wh })
    }
  }
}
