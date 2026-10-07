// The ground layer, painted per pixel once at startup into one big canvas: noisy grass, dirt roads
// with ragged edges, packed earth, raked shrine gravel, water with earthen banks, flooded paddies,
// furrowed fields, plank bridges. Paddy tiles are repainted when seedlings are planted or pulled.

import { canvas, hexRgb, px, type Ctx } from '../engine/pixel'
import { hash, noise, rng } from '../engine/rng'
import { CROP, idx, T, TILE, type World } from '../world/layout'

type RGB = [number, number, number]
const pal = (...hex: string[]): RGB[] => hex.map(hexRgb)

const GRASS = pal('#2f5a2e', '#40733a', '#4f8541', '#62994a', '#7cb05a')
const DIRT = pal('#6b4d33', '#876546', '#9c7a52', '#ae8c61', '#c4a276')
const EARTH = pal('#957c5c', '#a98f6c', '#b79e79', '#c6ae88')
const GRAVEL = pal('#9d968b', '#b3ac9f', '#c4bdaf', '#d6d0c2')
const WATER = pal('#244f6c', '#2c5f80', '#377294', '#4e8cae', '#86bfd6', '#cfe8f0')
const BANK = pal('#4d3b27', '#634c31', '#7a603e')
const PADDY = pal('#4c7a77', '#598885', '#679893', '#8cb8ae')
const MUD = pal('#57472f', '#6c5a3c')
const SOIL = pal('#4a2f1c', '#5c3b24', '#704b2e', '#835b39')
const PLANK = pal('#5e3d22', '#86603a', '#9a7046', '#ad8152', '#4a2c17')

const isRoadish = (t: number) => t === T.Road || t === T.Plaza || t === T.Gravel
const isGreen = (t: number) => t === T.Grass || t === T.Forest

export class Ground {
  readonly canvas: HTMLCanvasElement
  private ctx: Ctx
  private world: World

  constructor(world: World) {
    this.world = world
    const [c, ctx] = canvas(world.w * TILE, world.h * TILE)
    this.canvas = c
    this.ctx = ctx
    const img = ctx.createImageData(c.width, c.height)
    for (let ty = 0; ty < world.h; ty++) for (let tx = 0; tx < world.w; tx++) this.paintBase(img.data, c.width, tx, ty, tx * TILE, ty * TILE)
    ctx.putImageData(img, 0, 0)
    for (let ty = 0; ty < world.h; ty++) for (let tx = 0; tx < world.w; tx++) this.paintDecor(tx, ty)
  }

  /** Repaint one tile (paddy planting). */
  repaint(tx: number, ty: number): void {
    const img = this.ctx.createImageData(TILE, TILE)
    this.paintBase(img.data, TILE, tx, ty, 0, 0)
    this.ctx.putImageData(img, tx * TILE, ty * TILE)
    this.paintDecor(tx, ty)
  }

  private tile(x: number, y: number): number {
    const w = this.world
    if (x < 0 || y < 0 || x >= w.w || y >= w.h) return T.Forest
    return w.tiles[idx(x, y)]
  }

  /** Writes the 16×16 base pixels of tile (tx, ty) into `data` at (ox, oy). */
  private paintBase(data: Uint8ClampedArray, stride: number, tx: number, ty: number, ox: number, oy: number): void {
    const t = this.tile(tx, ty)
    const n = this.tile(tx, ty - 1)
    const s = this.tile(tx, ty + 1)
    const wv = this.tile(tx - 1, ty)
    const e = this.tile(tx + 1, ty)
    for (let ly = 0; ly < TILE; ly++)
      for (let lx = 0; lx < TILE; lx++) {
        const gx = tx * TILE + lx
        const gy = ty * TILE + ly
        // Distance (px) to the edge facing a neighbour that matches `pred`.
        const edge = (pred: (t: number) => boolean) =>
          Math.min(pred(n) ? ly : 99, pred(s) ? TILE - 1 - ly : 99, pred(wv) ? lx : 99, pred(e) ? TILE - 1 - lx : 99)
        let c: RGB
        switch (t) {
          case T.Road:
          case T.Plaza:
          case T.Gravel: {
            const d = edge(isGreen)
            if (d < 3 && hash(gx, gy, 31) < (3 - d) * 0.28) {
              c = grass(gx, gy, false)
              break
            }
            c = t === T.Road ? dirt(gx, gy) : t === T.Plaza ? earth(gx, gy) : gravel(gx, gy)
            break
          }
          case T.Water: {
            c = water(gx, gy, lx, ly, n, s, wv, e, this.tile(tx - 1, ty - 1), this.tile(tx + 1, ty - 1), this.tile(tx - 1, ty + 1), this.tile(tx + 1, ty + 1))
            break
          }
          case T.Paddy: {
            const d = edge((k) => k !== T.Paddy)
            if (d < 1) c = MUD[0]
            else if (d < 2) c = MUD[1]
            else {
              const v = noise(gx / 7, gy / 5, 41)
              c = PADDY[v < 0.35 ? 0 : v < 0.7 ? 1 : 2]
              if (hash(gx >> 2, gy, 42) > 0.93) c = PADDY[3]
            }
            break
          }
          case T.Field: {
            const d = edge(isGreen)
            if (d < 2 && hash(gx, gy, 51) < (2 - d) * 0.4) {
              c = grass(gx, gy, false)
              break
            }
            const row = gy & 3
            c = SOIL[row === 0 ? 3 : row === 1 ? 2 : row === 2 ? 1 : 0]
            if (hash(gx, gy, 52) < 0.06) c = SOIL[Math.min(3, (row === 3 ? 1 : 2) + 1)]
            break
          }
          case T.Bridge:
          case T.Pier: {
            const rail = t === T.Bridge
            if (rail && n !== T.Bridge && ly < 3) {
              c = ly === 0 ? PLANK[2] : PLANK[0]
              if ((lx & 7) < 2) c = ly === 0 ? PLANK[3] : PLANK[4]
            } else if (s !== t && ly > TILE - 3) {
              c = ly === TILE - 1 ? PLANK[4] : PLANK[0]
            } else if (lx % 4 === 3) c = PLANK[0]
            else {
              const shade = hash(gx >> 2, ty, 61)
              c = PLANK[shade < 0.3 ? 1 : shade < 0.75 ? 2 : 3]
              if (hash(gx, gy, 62) < 0.04) c = PLANK[1]
            }
            break
          }
          case T.Forest:
            c = grass(gx, gy, true)
            break
          default: {
            c = grass(gx, gy, false)
            // A few dirt crumbs where grass meets a road, and a dark lip above water.
            const d = edge(isRoadish)
            if (d < 1 && hash(gx, gy, 33) < 0.35) c = t === T.Grass && (n === T.Gravel || s === T.Gravel) ? GRAVEL[1] : DIRT[2]
            if (s === T.Water && ly === TILE - 1) c = GRASS[0]
          }
        }
        const o = ((oy + ly) * stride + ox + lx) * 4
        data[o] = c[0]
        data[o + 1] = c[1]
        data[o + 2] = c[2]
        data[o + 3] = 255
      }
  }

  private paintDecor(tx: number, ty: number): void {
    const ctx = this.ctx
    const t = this.tile(tx, ty)
    const x0 = tx * TILE
    const y0 = ty * TILE
    const r = rng(Math.floor(hash(tx, ty, 77) * 1e9))
    if (t === T.Grass || t === T.Forest) {
      const tufts = t === T.Forest ? 3 : r() < 0.6 ? 1 : 2
      for (let i = 0; i < tufts; i++) {
        const x = x0 + 2 + Math.floor(r() * 11)
        const y = y0 + 3 + Math.floor(r() * 11)
        px(ctx, x, y, 1, 2, '#2f5a2e')
        px(ctx, x - 1, y - 1, 1, 1, '#40733a')
        px(ctx, x + 1, y - 1, 1, 1, '#40733a')
        px(ctx, x, y - 1, 1, 1, '#7cb05a')
      }
      if (t === T.Grass && r() < 0.09) {
        const colors = ['#f4f1ea', '#f2d04a', '#f0a0b8', '#a8b8f4', '#f4f1ea']
        const n = 1 + Math.floor(r() * 3)
        const col = colors[Math.floor(r() * colors.length)]
        for (let i = 0; i < n; i++) {
          const x = x0 + 2 + Math.floor(r() * 12)
          const y = y0 + 2 + Math.floor(r() * 12)
          px(ctx, x - 1, y, 3, 1, col)
          px(ctx, x, y - 1, 1, 3, col)
          px(ctx, x, y, 1, 1, col === '#f2d04a' ? '#c98a2a' : '#f2d04a')
        }
      }
    } else if (t === T.Road && r() < 0.25) {
      // Pebbles.
      const x = x0 + 2 + Math.floor(r() * 12)
      const y = y0 + 2 + Math.floor(r() * 12)
      px(ctx, x, y, 2, 1, '#c4a276')
      px(ctx, x, y + 1, 2, 1, '#6b4d33')
    } else if (t === T.Plaza && hash(tx, ty, 78) < 0.12) {
      // A flat stepping stone set into the earth.
      const x = x0 + 3 + Math.floor(r() * 6)
      const y = y0 + 4 + Math.floor(r() * 6)
      px(ctx, x, y, 6, 4, '#a39c90')
      px(ctx, x + 1, y, 4, 1, '#bcb5a8')
      px(ctx, x, y + 4, 6, 1, '#7e776c')
    } else if (t === T.Paddy && this.world.planted[idx(tx, ty)]) {
      // Seedlings in neat rows; a few wobbly ones (Gonbei's).
      for (let y = y0 + 3; y < y0 + TILE - 1; y += 4)
        for (let x = x0 + 2; x < x0 + TILE - 1; x += 4) {
          const wob = hash(x, y, 79) < 0.15 ? 1 : 0
          px(ctx, x + wob, y - 2, 1, 2, '#86c45a')
          px(ctx, x + wob - 1, y - 1, 1, 1, '#5f9a3a')
          px(ctx, x + wob + 1, y - 1, 1, 1, '#5f9a3a')
          px(ctx, x + wob, y, 1, 1, '#3f6a3a')
        }
    } else if (t === T.Field) {
      const crop = this.world.crops[idx(tx, ty)]
      // Only on full tiles, along ridge rows (every 4px).
      for (let y = y0 + 1; y < y0 + TILE; y += 4)
        for (let x = x0 + 2; x < x0 + TILE - 1; x += crop === CROP.cabbage ? 7 : 5) drawCrop(ctx, crop, x, y, r)
    }
  }
}

function drawCrop(ctx: Ctx, crop: number, x: number, y: number, r: () => number): void {
  switch (crop) {
    case CROP.daikon:
      px(ctx, x, y - 2, 3, 2, '#5f9a3a')
      px(ctx, x - 1, y - 1, 1, 1, '#7cb05a')
      px(ctx, x + 3, y - 1, 1, 1, '#7cb05a')
      px(ctx, x + 1, y - 3, 1, 1, '#86c45a')
      px(ctx, x + 1, y, 1, 1, '#f4f1ea')
      break
    case CROP.cabbage:
      if ((y & 7) !== 1) return
      px(ctx, x - 1, y - 2, 5, 3, '#8fc06a')
      px(ctx, x, y - 3, 3, 1, '#a8d482')
      px(ctx, x, y - 2, 3, 2, '#c4e2a0')
      px(ctx, x - 1, y + 1, 5, 1, '#4f7f3a')
      break
    case CROP.eggplant:
      px(ctx, x, y - 3, 2, 3, '#4f8a3a')
      px(ctx, x - 1, y - 2, 1, 1, '#68a548')
      if (r() < 0.6) px(ctx, x + 2, y - 1, 1, 2, '#5a2f6a')
      break
    case CROP.cucumber:
      // Bamboo trellis with vines.
      px(ctx, x + 1, y - 6, 1, 7, '#b59a5a')
      px(ctx, x, y - 5, 3, 1, '#4f8a3a')
      px(ctx, x - 1, y - 3, 2, 2, '#68a548')
      px(ctx, x + 2, y - 2, 2, 2, '#4f8a3a')
      if (r() < 0.5) px(ctx, x + 2, y - 4, 1, 2, '#3f7a2a')
      break
  }
}

function grass(gx: number, gy: number, forest: boolean): RGB {
  const v = noise(gx / 19, gy / 19, 1) * 0.65 + noise(gx / 6, gy / 6, 2) * 0.35
  let k = v < 0.36 ? 1 : v < 0.62 ? 2 : 3
  if (forest) k = Math.max(0, k - 1)
  const h = hash(gx, gy, 3)
  if (h < 0.05) k = Math.max(0, k - 1)
  else if (h > 0.97) k = Math.min(4, k + 1)
  return GRASS[k]
}

function dirt(gx: number, gy: number): RGB {
  const v = noise(gx / 9, gy / 9, 4)
  let k = v < 0.32 ? 1 : v < 0.7 ? 2 : 3
  const h = hash(gx, gy, 5)
  if (h < 0.025) k = 4
  else if (h > 0.985) k = 0
  return DIRT[k]
}

function earth(gx: number, gy: number): RGB {
  const v = noise(gx / 11, gy / 11, 6)
  let k = v < 0.3 ? 1 : v < 0.72 ? 2 : 3
  if (hash(gx, gy, 7) < 0.04) k = 0
  return EARTH[k]
}

function gravel(gx: number, gy: number): RGB {
  const h = hash(gx, gy, 8)
  let k = h < 0.25 ? 1 : h < 0.8 ? 2 : 3
  // Raked lines, gently wavy.
  if ((gy + Math.round(Math.sin(gx / 9) * 1.2)) % 4 === 0) k = Math.max(0, k - 1)
  return GRAVEL[k]
}

function water(gx: number, gy: number, lx: number, ly: number, n: number, s: number, w: number, e: number, nw: number, ne: number, sw: number, se: number): RGB {
  const land = (t: number) => t !== T.Water && t !== T.Bridge && t !== T.Pier
  const L = TILE - 1
  // Round off convex corners: where two land sides meet, the corner pixels become bank.
  const R = 6
  const corner = (cx: number, cy: number) => Math.hypot(lx - cx, ly - cy) > R
  if (land(n) && land(w) && lx < R && ly < R + 3 && corner(R, R + 3)) return ly < 4 ? BANK[1] : GRASS[1]
  if (land(n) && land(e) && lx > L - R && ly < R + 3 && corner(L - R, R + 3)) return ly < 4 ? BANK[1] : GRASS[1]
  if (land(s) && land(w) && lx < R && ly > L - R && corner(R, L - R)) return GRASS[2]
  if (land(s) && land(e) && lx > L - R && ly > L - R && corner(L - R, L - R)) return GRASS[2]
  // The north bank shows its earthen face (we look at the scene from slightly south).
  const wob = Math.round((noise(gx / 5, 3, 14) - 0.5) * 2)
  if (land(n) && ly < 4 + wob) {
    if (ly === 0) return GRASS[1]
    return BANK[ly === 1 ? 2 : ly === 2 ? 1 : 0]
  }
  let d = Math.min(land(n) ? ly - 4 : 99, land(s) ? L - ly : 99, land(w) ? lx : 99, land(e) ? L - lx : 99)
  // Diagonal land: distance to that corner.
  if (land(nw) && !land(n) && !land(w)) d = Math.min(d, Math.hypot(lx, ly))
  if (land(ne) && !land(n) && !land(e)) d = Math.min(d, Math.hypot(L - lx, ly))
  if (land(sw) && !land(s) && !land(w)) d = Math.min(d, Math.hypot(lx, L - ly))
  if (land(se) && !land(s) && !land(e)) d = Math.min(d, Math.hypot(L - lx, L - ly))
  d += (noise(gx / 4, gy / 4, 13) - 0.5) * 2.2
  if (d < 1) return WATER[5]
  if (d < 2.5) return WATER[4]
  if (d < 5) return WATER[3]
  const v = noise(gx / 13, gy / 9, 9)
  let k = v < 0.4 ? 1 : 2
  if (hash(gx >> 2, gy, 10) > 0.975) k = 3
  if (hash(gx, gy, 11) < 0.02) k = 0
  return WATER[k]
}
