// The ground layer, painted per pixel once at startup into one big canvas: noisy grass, dirt roads
// with ragged edges, packed earth, raked shrine gravel, water with earthen banks, flooded paddies,
// furrowed fields, plank bridges. Paddy tiles are repainted when seedlings are planted or pulled.

import { canvas, hexRgb, px, type Ctx } from '../engine/pixel'
import { hash, noise, rng } from '../engine/rng'
import { CROP, idx, T, TILE, type World } from '../world/layout'

type RGB = [number, number, number]
const pal = (...hex: string[]): RGB[] => hex.map(hexRgb)

const GRASS = pal('#2c4024', '#3a522c', '#4a6234', '#5a723e', '#6e844c')
const DIRT = pal('#4e3b2a', '#614a34', '#735a40', '#84694c', '#98805e')
const EARTH = pal('#76664f', '#85735a', '#928066', '#a08e74')
const GRAVEL = pal('#9d968b', '#b3ac9f', '#c4bdaf', '#d6d0c2')
const WATER = pal('#244f6c', '#2c5f80', '#377294', '#4e8cae', '#86bfd6', '#cfe8f0')
const BANK = pal('#4d3b27', '#634c31', '#7a603e')
const PADDY = pal('#4c7a77', '#598885', '#679893', '#8cb8ae')
const MUD = pal('#57472f', '#6c5a3c')
const SOIL = pal('#4a2f1c', '#5c3b24', '#704b2e', '#835b39')
const PLANK = pal('#5e3d22', '#86603a', '#9a7046', '#ad8152', '#4a2c17')
const SEA = pal('#163c5a', '#1c4a6c', '#24597e', '#3a7aa0', '#7ab2cc', '#e8f4f6')
const SAND = pal('#bfa574', '#d0b886', '#ddc898', '#e9d9b0', '#a88e60')
const ROCK = pal('#463e37', '#5a5149', '#70665b', '#887d6e', '#a09481', '#2e2823')
const STONE = pal('#5c5850', '#6e6a60', '#7c776c', '#837e72', '#8b8578', '#45413b')
const GRIME = pal('#4a4232', '#3e4a30', '#55493a')

const isRoadish = (t: number) => t === T.Road || t === T.Plaza || t === T.Gravel
const isWetTile = (t: number) => t === T.Water || t === T.Sea || t === T.Moat
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
          case T.Water:
          case T.Moat:
          case T.Sea: {
            const kind = t === T.Sea ? 'sea' : t === T.Moat ? 'moat' : 'water'
            c = water(kind, gx, gy, lx, ly, n, s, wv, e, this.tile(tx - 1, ty - 1), this.tile(tx + 1, ty - 1), this.tile(tx - 1, ty + 1), this.tile(tx + 1, ty + 1))
            break
          }
          case T.Sand: {
            // Round off sandy points where the sea wraps two sides.
            const sea = (k: number) => k === T.Sea
            const R = 7
            const L = TILE - 1
            const out = (cx: number, cy: number) => Math.hypot(lx - cx, ly - cy) > R
            if (
              (sea(n) && sea(wv) && lx < R && ly < R && out(R, R)) ||
              (sea(n) && sea(e) && lx > L - R && ly < R && out(L - R, R)) ||
              (sea(s) && sea(wv) && lx < R && ly > L - R && out(R, L - R)) ||
              (sea(s) && sea(e) && lx > L - R && ly > L - R && out(L - R, L - R))
            ) {
              c = SEA[3]
              break
            }
            const v = noise(gx / 8, gy / 6, 71)
            c = SAND[v < 0.3 ? 1 : v < 0.7 ? 2 : 3]
            // Wind ripples, and darker wet sand at the waterline.
            if ((gy + Math.round(Math.sin(gx / 5) * 1.5)) % 5 === 0 && hash(gx, gy, 72) < 0.6) c = SAND[1]
            const wet = edge((k) => k === T.Sea)
            if (wet < 4) c = wet < 2 ? SAND[4] : SAND[0]
            const g = edge(isGreen)
            if (g < 3 && hash(gx, gy, 73) < (3 - g) * 0.3) c = grass(gx, gy, false)
            break
          }
          case T.Cliff: {
            c = cliff(gx, gy, ly, n, s)
            break
          }
          case T.Stairs: {
            const step = ly & 3
            c = STONE[step === 0 ? 4 : step === 3 ? 0 : 2]
            if (hash(gx, gy, 81) < 0.05) c = STONE[1]
            // Low stone balustrades on the sides.
            const wl = wv !== T.Stairs && lx < 2
            const el = e !== T.Stairs && lx > TILE - 3
            if (wl || el) c = step === 0 ? STONE[3] : STONE[5]
            break
          }
          case T.Stone: {
            c = paving(gx, gy)
            // Quay edge facing the sea or the moat: a cut stone face.
            if (isWetTile(s) && ly > TILE - 4) c = ly === TILE - 1 ? STONE[5] : STONE[0]
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
            if (isWetTile(s) && ly === TILE - 1) c = GRASS[0]
            const sd = edge((k) => k === T.Sand)
            if (sd < 2 && hash(gx, gy, 34) < (2 - sd) * 0.35) c = SAND[2]
          }
        }
        const o = ((oy + ly) * stride + ox + lx) * 4
        data[o] = c[0]
        data[o + 1] = c[1]
        data[o + 2] = c[2]
        data[o + 3] = 255
      }
  }

  /** Muddy puddles on roads (the game draws rain rings on them): centre x, y and half-width. */
  readonly puddles: { x: number; y: number; w: number }[] = []

  private puddle(cx: number, cy: number, w: number, r: () => number): void {
    const ctx = this.ctx
    if (!this.puddles.some((p) => p.x === cx && p.y === cy)) this.puddles.push({ x: cx, y: cy, w })
    const h = Math.max(2, Math.round(w * 0.45))
    for (let y = -h - 1; y <= h + 1; y++)
      for (let x = -w - 1; x <= w + 1; x++) {
        const d = (x * x) / (w * w) + (y * y) / (h * h)
        const wob = (r() - 0.5) * 0.25
        if (d + wob < 0.8) px(ctx, cx + x, cy + y, 1, 1, y < -h / 3 ? '#4c5458' : '#3e4448')
        else if (d + wob < 1.25) px(ctx, cx + x, cy + y, 1, 1, '#3a2c20')
      }
    // A glint of sky.
    px(ctx, cx - Math.floor(w / 2), cy - Math.floor(h / 2), Math.max(2, Math.floor(w / 2)), 1, '#7a868a')
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
        px(ctx, x, y, 1, 2, '#2c4024')
        px(ctx, x - 1, y - 1, 1, 1, '#3a522c')
        px(ctx, x + 1, y - 1, 1, 1, '#3a522c')
        px(ctx, x, y - 1, 1, 1, r() < 0.3 ? '#8a845a' : '#6e844c')
      }
      if (t === T.Grass && r() < 0.03) {
        const colors = ['#d8d4c8', '#c8b048', '#b88890', '#d8d4c8']
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
    } else if (t === T.Sand && r() < 0.07) {
      // Shells and a bit of seaweed.
      const x = x0 + 2 + Math.floor(r() * 12)
      const y = y0 + 2 + Math.floor(r() * 12)
      if (r() < 0.6) {
        px(ctx, x, y, 2, 1, '#f4ece0')
        px(ctx, x, y + 1, 2, 1, '#e0b8a8')
      } else px(ctx, x, y, 3, 1, '#4a6a3a')
    } else if (t === T.Cliff && this.tile(tx, ty - 1) === T.Cliff && r() < 0.12) {
      const x = x0 + 2 + Math.floor(r() * 12)
      const y = y0 + 3 + Math.floor(r() * 10)
      px(ctx, x, y, 2, 1, '#4f8541')
      px(ctx, x + 1, y - 1, 1, 1, '#62994a')
    } else if ((t === T.Road || t === T.Plaza) && hash(tx, ty, 76) < (t === T.Road ? 0.13 : 0.06) && this.tile(tx, ty - 1) === t && this.tile(tx, ty + 1) === t) {
      this.puddle(x0 + 3 + Math.floor(r() * 5), y0 + 5 + Math.floor(r() * 5), 5 + Math.floor(r() * 4), r)
    } else if (t === T.Road && r() < 0.35) {
      // Pebbles, and ruts from the carts.
      const x = x0 + 2 + Math.floor(r() * 12)
      const y = y0 + 2 + Math.floor(r() * 12)
      px(ctx, x, y, 2, 1, '#98805e')
      px(ctx, x, y + 1, 2, 1, '#3e2f22')
      if (r() < 0.4) px(ctx, x0 + Math.floor(r() * 8), y0 + 4 + Math.floor(r() * 9), 5 + Math.floor(r() * 5), 1, '#4e3b2a')
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

function water(
  kind: 'water' | 'moat' | 'sea',
  gx: number,
  gy: number,
  lx: number,
  ly: number,
  n: number,
  s: number,
  w: number,
  e: number,
  nw: number,
  ne: number,
  sw: number,
  se: number,
): RGB {
  const land = (t: number) => !isWetTile(t) && t !== T.Bridge && t !== T.Pier
  const L = TILE - 1
  const P = kind === 'sea' ? SEA : WATER
  const stoneBanks = kind === 'moat' || (kind === 'sea' && (n === T.Stone || n === T.Pier))
  const beach = kind === 'sea' && !stoneBanks
  // Round off convex corners of natural water: where two land sides meet, the corner becomes shore.
  if (beach) {
    const R = 7
    const corner = (cx: number, cy: number) => Math.hypot(lx - cx, ly - cy) > R
    if ((land(n) && land(w) && lx < R && ly < R && corner(R, R)) || (land(n) && land(e) && lx > L - R && ly < R && corner(L - R, R)) || (land(s) && land(w) && lx < R && ly > L - R && corner(R, L - R)) || (land(s) && land(e) && lx > L - R && ly > L - R && corner(L - R, L - R)))
      return SAND[4]
  } else if (!stoneBanks) {
    const R = 6
    const corner = (cx: number, cy: number) => Math.hypot(lx - cx, ly - cy) > R
    if (land(n) && land(w) && lx < R && ly < R + 3 && corner(R, R + 3)) return ly < 4 ? BANK[1] : GRASS[1]
    if (land(n) && land(e) && lx > L - R && ly < R + 3 && corner(L - R, R + 3)) return ly < 4 ? BANK[1] : GRASS[1]
    if (land(s) && land(w) && lx < R && ly > L - R && corner(R, L - R)) return GRASS[2]
    if (land(s) && land(e) && lx > L - R && ly > L - R && corner(L - R, L - R)) return GRASS[2]
  }
  // The north bank shows its face (we look at the scene from slightly south): earth, or cut stone
  // for the moat and the quay.
  const faceH = beach ? 0 : stoneBanks ? 6 : 4 + Math.round((noise(gx / 5, 3, 14) - 0.5) * 2)
  if (land(n) && ly < faceH) {
    if (stoneBanks) {
      const course = Math.floor(ly / 3)
      const joint = (gx + course * 4) % 8 === 0 || ly % 3 === 2
      if (ly === faceH - 1) return STONE[5]
      return joint ? STONE[0] : hash(gx >> 3, course, 15) < 0.5 ? STONE[2] : STONE[1]
    }
    if (ly === 0) return GRASS[1]
    return BANK[ly === 1 ? 2 : ly === 2 ? 1 : 0]
  }
  let d = Math.min(land(n) ? ly - faceH : 99, land(s) ? L - ly : 99, land(w) ? lx : 99, land(e) ? L - lx : 99)
  if (land(nw) && !land(n) && !land(w)) d = Math.min(d, Math.hypot(lx, ly))
  if (land(ne) && !land(n) && !land(e)) d = Math.min(d, Math.hypot(L - lx, ly))
  if (land(sw) && !land(s) && !land(w)) d = Math.min(d, Math.hypot(lx, L - ly))
  if (land(se) && !land(s) && !land(e)) d = Math.min(d, Math.hypot(L - lx, L - ly))
  if (stoneBanks && d < 1.5) return STONE[0]
  d += (noise(gx / 4, gy / 4, 13) - 0.5) * 2.2
  if (d < 1) return P[5]
  if (d < 2.5) return P[4]
  if (d < 5) return P[3]
  const v = noise(gx / 13, gy / 9, 9)
  let k = v < 0.4 ? 1 : 2
  if (kind === 'sea') {
    // Deeper further out; long swells.
    const swell = Math.sin(gy / 5 + Math.sin(gx / 23) * 2)
    k = swell > 0.75 ? 2 : v < 0.45 ? 0 : 1
  }
  if (hash(gx >> 2, gy, 10) > 0.975) k = 3
  if (hash(gx, gy, 11) < 0.02) k = 0
  return P[k]
}

function cliff(gx: number, gy: number, ly: number, n: number, s: number): RGB {
  // Grass lip at the top, a dark foot at the bottom, layered rock in between.
  if (n !== T.Cliff) {
    const lip = 3 + Math.round(noise(gx / 3, 0, 91) * 2)
    if (ly < lip) return ly === lip - 1 ? GRASS[0] : grass(gx, gy, false)
  }
  if (s !== T.Cliff && ly > TILE - 3) return ROCK[5]
  const band = Math.floor((gy + noise(gx / 9, gy / 20, 92) * 6) / 5)
  const inBand = (gy + Math.floor(noise(gx / 9, gy / 20, 92) * 6)) % 5
  let k = band % 3 === 0 ? 2 : band % 3 === 1 ? 3 : 1
  if (inBand === 0) k = 4
  if (inBand === 4) k = 0
  if (hash(gx >> 1, band, 93) < 0.06) k = 0 // cracks
  if (hash(gx, gy, 94) < 0.04) return GRASS[1] // a tuft clinging on
  return ROCK[k]
}

function paving(gx: number, gy: number): RGB {
  // Flagstones, 12×8 in staggered courses, low contrast so a big square stays calm.
  const row = Math.floor(gy / 8)
  const off = row % 2 ? 6 : 0
  const col = Math.floor((gx + off) / 12)
  const lx = (gx + off) % 12
  const ly = gy % 8
  if (ly === 7 || lx === 11) {
    // Joints full of mud and moss.
    const j = hash(gx, gy, 98)
    return j < 0.3 ? GRIME[1] : j < 0.6 ? GRIME[0] : STONE[0]
  }
  const h = hash(col, row, 95)
  let k = h < 0.35 ? 2 : h < 0.8 ? 3 : 4
  if (ly === 0 && k < 4) k++
  const v = noise(gx / 5, gy / 5, 97)
  if (v < 0.22) k = Math.max(2, k - 1)
  if (hash(gx, gy, 96) < 0.02) k = 1
  // Big soft stains of mud trodden in from the roads.
  const m = noise(gx / 14, gy / 14, 99)
  if (m > 0.7 && hash(gx, gy, 100) < (m - 0.7) * 3) return GRIME[2]
  return STONE[k]
}
