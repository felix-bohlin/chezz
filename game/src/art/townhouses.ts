// Everyday town buildings: shops with their goods out front, the tavern, the inn, the bathhouse,
// samurai houses, row houses (nagaya), the forge, workshops, the fish market and the shipwright.

import { dot, ellipse, px, type Ctx } from '../engine/pixel'
import type { Building } from '../world/layout'
import {
  boardRoof,
  chochin,
  DARKWOOD,
  finish,
  frame,
  lattice,
  noren,
  PAD,
  planks,
  PLASTER,
  PLASTER_D,
  post,
  roofStones,
  shoji,
  stoneBase,
  tileRoof,
  trapezoid,
  WOODL,
  WOODM,
  type BuildingArt,
  type Rect,
} from './kit'

const STRAW = ['#9c7e36', '#c9a752', '#dcbe6a']

interface ShopStyle {
  noren: string
  mark: string
  sign: string
  goods: (ctx: Ctx, x: number, y: number, w: number) => void
}

const SHOPS: Record<string, ShopStyle> = {
  rice: { noren: '#2f3f73', mark: '#f4f1ea', sign: '#7a5232', goods: bales },
  sweets: { noren: '#c0626a', mark: '#f4f1ea', sign: '#a85a6a', goods: sweets },
  cloth: { noren: '#4a6a9a', mark: '#f0a0b8', sign: '#5a74a8', goods: cloth },
  medicine: { noren: '#3a6a4a', mark: '#f4f1ea', sign: '#2a4a3a', goods: medicine },
  tofu: { noren: '#e8e4dc', mark: '#2f3f73', sign: '#8a8070', goods: tofu },
  incense: { noren: '#7a4a8a', mark: '#e0b13c', sign: '#5a3a6a', goods: charms },
  harbour: { noren: '#1e3a5a', mark: '#f4f1ea', sign: '#1e3a5a', goods: chart },
}

export function shop(b: Building): BuildingArt {
  const style = SHOPS[b.variant ?? 'rice'] ?? SHOPS.rice
  const { W, H, doorX, ctx, img } = frame(b, 16)
  const windows: Rect[] = []
  const roofBottom = Math.round(H * 0.4)
  // Upper floor: plaster with a slit window.
  px(ctx, PAD + 2, roofBottom, W - PAD * 2 - 4, 16, PLASTER)
  px(ctx, PAD + 2, roofBottom, W - PAD * 2 - 4, 2, PLASTER_D)
  const mx = Math.round(W / 2) - 12
  px(ctx, mx, roofBottom + 4, 24, 8, '#5a5248')
  for (let i = mx + 1; i < mx + 23; i += 3) px(ctx, i, roofBottom + 5, 2, 6, '#2a2420')
  windows.push({ x: mx + 1, y: roofBottom + 5, w: 22, h: 6 })
  tileRoof(ctx, 0, W - 1, roofBottom + 17, roofBottom + 22, 2)
  // Ground floor: open shop front, goods, the door with its noren.
  const gTop = roofBottom + 23
  const gBottom = H - 4
  px(ctx, PAD + 2, gTop, W - PAD * 2 - 4, gBottom - gTop, '#2a1e18')
  windows.push({ x: PAD + 3, y: gTop + 2, w: W - PAD * 2 - 6, h: 8 })
  px(ctx, doorX - 6, gTop, 13, gBottom - gTop, '#1a1210')
  noren(ctx, doorX, gTop, 13, 9, style.noren, style.mark)
  const left = doorX - PAD > W / 2
  const gx = left ? PAD + 3 : doorX + 8
  const gw = left ? doorX - 8 - gx : W - PAD - 3 - gx
  if (gw > 6) style.goods(ctx, gx, gBottom - 2, gw)
  for (const x of [PAD + 1, W - PAD - 4]) post(ctx, x, roofBottom, gBottom - roofBottom)
  // Hanging signboard.
  const sx = left ? W - PAD - 9 : PAD + 4
  px(ctx, sx, gTop + 1, 5, 14, style.sign)
  for (let y = gTop + 3; y < gTop + 13; y += 3) px(ctx, sx + 1, y, 3, 1, '#f1e6cc')
  stoneBase(ctx, PAD, H - 4, W - PAD * 2, 4)
  tileRoof(ctx, 0, W - 1, 10, roofBottom, 10)
  return finish(img, { windows, lamps: [{ x: doorX + 9, y: gTop + 2, r: 22, color: '#ffb060', hours: [1050, 1290] }] })
}

function bales(ctx: Ctx, x: number, y: number, w: number): void {
  for (let i = 0; i + 7 <= w; i += 7) {
    px(ctx, x + i, y - 6, 6, 6, STRAW[1])
    px(ctx, x + i, y - 6, 6, 1, STRAW[2])
    px(ctx, x + i + 2, y - 6, 1, 6, STRAW[0])
    if (i + 10 <= w && i % 14 === 0) {
      px(ctx, x + i + 3, y - 12, 6, 6, STRAW[1])
      px(ctx, x + i + 5, y - 12, 1, 6, STRAW[0])
    }
  }
}

function sweets(ctx: Ctx, x: number, y: number, w: number): void {
  px(ctx, x, y - 3, w, 3, '#7a5232')
  for (let i = 1; i < w - 2; i += 4) {
    dot(ctx, x + i, y - 5, '#f0a0b8')
    dot(ctx, x + i + 1, y - 5, '#f4f1ea')
    dot(ctx, x + i + 2, y - 5, '#8fc06a')
    px(ctx, x + i, y - 4, 3, 1, '#c49a62')
  }
}

function cloth(ctx: Ctx, x: number, y: number, w: number): void {
  const cols = ['#2f3f73', '#c96a3a', '#f0a0b8', '#5a74a8', '#e0b13c']
  for (let i = 0, k = 0; i + 4 <= w; i += 5, k++) {
    const h = 6 + (k % 3)
    px(ctx, x + i, y - h, 4, h, cols[k % cols.length])
    px(ctx, x + i, y - h, 1, h, '#ffffff33')
  }
}

function medicine(ctx: Ctx, x: number, y: number, w: number): void {
  for (let i = 0; i + 4 <= w; i += 5) {
    px(ctx, x + i, y - 6, 4, 6, i % 10 ? '#8a6a4a' : '#5a7a6a')
    px(ctx, x + i, y - 7, 4, 1, '#3a2a1a')
    dot(ctx, x + i + 1, y - 4, '#f1e6cc')
  }
}

function tofu(ctx: Ctx, x: number, y: number, w: number): void {
  for (let i = 0; i + 8 <= w; i += 9) {
    px(ctx, x + i, y - 5, 8, 5, '#7a5a3a')
    px(ctx, x + i + 1, y - 5, 6, 2, '#5a8aa8')
    px(ctx, x + i + 2, y - 6, 2, 2, '#f8f6f0')
    px(ctx, x + i + 5, y - 6, 2, 2, '#f8f6f0')
  }
}

function charms(ctx: Ctx, x: number, y: number, w: number): void {
  px(ctx, x, y - 2, w, 2, '#7a5232')
  const cols = ['#d23c2a', '#e0b13c', '#3a6a9a', '#5a9a4a', '#f0a0b8']
  for (let i = 1; i < w - 1; i += 3) {
    px(ctx, x + i, y - 6, 2, 3, cols[(i / 3) % cols.length | 0])
    dot(ctx, x + i, y - 7, '#f4f1ea')
  }
}

function chart(ctx: Ctx, x: number, y: number, w: number): void {
  const cw = Math.min(w, 14)
  px(ctx, x, y - 10, cw, 9, '#e8dcc0')
  px(ctx, x + 2, y - 8, cw - 5, 4, '#7ab2cc')
  px(ctx, x + 3, y - 7, 3, 2, '#c9b58a')
  dot(ctx, x + cw - 3, y - 5, '#d23c2a')
}

export function tavern(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 16)
  const windows: Rect[] = []
  const eave = H - 34
  const wallTop = eave - 1
  const wallBottom = H - 4
  planks(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, '#4a3426', '#2e2018')
  // Lattice windows glowing warm.
  windows.push(lattice(ctx, PAD + 5, wallTop + 6, 18, 10, '#2a1a12', '#f2d8a0'))
  windows.push(lattice(ctx, W - PAD - 23, wallTop + 6, 18, 10, '#2a1a12', '#f2d8a0'))
  px(ctx, doorX - 7, wallTop + 3, 15, wallBottom - wallTop - 3, '#1a1210')
  windows.push({ x: doorX - 6, y: wallTop + 12, w: 13, h: wallBottom - wallTop - 12 })
  noren(ctx, doorX, wallTop + 3, 15, 9, '#1e2a4a', '#f4f1ea')
  // The sign: a red octopus, clearly drunk.
  const sx = doorX - 10
  px(ctx, sx, wallTop - 10, 21, 9, '#7a5232')
  ellipse(ctx, sx + 10, wallTop - 7, 4, 3, '#d23c2a')
  for (let i = 0; i < 4; i++) px(ctx, sx + 6 + i * 2 + (i % 2), wallTop - 4, 1, 2, '#d23c2a')
  dot(ctx, sx + 9, wallTop - 8, '#f4f1ea')
  dot(ctx, sx + 11, wallTop - 7, '#f4f1ea')
  px(ctx, sx + 15, wallTop - 8, 2, 3, '#f4f1ea') // a sake cup
  // Red lanterns along the eave.
  const lamps: BuildingArt['lamps'] = []
  for (const x of [PAD + 6, W - PAD - 7]) {
    chochin(ctx, x, eave + 3)
    lamps.push({ x, y: eave + 6, r: 30, color: '#ff7050', hours: [960, 1410] })
  }
  for (const x of [PAD + 1, W - PAD - 4]) post(ctx, x, wallTop, wallBottom - wallTop)
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 2, '#1a1210')
  stoneBase(ctx, PAD, H - 4, W - PAD * 2, 4)
  tileRoof(ctx, 0, W - 1, 12, eave, 12)
  return finish(img, { windows, lamps, chimney: { x: W - 22, y: 16 } })
}

export function inn(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 22)
  const windows: Rect[] = []
  const roofBottom = Math.round(H * 0.32)
  // Upper floor with a balcony of shoji.
  px(ctx, PAD + 2, roofBottom, W - PAD * 2 - 4, 22, PLASTER)
  for (let x = PAD + 6; x < W - PAD - 14; x += 14) windows.push(shoji(ctx, x, roofBottom + 3, 12, 12))
  px(ctx, PAD + 1, roofBottom + 16, W - PAD * 2 - 2, 2, DARKWOOD)
  for (let x = PAD + 2; x < W - PAD - 2; x += 3) px(ctx, x, roofBottom + 18, 1, 4, WOODM)
  px(ctx, PAD + 1, roofBottom + 22, W - PAD * 2 - 2, 1, DARKWOOD)
  tileRoof(ctx, 0, W - 1, roofBottom + 23, roofBottom + 29, 2)
  // Ground floor: wide entrance, lanterns.
  const gTop = roofBottom + 30
  const gBottom = H - 4
  px(ctx, PAD + 2, gTop, W - PAD * 2 - 4, gBottom - gTop, '#3a2a1e')
  windows.push(lattice(ctx, PAD + 4, gTop + 3, 20, gBottom - gTop - 6, '#2a1a12', '#f2e2c0'))
  windows.push(lattice(ctx, W - PAD - 24, gTop + 3, 20, gBottom - gTop - 6, '#2a1a12', '#f2e2c0'))
  px(ctx, doorX - 10, gTop, 21, gBottom - gTop, '#1a1210')
  noren(ctx, doorX, gTop, 21, 10, '#5a3a22', '#f4f1ea')
  // Signboard: the inn's name, as far as anyone can read it.
  px(ctx, doorX - 14, roofBottom - 2, 28, 7, '#7a5232')
  for (const i of [-10, -4, 2, 8]) px(ctx, doorX + i, roofBottom, 3, 3, '#f1e6cc')
  const lamps: BuildingArt['lamps'] = []
  for (const x of [doorX - 14, doorX + 14]) {
    chochin(ctx, x, gTop + 1)
    lamps.push({ x, y: gTop + 4, r: 28, color: '#ffb060', hours: [1050, 1380] })
  }
  for (const x of [PAD + 1, W - PAD - 4]) post(ctx, x, roofBottom, gBottom - roofBottom)
  stoneBase(ctx, PAD, H - 4, W - PAD * 2, 4)
  tileRoof(ctx, 0, W - 1, 12, roofBottom, 14)
  return finish(img, { windows, lamps, chimney: { x: Math.round(W * 0.7), y: 14 } })
}

export function bathhouse(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 30)
  const windows: Rect[] = []
  const eave = H - 38
  const wallTop = eave - 1
  const wallBottom = H - 4
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, PLASTER)
  px(ctx, PAD + 1, wallBottom - 12, W - PAD * 2 - 2, 12, '#3a3e48')
  for (let x = PAD + 1; x < W - PAD; x += 4) px(ctx, x, wallBottom - 12, 1, 12, '#2a2e36')
  // Two entrances: blue curtain for men, red for women, each with the hot-water mark.
  for (const [dx, col] of [
    [-9, '#2f4a8a'],
    [9, '#c0262f'],
  ] as const) {
    const cx = doorX + dx
    px(ctx, cx - 7, wallTop + 4, 15, wallBottom - wallTop - 4, '#1a1210')
    noren(ctx, cx, wallTop + 4, 15, 12, col, col)
    // A rough "ゆ" in white.
    px(ctx, cx - 3, wallTop + 7, 1, 5, '#f4f1ea')
    px(ctx, cx - 2, wallTop + 8, 5, 1, '#f4f1ea')
    px(ctx, cx + 2, wallTop + 8, 1, 4, '#f4f1ea')
    px(ctx, cx, wallTop + 6, 1, 7, '#f4f1ea')
    windows.push({ x: cx - 6, y: wallTop + 16, w: 13, h: wallBottom - wallTop - 16 })
  }
  windows.push(lattice(ctx, PAD + 4, wallTop + 6, 12, 8, '#3d2615', '#f2ead4'))
  windows.push(lattice(ctx, W - PAD - 16, wallTop + 6, 12, 8, '#3d2615', '#f2ead4'))
  for (const x of [PAD + 1, W - PAD - 4]) post(ctx, x, wallTop, wallBottom - wallTop)
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 2, '#2a1c10')
  stoneBase(ctx, PAD, H - 4, W - PAD * 2, 4)
  // Tall chimney for the boiler, behind the roof ridge.
  const cx = W - 24
  px(ctx, cx, 0, 8, 30, '#8a5a3a')
  for (let y = 2; y < 30; y += 4) px(ctx, cx, y, 8, 1, '#6a4428')
  px(ctx, cx - 1, 0, 10, 2, '#4a2e1a')
  tileRoof(ctx, 0, W - 1, 22, eave, 12)
  return finish(img, { windows, lamps: [{ x: doorX, y: wallTop + 2, r: 26, color: '#ffb060', hours: [840, 1320] }], chimney: { x: cx + 4, y: 0 } })
}

export function samurai(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 18)
  const windows: Rect[] = []
  const eave = H - 34
  const wallTop = eave - 1
  const wallBottom = H - 5
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, '#f2eee4')
  px(ctx, PAD + 1, wallBottom - 10, W - PAD * 2 - 2, 10, '#2a2420')
  for (let x = PAD + 1; x < W - PAD; x += 3) px(ctx, x, wallBottom - 10, 1, 10, '#3e3630')
  for (let x = PAD + 1; x < W - PAD - 3; x += 16) post(ctx, x, wallTop, wallBottom - wallTop)
  for (let x = PAD + 6; x < W - PAD - 14; x += 32) if (Math.abs(x + 6 - doorX) > 14) windows.push(lattice(ctx, x, wallTop + 6, 12, 9, '#2a2420', '#f2ead4'))
  // Entrance porch with its own little curved roof.
  px(ctx, doorX - 9, wallTop + 6, 19, wallBottom - wallTop - 6, '#1a1210')
  windows.push({ x: doorX - 8, y: wallTop + 8, w: 17, h: wallBottom - wallTop - 8 })
  px(ctx, doorX - 8, wallTop + 6, 2, wallBottom - wallTop - 6, WOODL)
  px(ctx, doorX + 7, wallTop + 6, 2, wallBottom - wallTop - 6, WOODL)
  for (let i = 0; i < 6; i++) px(ctx, doorX - 12 + i, wallTop + 1 - Math.floor(i / 2), 25 - i * 2, 1, i < 2 ? '#2c323e' : '#4f5a6c')
  dot(ctx, doorX, wallTop - 3, '#e0b13c')
  stoneBase(ctx, PAD, H - 5, W - PAD * 2, 5)
  tileRoof(ctx, 0, W - 1, 12, eave, 14)
  return finish(img, { windows, lamps: [{ x: doorX - 11, y: wallTop + 8, r: 24, color: '#ffc070', hours: [1080, 1320] }], chimney: { x: W - 30, y: 16 } })
}

export function nagaya(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 14)
  const windows: Rect[] = []
  const eave = H - 28
  const wallTop = eave - 1
  const wallBottom = H - 3
  planks(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, '#7a6450', '#5a4636')
  // Three units: door, window, door, window…
  const units = Math.max(2, Math.round((W - PAD * 2) / 32))
  const uw = (W - PAD * 2) / units
  for (let k = 0; k < units; k++) {
    const ux = Math.round(PAD + k * uw)
    const dx = k === Math.floor(units / 2) ? doorX - 5 : ux + 4
    px(ctx, dx, wallTop + 4, 10, wallBottom - wallTop - 4, '#e8dcc0')
    for (let y = wallTop + 6; y < wallBottom; y += 4) px(ctx, dx, y, 10, 1, '#b9a888')
    px(ctx, dx + 4, wallTop + 4, 1, wallBottom - wallTop - 4, '#8a7860')
    windows.push({ x: dx + 1, y: wallTop + 5, w: 8, h: wallBottom - wallTop - 6 })
    const wx = dx + 14
    if (wx + 9 < ux + uw) windows.push(lattice(ctx, wx, wallTop + 6, 8, 7, '#3d2615', '#f2ead4'))
    post(ctx, ux, wallTop, wallBottom - wallTop)
  }
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 2, '#2a1c10')
  boardRoof(ctx, 0, W - 1, 10, eave, 6)
  const [l, r] = trapezoid(10, eave, 0, W - 1, 6, 10)
  roofStones(ctx, l, r, 16)
  return finish(img, { windows, lamps: [], chimney: { x: Math.round(W * 0.3), y: 10 } })
}

export function smithy(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 18)
  const eave = H - 32
  const wallTop = eave - 1
  const wallBottom = H - 3
  planks(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, '#4a3a30', '#2e241e')
  // Open front: the forge with glowing coals, tools on the wall.
  const ox = PAD + 6
  const ow = W - PAD * 2 - 12
  px(ctx, ox, wallTop + 4, ow, wallBottom - wallTop - 4, '#1a1210')
  const fx = ox + 4
  px(ctx, fx, wallBottom - 10, 14, 10, '#6a5a50')
  px(ctx, fx + 2, wallBottom - 12, 10, 3, '#f06a2a')
  px(ctx, fx + 4, wallBottom - 13, 6, 1, '#ffd060')
  for (let i = 0; i < 4; i++) px(ctx, ox + ow - 18 + i * 4, wallTop + 6, 1, 8, '#a8a8b0')
  px(ctx, doorX - 2, wallBottom - 6, 8, 3, '#3a3a40') // anvil
  px(ctx, doorX, wallBottom - 3, 4, 3, '#2a2a30')
  for (const x of [PAD + 1, W - PAD - 4]) post(ctx, x, wallTop, wallBottom - wallTop)
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 2, '#1a1210')
  // Chimney.
  const cx = PAD + 10
  px(ctx, cx, 2, 7, 18, '#6a6a6a')
  px(ctx, cx, 2, 7, 2, '#4a4a4a')
  boardRoof(ctx, 0, W - 1, 12, eave, 6)
  return finish(img, {
    windows: [{ x: fx + 1, y: wallBottom - 14, w: 12, h: 5 }],
    lamps: [{ x: fx + 7, y: wallBottom - 10, r: 34, color: '#ff8840', hours: [360, 1110] }],
    chimney: { x: cx + 3, y: 2 },
  })
}

export function workshop(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 14)
  const windows: Rect[] = []
  const eave = H - 30
  const wallTop = eave - 1
  const wallBottom = H - 3
  const v = b.variant ?? 'carpenter'
  planks(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, wallBottom - wallTop, v === 'stable' ? '#7a5a3a' : '#8a6a48', '#5a4228')
  const ox = PAD + 5
  const ow = W - PAD * 2 - 10
  px(ctx, ox, wallTop + 4, ow, wallBottom - wallTop - 4, '#241a14')
  windows.push({ x: ox + 1, y: wallTop + 5, w: ow - 2, h: 8 })
  if (v === 'carpenter') {
    for (let i = 0; i < 5; i++) px(ctx, ox + 3 + i * 3, wallTop + 6, 2, wallBottom - wallTop - 7, i % 2 ? '#c49a62' : '#a87a46')
    px(ctx, doorX - 2, wallBottom - 6, 12, 2, '#c49a62') // sawhorse
    px(ctx, doorX - 1, wallBottom - 4, 1, 4, '#7a5232')
    px(ctx, doorX + 8, wallBottom - 4, 1, 4, '#7a5232')
  } else if (v === 'umbrella') {
    const cols = ['#d23c2a', '#2f4a8a', '#e0b13c', '#5a9a4a']
    for (let i = 0; i < 4; i++) {
      const ux = ox + 6 + i * ((ow - 12) / 3)
      ellipse(ctx, ux, wallBottom - 8, 6, 4, cols[i])
      for (let k = -4; k <= 4; k += 2) dot(ctx, ux + k, wallBottom - 8, '#ffffff55')
      px(ctx, ux, wallBottom - 6, 1, 6, '#7a5232')
    }
  } else if (v === 'stable') {
    // A horse looks out over the stall door.
    px(ctx, ox, wallBottom - 10, ow, 10, '#5a4228')
    const hx = doorX - 3
    px(ctx, hx, wallBottom - 18, 6, 9, '#6a4a32')
    px(ctx, hx - 2, wallBottom - 14, 3, 5, '#6a4a32')
    dot(ctx, hx + 1, wallBottom - 16, '#1a1220')
    px(ctx, hx + 4, wallBottom - 20, 1, 3, '#6a4a32')
    px(ctx, hx + 2, wallBottom - 18, 3, 5, '#2a1a12') // mane
    px(ctx, ox + 2, wallBottom - 6, 8, 6, STRAW[1])
  }
  for (const x of [PAD + 1, W - PAD - 4]) post(ctx, x, wallTop, wallBottom - wallTop)
  px(ctx, PAD + 1, wallTop, W - PAD * 2 - 2, 2, '#1a1210')
  boardRoof(ctx, 0, W - 1, 10, eave, 6)
  const [l, r] = trapezoid(10, eave, 0, W - 1, 6, 10)
  roofStones(ctx, l, r, 15)
  return finish(img, { windows, lamps: [] })
}

export function fishmarket(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 20)
  const roofBottom = H - 30
  // Open shed: posts, long counters with the morning catch.
  for (let x = PAD + 2; x < W - PAD; x += 26) {
    px(ctx, x, roofBottom, 3, H - roofBottom - 2, DARKWOOD)
    dot(ctx, x, roofBottom, '#5a3a22')
  }
  px(ctx, PAD + 2, H - 14, W - PAD * 2 - 4, 3, WOODL)
  px(ctx, PAD + 2, H - 11, W - PAD * 2 - 4, 7, '#5a4228')
  const fish = ['#a9b4bc', '#c0626a', '#a9b4bc', '#e0b13c', '#7a8a9a']
  for (let x = PAD + 5, k = 0; x < W - PAD - 8; x += 7, k++) {
    const c = fish[k % fish.length]
    px(ctx, x, H - 16, 5, 2, c)
    dot(ctx, x + 5, H - 16, c)
    dot(ctx, x + 6, H - 17, c)
    dot(ctx, x + 6, H - 15, c)
    dot(ctx, x + 1, H - 16, '#1a1220')
  }
  // A hanging octopus, for drama.
  ellipse(ctx, W / 2, roofBottom + 7, 4, 3, '#c0262f')
  for (let i = -3; i <= 3; i += 2) px(ctx, W / 2 + i, roofBottom + 9, 1, 4, '#c0262f')
  // Tubs.
  for (const x of [PAD + 8, W - PAD - 16]) {
    px(ctx, x, H - 8, 8, 6, '#7a5a3a')
    px(ctx, x + 1, H - 8, 6, 2, '#5a8aa8')
  }
  tileRoof(ctx, 0, W - 1, 12, roofBottom, 6)
  return finish(img, { windows: [], lamps: [{ x: W / 2, y: roofBottom + 4, r: 34, color: '#ffc070', hours: [240, 420] }] })
}

export function shipwright(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 22)
  const roofBottom = H - 44
  // Tall open shed with a boat taking shape inside.
  px(ctx, PAD + 2, roofBottom, W - PAD * 2 - 4, H - roofBottom - 3, '#2a2018')
  // Boat ribs.
  const cx = W / 2
  for (let i = -5; i <= 5; i++) {
    const x = Math.round(cx + i * 7)
    const h = 14 - Math.abs(i)
    px(ctx, x, H - 8 - h, 2, h, '#c49a62')
    dot(ctx, x, H - 8 - h, '#e0bc84')
  }
  px(ctx, cx - 40, H - 9, 80, 3, '#a87a46') // keel
  px(ctx, cx - 36, H - 16, 72, 2, '#8a6038') // a first plank
  // Sawhorses and leaning planks.
  for (const x of [PAD + 4, W - PAD - 10]) {
    px(ctx, x, H - 22, 2, 18, '#c49a62')
    px(ctx, x + 3, H - 20, 2, 16, '#a87a46')
  }
  for (const x of [PAD + 2, W - PAD - 5]) post(ctx, x, roofBottom, H - roofBottom - 3)
  boardRoof(ctx, 0, W - 1, 12, roofBottom, 4)
  const [l, r] = trapezoid(12, roofBottom, 0, W - 1, 4, 12)
  roofStones(ctx, l, r, 18)
  return finish(img, { windows: [], lamps: [] })
}

