// Buildings, drawn front-on in the slightly-from-above view: a big roof (thatch, clay tile, cypress
// bark or boards) over a facade with posts, shoji, lattice and doorways. Each art function also
// reports where its windows and lanterns are so the night lighting can make them glow.

import { canvas, dot, ellipse, mix, outline, px, type Ctx } from '../engine/pixel'
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
  lamps: { x: number; y: number; r: number; color: string }[]
  chimney?: { x: number; y: number }
}

const INK = '#1a1220'
const TH = ['#5a3e1e', '#7c5c2c', '#9e7c3c', '#bc9850', '#d8b86c']
const TH_OLD = ['#4a3a20', '#665230', '#82703e', '#9c8a50', '#b4a266']
const RF = ['#2c323e', '#3c4453', '#4f5a6c', '#67748c', '#8792aa']
const DARKWOOD = '#3d2615'
const WOODM = '#6a4426'
const WOODL = '#8f6038'
const PLASTER = '#e8dec6'
const PLASTER_D = '#cbbf9f'

const PAD = 2

// ---------- roofs ----------

function trapezoid(top: number, bottom: number, x0: number, x1: number, inset: number, y: number): [number, number] {
  const t = (y - top) / Math.max(1, bottom - top)
  return [Math.round(x0 + inset * (1 - t)), Math.round(x1 - inset * (1 - t))]
}

function thatchRoof(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, inset: number, seed: number, old = false): void {
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

function ridgeCap(ctx: Ctx, l: number, r: number, y: number, dark = '#3a2716', light = '#5e4528'): void {
  px(ctx, l, y, r - l, 7, dark)
  px(ctx, l, y, r - l, 1, light)
  for (let x = l + 4; x < r - 4; x += 10) {
    px(ctx, x, y - 2, 3, 9, '#24180c')
    dot(ctx, x, y - 2, '#4a3220')
  }
}

function tileRoof(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, inset: number, pal = RF): void {
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

function boardRoof(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, inset: number): void {
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
function roofStones(ctx: Ctx, l: number, r: number, y: number): void {
  for (let x = l + 4; x < r - 4; x += 9) {
    ellipse(ctx, x, y, 3, 2, '#8d8983')
    dot(ctx, x - 1, y - 1, '#b0aba2')
  }
}

// ---------- facade pieces ----------

function post(ctx: Ctx, x: number, y: number, h: number): void {
  px(ctx, x, y, 3, h, DARKWOOD)
  px(ctx, x, y, 1, h, '#5a3a22')
}

function shoji(ctx: Ctx, x: number, y: number, w: number, h: number): Rect {
  px(ctx, x, y, w, h, '#5a3a22')
  px(ctx, x + 1, y + 1, w - 2, h - 2, '#f2ead4')
  for (let i = x + 4; i < x + w - 1; i += 4) px(ctx, i, y + 1, 1, h - 2, '#b9a888')
  for (let j = y + 4; j < y + h - 1; j += 4) px(ctx, x + 1, j, w - 2, 1, '#b9a888')
  return { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }
}

function planks(ctx: Ctx, x: number, y: number, w: number, h: number, base = WOODM, line = '#4a2e1a'): void {
  px(ctx, x, y, w, h, base)
  for (let j = y + 3; j < y + h; j += 4) px(ctx, x, j, w, 1, line)
}

function lattice(ctx: Ctx, x: number, y: number, w: number, h: number, bar: string, back: string): Rect {
  px(ctx, x, y, w, h, back)
  for (let i = x; i < x + w; i += 2) px(ctx, i, y, 1, h, bar)
  px(ctx, x, y, w, 1, bar)
  px(ctx, x, y + h - 1, w, 1, bar)
  return { x, y, w, h }
}

function noren(ctx: Ctx, cx: number, y: number, w: number, h: number, col: string, mark: string): void {
  const strips = 3
  const sw = Math.floor((w - (strips - 1)) / strips)
  for (let i = 0; i < strips; i++) {
    const x = cx - Math.floor(w / 2) + i * (sw + 1)
    px(ctx, x, y, sw, h, col)
    px(ctx, x, y + h - 1, sw, 1, mix(col, '#000000', 0.35))
  }
  ellipse(ctx, cx, y + Math.floor(h / 2), 2, 2, mark)
}

function stoneBase(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  px(ctx, x, y, w, h, '#77736f')
  for (let i = x; i < x + w; i += 6) {
    px(ctx, i + 1, y + 1, 4, h - 2, hash(i, y, 5) < 0.5 ? '#938f88' : '#a7a29a')
    dot(ctx, i + 1, y + 1, '#b9b4ab')
  }
}

function namako(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const a = (i + j) % 7 === 0
      const b = (i - j + 700) % 7 === 0
      dot(ctx, x + i, y + j, a || b ? '#e8e4dc' : (i + j) % 2 ? '#3a3e48' : '#444955')
    }
}

function chochin(ctx: Ctx, x: number, y: number): void {
  px(ctx, x - 1, y - 2, 2, 2, '#2a2233')
  ellipse(ctx, x, y + 3, 3, 4, '#d23c2a')
  ellipse(ctx, x - 1, y + 2, 1, 2, '#f06a50')
  px(ctx, x - 2, y + 7, 4, 1, '#2a2233')
}

// ---------- buildings ----------

export function buildingArt(b: Building): BuildingArt {
  switch (b.kind) {
    case 'minka':
    case 'minkaOld':
    case 'cottage':
      return minka(b, b.kind === 'minkaOld')
    case 'machiya':
      return machiya(b)
    case 'teahouse':
      return teahouse(b)
    case 'brewery':
      return brewery(b)
    case 'kura':
      return kura(b)
    case 'shrine':
      return shrine(b)
    case 'hut':
    case 'fishhut':
      return hut(b, b.kind === 'fishhut')
    case 'guardpost':
      return guardpost(b)
    case 'coop':
      return coop(b)
  }
}

function frame(b: Building, extraTop: number): { W: number; H: number; doorX: number; ctx: Ctx; img: HTMLCanvasElement } {
  const W = b.w * TILE + PAD * 2
  const H = b.h * TILE + extraTop
  const [img, ctx] = canvas(W, H)
  const doorX = (b.door.x - b.x) * TILE + 8 + PAD
  return { W, H, doorX, ctx, img }
}

function finish(img: HTMLCanvasElement, art: Omit<BuildingArt, 'img' | 'ax' | 'ay'>): BuildingArt {
  outline(img, INK)
  return { img, ax: PAD, ay: img.height, ...art }
}

function minka(b: Building, old: boolean): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 18)
  const eave = H - 30
  const windows: Rect[] = []
  // Facade first; the roof's shadow and eave overlap its top.
  const wallTop = eave - 1
  const wallBottom = H - 8
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, PLASTER)
  for (let x = PAD + 1; x < W - PAD - 3; x += TILE) {
    const panelX = x + 3
    const panelW = TILE - 3
    const isDoor = doorX >= x && doorX < x + TILE
    if (isDoor) {
      px(ctx, doorX - 6, wallTop + 3, 13, wallBottom - wallTop - 3, '#1e1612')
      windows.push({ x: doorX - 5, y: wallTop + 10, w: 11, h: wallBottom - wallTop - 10 })
      noren(ctx, doorX, wallTop + 3, 13, 8, old ? '#5a3a6a' : '#2f3f73', '#f4f1ea')
    } else if (hash(x, b.y, 3) < 0.55) windows.push(shoji(ctx, panelX + 1, wallTop + 5, panelW - 2, 12))
    else planks(ctx, panelX, wallTop + 2, panelW, wallBottom - wallTop - 2)
    post(ctx, x, wallTop, wallBottom - wallTop)
  }
  post(ctx, W - PAD - 4, wallTop, wallBottom - wallTop)
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 3, '#2a1c10')
  // Engawa veranda and stone footing.
  px(ctx, PAD, wallBottom, W - PAD * 2, 3, WOODL)
  px(ctx, PAD, wallBottom, W - PAD * 2, 1, '#b07e4c')
  stoneBase(ctx, PAD, H - 5, W - PAD * 2, 5)
  // Roof.
  const top = 13
  thatchRoof(ctx, 0, W - 1, top, eave, 16, b.x * 31 + b.y, old)
  const [l, r] = trapezoid(top, eave, 0, W - 1, 16, top)
  ridgeCap(ctx, l - 2, r + 3, top - 6)
  // Smoke hole gable at the ridge centre.
  const cx = Math.round(W / 2)
  px(ctx, cx - 5, top - 2, 10, 6, '#2a1c10')
  for (let i = cx - 4; i < cx + 4; i += 2) px(ctx, i, top - 1, 1, 4, '#5e4528')
  return finish(img, { windows, lamps: [], chimney: { x: cx, y: top - 4 } })
}

function machiya(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 16)
  const windows: Rect[] = []
  const roofBottom = 38
  // Upper floor: plaster with mushiko slit window.
  px(ctx, PAD + 2, roofBottom, W - PAD * 2 - 4, 18, PLASTER)
  px(ctx, PAD + 2, roofBottom, W - PAD * 2 - 4, 2, PLASTER_D)
  const mx = Math.round(W / 2) - 16
  px(ctx, mx, roofBottom + 5, 32, 9, '#5a5248')
  for (let i = mx + 1; i < mx + 31; i += 3) px(ctx, i, roofBottom + 6, 2, 7, '#2a2420')
  windows.push({ x: mx + 1, y: roofBottom + 6, w: 30, h: 7 })
  // Little eave over the ground floor.
  tileRoof(ctx, 0, W - 1, roofBottom + 20, roofBottom + 26, 2)
  // Ground floor: red-brown koshi lattice with the door.
  const gTop = roofBottom + 27
  const gBottom = H - 4
  windows.push(lattice(ctx, PAD + 2, gTop, W - PAD * 2 - 4, gBottom - gTop, '#5a2f22', '#2a1a14'))
  px(ctx, doorX - 7, gTop, 14, gBottom - gTop, '#1e1612')
  noren(ctx, doorX, gTop, 14, 9, '#2f3f73', '#f4f1ea')
  for (const x of [PAD + 1, W - PAD - 4]) post(ctx, x, roofBottom, gBottom - roofBottom)
  stoneBase(ctx, PAD, H - 4, W - PAD * 2, 4)
  tileRoof(ctx, 0, W - 1, 10, roofBottom, 12)
  return finish(img, { windows, lamps: [] })
}

function teahouse(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 16)
  const windows: Rect[] = []
  const eave = H - 36
  const wallTop = eave - 1
  const wallBottom = H - 5
  // Walls: dark charred cedar below, plaster above.
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, PLASTER)
  px(ctx, PAD + 1, wallTop + 18, W - PAD * 2 - 2, wallBottom - wallTop - 18, '#2e2622')
  for (let x = PAD + 1; x < W - PAD; x += 3) px(ctx, x, wallTop + 18, 1, wallBottom - wallTop - 18, '#3e342e')
  // Open shop front: counter, cups on a shelf, red noren.
  const ox = doorX - 16
  px(ctx, ox, wallTop + 3, 33, wallBottom - wallTop - 3, '#241a14')
  windows.push({ x: ox + 1, y: wallTop + 10, w: 31, h: 12 })
  px(ctx, ox + 2, wallTop + 14, 29, 1, WOODL)
  for (let i = ox + 4; i < ox + 30; i += 5) {
    px(ctx, i, wallTop + 12, 3, 2, '#e8e0cc')
    dot(ctx, i + 1, wallTop + 12, '#5a8a5a')
  }
  px(ctx, ox, wallBottom - 7, 33, 7, WOODM) // counter
  px(ctx, ox, wallBottom - 7, 33, 1, '#b07e4c')
  px(ctx, ox + 3, wallBottom - 9, 4, 2, '#f4f1ea') // a teacup and a dango plate
  px(ctx, ox + 22, wallBottom - 9, 7, 1, '#f4f1ea')
  for (const [i, c] of [
    [23, '#f0a0b8'],
    [25, '#f4f1ea'],
    [27, '#8fc06a'],
  ] as const)
    dot(ctx, ox + i, wallBottom - 10, c)
  noren(ctx, doorX, wallTop + 3, 33, 9, '#c0262f', '#f4f1ea')
  // Round window on the right.
  const rx = W - 22
  ellipse(ctx, rx, wallTop + 10, 7, 7, '#5a3a22')
  ellipse(ctx, rx, wallTop + 10, 6, 6, '#f2ead4')
  for (let i = -5; i <= 5; i += 3) px(ctx, rx + i, wallTop + 4, 1, 12, '#b9a888')
  windows.push({ x: rx - 4, y: wallTop + 6, w: 8, h: 8 })
  // Left lattice window.
  windows.push(lattice(ctx, PAD + 6, wallTop + 5, 16, 10, '#5a3a22', '#f2ead4'))
  for (const x of [PAD + 1, ox - 3, ox + 33, W - PAD - 4]) post(ctx, x, wallTop, wallBottom - wallTop)
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 2, '#2a1c10')
  stoneBase(ctx, PAD, H - 5, W - PAD * 2, 5)
  tileRoof(ctx, 0, W - 1, 12, eave, 14)
  // Paper lanterns at the eave corners.
  const lamps = [
    { x: 10, y: eave + 4, r: 30, color: '#ff8a5a' },
    { x: W - 10, y: eave + 4, r: 30, color: '#ff8a5a' },
  ]
  for (const l of lamps) chochin(ctx, l.x, l.y)
  return finish(img, { windows, lamps: lamps.map((l) => ({ ...l, y: l.y + 3 })), chimney: { x: W - 30, y: 16 } })
}

function brewery(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 18)
  const windows: Rect[] = []
  const eave = H - 46
  const wallTop = eave - 1
  const wallBottom = H - 3
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, '#f0eadc')
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 3, '#2a1c10')
  namako(ctx, PAD + 1, wallTop + 24, W - PAD * 2 - 2, wallBottom - wallTop - 24)
  // High barred windows.
  for (const x of [PAD + 10, W - PAD - 26, PAD + 30]) {
    if (Math.abs(x + 8 - doorX) < 22) continue
    px(ctx, x, wallTop + 7, 16, 9, '#2a2420')
    for (let i = x + 1; i < x + 16; i += 3) px(ctx, i, wallTop + 7, 1, 9, '#6a4426')
    windows.push({ x, y: wallTop + 7, w: 16, h: 9 })
  }
  // Big door with iron studs.
  px(ctx, doorX - 12, wallTop + 10, 24, wallBottom - wallTop - 10, '#3a2414')
  for (let i = doorX - 11; i < doorX + 12; i += 4) px(ctx, i, wallTop + 11, 1, wallBottom - wallTop - 11, '#5a3a22')
  for (let j = wallTop + 14; j < wallBottom; j += 8) for (let i = doorX - 10; i < doorX + 11; i += 5) dot(ctx, i, j, '#a39cb0')
  px(ctx, doorX - 13, wallTop + 9, 26, 2, DARKWOOD)
  // Signboard above the door.
  px(ctx, doorX - 15, wallTop + 2, 30, 6, '#7a5232')
  px(ctx, doorX - 14, wallTop + 3, 28, 4, '#a87a46')
  for (const i of [-10, -3, 4]) px(ctx, doorX + i, wallTop + 4, 4, 2, '#2a1c10')
  // Sugidama: the cedar ball that says "new sake is ready".
  const sx = doorX + 22
  px(ctx, sx, wallTop - 1, 1, 4, '#c9b58a')
  ellipse(ctx, sx, wallTop + 9, 6, 6, '#3f6a32')
  ellipse(ctx, sx - 1, wallTop + 8, 4.5, 4.5, '#56883e')
  for (let i = 0; i < 9; i++) dot(ctx, sx - 4 + ((i * 5) % 9), wallTop + 5 + ((i * 3) % 8), '#2f5426')
  dot(ctx, sx - 2, wallTop + 6, '#7cb05a')
  for (const x of [PAD + 1, W - PAD - 4]) post(ctx, x, wallTop, wallBottom - wallTop)
  tileRoof(ctx, 0, W - 1, 12, eave, 18)
  return finish(img, { windows, lamps: [{ x: doorX, y: wallTop + 4, r: 26, color: '#ffb060' }], chimney: { x: Math.round(W * 0.3), y: 14 } })
}

function kura(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 14)
  const eave = 36
  px(ctx, PAD + 2, eave, W - PAD * 2 - 4, H - eave - 2, '#f4f0e6')
  px(ctx, W - PAD - 6, eave, 4, H - eave - 2, '#d8d0bc')
  namako(ctx, PAD + 2, H - 26, W - PAD * 2 - 4, 24)
  // Heavy fireproof doors and the house crest.
  px(ctx, doorX - 9, eave + 14, 18, H - eave - 16, '#2a2a2e')
  px(ctx, doorX - 7, eave + 16, 14, H - eave - 18, '#4a3a2a')
  px(ctx, doorX, eave + 16, 1, H - eave - 18, '#2a2a2e')
  ellipse(ctx, doorX, eave + 7, 4, 4, '#2a2a2e')
  ellipse(ctx, doorX, eave + 7, 2.5, 2.5, '#f4f0e6')
  dot(ctx, doorX, eave + 7, '#2a2a2e')
  px(ctx, PAD + 2, eave, W - PAD * 2 - 4, 2, '#2a1c10')
  tileRoof(ctx, 0, W - 1, 10, eave, 6)
  return finish(img, { windows: [], lamps: [] })
}

function shrine(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 26)
  const eave = H - 34
  const floor = H - 10
  // Hinoki pillars and lattice doors on a raised floor.
  px(ctx, PAD + 4, eave, W - PAD * 2 - 8, floor - eave, '#2a1e16')
  for (let x = PAD + 10; x < W - PAD - 10; x += 2) px(ctx, x, eave + 4, 1, floor - eave - 6, '#c9a070')
  for (let y = eave + 6; y < floor - 2; y += 3) px(ctx, PAD + 10, y, W - PAD * 2 - 20, 1, '#c9a070')
  for (const x of [PAD + 4, PAD + 30, W - PAD - 33, W - PAD - 8]) {
    px(ctx, x, eave, 4, floor - eave, '#c9a070')
    px(ctx, x + 3, eave, 1, floor - eave, '#a8804e')
  }
  px(ctx, PAD + 2, floor, W - PAD * 2 - 4, 3, '#a8804e')
  px(ctx, PAD + 2, floor, W - PAD * 2 - 4, 1, '#d8b080')
  // Steps and the offering box.
  for (let i = 0; i < 3; i++) px(ctx, doorX - 14 + i * 2, floor + 3 + i * 2, 28 - i * 4, 2, i % 2 ? '#b08858' : '#c9a070')
  px(ctx, doorX - 10, floor - 6, 20, 8, '#6a4426')
  for (let i = doorX - 9; i < doorX + 10; i += 2) px(ctx, i, floor - 6, 1, 3, '#2a1c10')
  px(ctx, doorX - 10, floor - 6, 20, 1, '#8f6038')
  // Bell rope with the bell.
  ellipse(ctx, doorX, eave + 4, 3, 2.5, '#e0b13c')
  dot(ctx, doorX - 1, eave + 3, '#fff0a0')
  for (let y = eave + 7; y < floor - 7; y++) dot(ctx, doorX + ((y >> 1) % 2), y, y % 4 < 2 ? '#c0262f' : '#f4f1ea')
  // Roof: cypress bark, smooth and thick.
  const top = 18
  for (let y = top; y <= eave; y++) {
    const [l, r] = trapezoid(top, eave, 0, W - 1, 12, y)
    for (let x = l; x <= r; x++) {
      const rel = (x - l) / Math.max(1, r - l)
      let c = rel < 0.2 ? '#97704a' : rel > 0.8 ? '#5e4430' : '#80583a'
      if ((y - top) % 3 === 0) c = mix(c, '#3e2c1e', 0.35)
      if (y > eave - 4) c = y === eave ? '#3e2c1e' : '#a8805a'
      dot(ctx, x, y, c)
    }
  }
  const [l, r] = trapezoid(top, eave, 0, W - 1, 12, top)
  px(ctx, l - 2, top - 5, r - l + 5, 6, '#4e3626')
  px(ctx, l - 2, top - 5, r - l + 5, 1, '#7a5a40')
  // Katsuogi logs on the ridge, chigi crossed boards at the ends.
  for (let x = l + 12; x < r - 8; x += 18) {
    px(ctx, x, top - 9, 8, 4, '#c9a070')
    px(ctx, x, top - 9, 1, 4, '#e0b13c')
    px(ctx, x + 7, top - 9, 1, 4, '#e0b13c')
  }
  for (const [x, d] of [
    [l - 1, -1],
    [r + 1, 1],
  ] as const)
    for (let i = 0; i < 12; i++) {
      dot(ctx, x + d * Math.floor(i / 2), top - 4 - i, '#4e3626')
      dot(ctx, x - d * Math.floor(i / 3), top - 4 - i, '#6e4e36')
    }
  // Shimenawa rope with paper streamers across the front.
  px(ctx, PAD + 8, eave + 1, W - PAD * 2 - 16, 3, '#d9c27a')
  for (let x = PAD + 8; x < W - PAD - 8; x += 2) dot(ctx, x, eave + 2, '#a68a48')
  for (let x = PAD + 16; x < W - PAD - 12; x += 16) {
    px(ctx, x, eave + 4, 2, 2, '#f8f6f0')
    px(ctx, x + 1, eave + 6, 2, 2, '#f8f6f0')
    px(ctx, x, eave + 8, 2, 2, '#f8f6f0')
  }
  return finish(img, { windows: [], lamps: [] })
}

function hut(b: Building, fish: boolean): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 12)
  const windows: Rect[] = []
  const eave = H - 26
  const wallTop = eave - 1
  const wallBottom = H - 3
  planks(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, fish ? '#8a7f70' : '#7a5a3a', fish ? '#5e5648' : '#4a2e1a')
  // Straw-mat (sudare) door.
  px(ctx, doorX - 6, wallTop + 4, 12, wallBottom - wallTop - 4, '#1e1612')
  px(ctx, doorX - 6, wallTop + 4, 12, 10, '#c9a752')
  for (let y = wallTop + 5; y < wallTop + 14; y += 2) px(ctx, doorX - 6, y, 12, 1, '#a68a48')
  windows.push({ x: doorX - 5, y: wallTop + 14, w: 10, h: wallBottom - wallTop - 14 })
  const wx = doorX < W / 2 ? W - PAD - 16 : PAD + 5
  windows.push(lattice(ctx, wx, wallTop + 5, 10, 7, '#3d2615', '#f2ead4'))
  if (fish) {
    // A string of drying fish under the eave.
    for (let i = 0; i < 4; i++) {
      const x = wx - 2 + i * 3
      px(ctx, x, wallTop + 14, 2, 4, '#a9b4bc')
      dot(ctx, x, wallTop + 18, '#6a7680')
    }
  } else {
    // Kakuzen's conch hanging by the door.
    ellipse(ctx, doorX + 10, wallTop + 8, 3, 2, '#f4e0c8')
    dot(ctx, doorX + 12, wallTop + 8, '#d88a6a')
  }
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 2, '#2a1c10')
  thatchRoof(ctx, 0, W - 1, 10, eave, 8, b.x * 13 + b.y, fish)
  const [l, r] = trapezoid(10, eave, 0, W - 1, 8, 10)
  ridgeCap(ctx, l - 1, r + 2, 5)
  return finish(img, { windows, lamps: [], chimney: { x: Math.round(W / 2), y: 6 } })
}

function guardpost(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 14)
  const eave = H - 26
  const wallTop = eave - 1
  const wallBottom = H - 3
  planks(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop)
  px(ctx, doorX - 9, wallTop + 3, 20, wallBottom - wallTop - 3, '#1e1612')
  // Spear rack.
  for (let i = 0; i < 3; i++) {
    const x = doorX - 6 + i * 5
    px(ctx, x, wallTop + 6, 1, wallBottom - wallTop - 6, '#8f6038')
    px(ctx, x, wallTop + 3, 1, 3, '#d8dee8')
  }
  px(ctx, doorX - 8, wallBottom - 6, 18, 1, '#5a3a22')
  // Tokugawa-blue banner pinned to the wall.
  px(ctx, PAD + 4, wallTop + 3, 7, 12, '#2f3f73')
  ellipse(ctx, PAD + 7, wallTop + 8, 2, 2, '#f4f1ea')
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 2, '#2a1c10')
  boardRoof(ctx, 0, W - 1, 10, eave, 6)
  const [l, r] = trapezoid(10, eave, 0, W - 1, 6, 10)
  roofStones(ctx, l, r, 16)
  roofStones(ctx, l - 2, r + 2, eave - 6)
  return finish(img, { windows: [{ x: doorX - 8, y: wallTop + 4, w: 18, h: wallBottom - wallTop - 5 }], lamps: [] })
}

function coop(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 8)
  const eave = 22
  planks(ctx, PAD + 2, eave, W - PAD * 2 - 4, H - eave - 3, '#8a6036', '#5a3a22')
  px(ctx, doorX - 4, H - 14, 8, 11, '#1e1612')
  // Ramp.
  for (let i = 0; i < 4; i++) px(ctx, doorX - 3, H - 4 + Math.floor(i / 2), 6, 1, i % 2 ? '#a87a46' : '#c49a62')
  // A hen peeking out of the window, as one does.
  const wx = doorX < W / 2 ? W - 16 : 8
  px(ctx, wx, eave + 5, 9, 7, '#1e1612')
  ellipse(ctx, wx + 4, eave + 9, 2.5, 2.5, '#f4f1ea')
  dot(ctx, wx + 4, eave + 6, '#d23c2a')
  dot(ctx, wx + 5, eave + 6, '#d23c2a')
  dot(ctx, wx + 6, eave + 9, '#f2b030')
  dot(ctx, wx + 4, eave + 8, INK)
  boardRoof(ctx, 0, W - 1, 6, eave, 3)
  return finish(img, { windows: [], lamps: [] })
}
