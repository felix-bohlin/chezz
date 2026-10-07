// The big pieces: Kumoi Castle's keep, the corner towers, the town gates, the temple (sanmon gate,
// main hall, five-storey pagoda, bell tower), the fire watchtower — and Kame House.

import { dot, ellipse, px, type Ctx } from '../engine/pixel'
import type { Building } from '../world/layout'
import {
  chochin,
  DARKWOOD,
  finish,
  flaredRoof,
  frame,
  ishigaki,
  PAD,
  pixelText,
  plasterBand,
  RF,
  textWidth,
  tileRoof,
  WOODL,
  type BuildingArt,
  type Rect,
} from './kit'

const VERM = '#d23c2a'
const VERM_D = '#a32a1e'
const VERM_L = '#e8604a'
const GOLD = '#e0b13c'

/** Sprite x-range of a building's open (passage) tiles. */
function passage(b: Building): [number, number] {
  const xs = (b.open ?? []).map((p) => p.x)
  if (!xs.length) return [0, 0]
  return [(Math.min(...xs) - b.x) * 16 + PAD, (Math.max(...xs) + 1 - b.x) * 16 + PAD]
}

// ---------- the castle ----------

export function castle(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 96)
  const windows: Rect[] = []
  const cx = Math.round(W / 2)
  // Sloped stone base.
  const baseH = 34
  for (let y = 0; y < baseH; y++) {
    const inset = Math.round((baseH - y) * 0.35)
    ishigakiRow(ctx, PAD + inset, H - baseH + y, W - PAD * 2 - inset * 2, y)
  }
  // Gate in the base.
  px(ctx, doorX - 7, H - 16, 14, 16, '#1a1210')
  px(ctx, doorX - 8, H - 18, 16, 2, DARKWOOD)
  px(ctx, doorX - 6, H - 14, 2, 14, '#3a2414')
  px(ctx, doorX + 4, H - 14, 2, 14, '#3a2414')
  // Tiers of white walls under flared roofs, shrinking upwards.
  const tiers = [
    { w: W - 30, wall: 22, win: 6 },
    { w: W - 50, wall: 18, win: 5 },
    { w: W - 70, wall: 16, win: 4 },
    { w: W - 88, wall: 14, win: 3 },
    { w: W - 104, wall: 12, win: 2 },
  ]
  let y = H - baseH
  tiers.forEach((t, i) => {
    const x0 = cx - Math.round(t.w / 2)
    y -= t.wall
    plasterBand(ctx, x0, y, t.w, t.wall, t.win, windows)
    const roofH = i === tiers.length - 1 ? 14 : 10
    flaredRoof(ctx, cx, y - roofH, y + 1, t.w - 6, t.w + 14, RF, 4)
    // Triangular gables (chidori-hafu) on alternate tiers.
    if (i === 0 || i === 2) {
      for (let k = 0; k < 9; k++) px(ctx, cx - k, y - roofH - 6 + k, k * 2 + 1, 1, k < 2 ? RF[0] : k === 8 ? RF[0] : '#f2eee4')
      dot(ctx, cx, y - roofH - 3, GOLD)
    }
    y -= roofH
  })
  // Golden shachihoko on the ridge.
  for (const sx of [cx - 18, cx + 15]) {
    px(ctx, sx, y - 5, 3, 5, GOLD)
    dot(ctx, sx + (sx < cx ? -1 : 3), y - 6, GOLD)
    dot(ctx, sx + 1, y - 7, '#fff0a0')
  }
  px(ctx, cx - 16, y - 2, 32, 3, RF[0])
  return finish(img, { windows, lamps: [] })
}

function ishigakiRow(ctx: Ctx, x: number, y: number, w: number, row: number): void {
  const course = Math.floor(row / 4)
  const off = (course % 2) * 4
  for (let i = 0; i < w; i++) {
    const col = Math.floor((i + off) / 8)
    const joint = (i + off) % 8 === 0 || row % 4 === 3
    const shade = ((col * 7 + course * 3) % 5) / 5
    dot(ctx, x + i, y, joint ? '#5e5850' : shade < 0.3 ? '#8d877c' : shade < 0.7 ? '#9c9587' : '#aca596')
  }
}

export function tower(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 40)
  const windows: Rect[] = []
  const cx = Math.round(W / 2)
  ishigaki(ctx, PAD, H - 26, W - PAD * 2, 26, b.x * 7)
  let y = H - 26 - 18
  plasterBand(ctx, PAD + 4, y, W - PAD * 2 - 8, 18, 3, windows)
  flaredRoof(ctx, cx, y - 9, y + 1, W - 20, W + 2, RF, 3)
  y -= 9 + 13
  plasterBand(ctx, PAD + 14, y, W - PAD * 2 - 28, 13, 2, windows)
  flaredRoof(ctx, cx, y - 12, y + 1, W - 40, W - 14, RF, 3)
  px(ctx, cx - 10, y - 14, 20, 2, RF[0])
  return finish(img, { windows, lamps: [] })
}

// ---------- gates ----------

export function gate(b: Building): BuildingArt {
  const inner = b.variant === 'inner'
  const { W, H, ctx, img } = frame(b, inner ? 26 : 50)
  const windows: Rect[] = []
  const [p0, p1] = passage(b)
  const baseH = inner ? 0 : 30
  const floorTop = H - baseH - (inner ? 30 : 24)
  // Stone bases on either side of the passage.
  if (!inner) {
    ishigaki(ctx, PAD, H - baseH, p0 - PAD, baseH, b.x)
    ishigaki(ctx, p1, H - baseH, W - PAD - p1, baseH, b.x + 3)
  } else {
    for (const x of [p0 - 5, p1 + 1]) {
      px(ctx, x, floorTop, 4, H - floorTop, DARKWOOD)
      px(ctx, x, floorTop, 1, H - floorTop, '#5a3a22')
    }
    px(ctx, PAD + 2, H - 22, p0 - PAD - 7, 22, '#f2eee4')
    px(ctx, p1 + 5, H - 22, W - PAD - p1 - 7, 22, '#f2eee4')
    px(ctx, PAD + 2, H - 6, p0 - PAD - 7, 6, '#2a2420')
    px(ctx, p1 + 5, H - 6, W - PAD - p1 - 7, 6, '#2a2420')
  }
  // The upper floor spanning the passage.
  if (!inner) plasterBand(ctx, PAD + 2, floorTop, W - PAD * 2 - 4, H - baseH - floorTop, 4, windows)
  else px(ctx, p0 - 6, floorTop, p1 - p0 + 12, 5, DARKWOOD)
  // Shadow inside the passage and its open doors.
  const pTop = inner ? floorTop + 5 : H - baseH
  px(ctx, p0, pTop, p1 - p0, 3, '#1a1210')
  for (const x of [p0, p1 - 3]) {
    px(ctx, x, pTop + 3, 3, H - pTop - 6, '#4a2c17')
    for (let y = pTop + 6; y < H - 4; y += 5) dot(ctx, x + 1, y, '#a39cb0')
  }
  // Roof.
  const cx = Math.round(W / 2)
  const roofTop = floorTop - (inner ? 14 : 20)
  flaredRoof(ctx, cx, roofTop, floorTop + 1, W - 30, W + 6, RF, 4)
  px(ctx, cx - (W - 34) / 2, roofTop - 3, W - 34, 3, RF[0])
  px(ctx, cx - (W - 34) / 2 - 3, roofTop - 6, 5, 6, RF[1])
  px(ctx, cx + (W - 34) / 2 - 2, roofTop - 6, 5, 6, RF[1])
  // A banner on the sea gate.
  if (b.variant === 'sea') {
    px(ctx, p1 + 4, floorTop - 2, 1, 26, DARKWOOD)
    px(ctx, p1 + 5, floorTop - 2, 6, 14, '#2f3f73')
    ellipse(ctx, p1 + 8, floorTop + 4, 2, 2, '#f4f1ea')
  }
  const lamps: BuildingArt['lamps'] = inner
    ? []
    : [
        { x: p0 - 4, y: H - baseH - 2, r: 30, color: '#ffb060', hours: [1080, 1440] },
        { x: p1 + 4, y: H - baseH - 2, r: 30, color: '#ffb060', hours: [1080, 1440] },
      ]
  if (!inner) for (const l of lamps) chochin(ctx, l.x, l.y - 4)
  return finish(img, { windows, lamps })
}

/** Gatehouse on the west/east walls: the road runs through it left to right. */
export function gateSide(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 40)
  const windows: Rect[] = []
  const cx = Math.round(W / 2)
  ishigaki(ctx, PAD, H - 30, W - PAD * 2, 30, b.x)
  // The tunnel mouth, seen end-on in the stone.
  px(ctx, PAD + 6, H - 24, W - PAD * 2 - 12, 18, '#1a1210')
  px(ctx, PAD + 5, H - 26, W - PAD * 2 - 10, 2, DARKWOOD)
  let y = H - 30 - 22
  plasterBand(ctx, PAD + 2, y, W - PAD * 2 - 4, 22, 2, windows)
  flaredRoof(ctx, cx, y - 14, y + 1, W - 16, W + 8, RF, 4)
  y -= 14
  px(ctx, cx - 10, y - 3, 20, 3, RF[0])
  return finish(img, {
    windows,
    lamps: [{ x: cx, y: H - 28, r: 34, color: '#ffb060', hours: [1080, 1440] }],
  })
}

// ---------- temple ----------

export function sanmon(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 70)
  const [p0, p1] = passage(b)
  const floorTop = H - 40
  // Vermilion pillars and the side bays with the guardian kings.
  const pillars = [PAD + 2, p0 - 5, p1 + 1, W - PAD - 6]
  for (const x of pillars) {
    px(ctx, x, floorTop, 5, H - floorTop - 2, VERM)
    px(ctx, x, floorTop, 1, H - floorTop - 2, VERM_L)
    px(ctx, x + 4, floorTop, 1, H - floorTop - 2, VERM_D)
    px(ctx, x - 1, H - 4, 7, 3, '#8d877c')
  }
  for (const [x0, x1, body] of [
    [PAD + 7, p0 - 5, '#c0262f'],
    [p1 + 6, W - PAD - 6, '#3a5a9a'],
  ] as const) {
    px(ctx, x0, floorTop + 4, x1 - x0, H - floorTop - 6, '#241a14')
    const gx = Math.round((x0 + x1) / 2)
    // A fierce Niō, arms raised.
    ellipse(ctx, gx, floorTop + 12, 4, 4, body)
    px(ctx, gx - 5, floorTop + 16, 10, 14, body)
    px(ctx, gx - 8, floorTop + 14, 3, 8, body)
    px(ctx, gx + 5, floorTop + 10, 3, 8, body)
    dot(ctx, gx - 1, floorTop + 11, '#f4f1ea')
    dot(ctx, gx + 1, floorTop + 11, '#f4f1ea')
    px(ctx, gx - 4, floorTop + 22, 8, 2, '#f4f1ea')
    // Lattice in front of the bay.
    for (let x = x0; x < x1; x += 3) px(ctx, x, floorTop + 4, 1, H - floorTop - 6, VERM_D)
  }
  // Beam over the passage, upper balcony.
  px(ctx, PAD, floorTop - 4, W - PAD * 2, 5, VERM)
  px(ctx, PAD, floorTop - 4, W - PAD * 2, 1, VERM_L)
  px(ctx, PAD + 6, floorTop - 22, W - PAD * 2 - 12, 18, VERM_D)
  for (let x = PAD + 8; x < W - PAD - 8; x += 4) px(ctx, x, floorTop - 20, 2, 14, '#f2eee4')
  px(ctx, PAD + 4, floorTop - 6, W - PAD * 2 - 8, 2, DARKWOOD)
  // Plaque.
  const cx = Math.round(W / 2)
  px(ctx, cx - 6, floorTop - 20, 12, 16, '#2a2233')
  px(ctx, cx - 5, floorTop - 19, 10, 14, '#3a3a4a')
  for (const yy of [-17, -13, -9]) px(ctx, cx - 2, floorTop + yy, 4, 2, GOLD)
  // Lower skirt roof and the big upper roof.
  flaredRoof(ctx, cx, floorTop - 30, floorTop - 21, W - 10, W + 4, RF, 3)
  flaredRoof(ctx, cx, floorTop - 58, floorTop - 30, W - 60, W - 8, RF, 5)
  px(ctx, cx - (W - 64) / 2, floorTop - 61, W - 64, 3, RF[0])
  return finish(img, { windows: [], lamps: [] })
}

export function hondo(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 70)
  const windows: Rect[] = []
  const cx = Math.round(W / 2)
  const floor = H - 14
  const wallTop = H - 62
  // Stone platform and steps.
  px(ctx, PAD, floor, W - PAD * 2, 14, '#8d877c')
  px(ctx, PAD, floor, W - PAD * 2, 2, '#aca596')
  for (let i = 0; i < 4; i++) px(ctx, doorX - 20 + i * 2, floor + 2 + i * 3, 41 - i * 4, 3, i % 2 ? '#9c9587' : '#b5ae9f')
  // Veranda with railing.
  px(ctx, PAD + 6, floor - 6, W - PAD * 2 - 12, 6, WOODL)
  for (let x = PAD + 8; x < W - PAD - 8; x += 5) px(ctx, x, floor - 12, 1, 6, VERM_D)
  px(ctx, PAD + 6, floor - 13, W - PAD * 2 - 12, 2, VERM)
  // Facade: pillars, lattice doors, the golden Buddha glimpsed through the open centre.
  px(ctx, PAD + 10, wallTop, W - PAD * 2 - 20, floor - 13 - wallTop, '#2a1e16')
  for (let x = PAD + 12; x < W - PAD - 12; x += 2) if (Math.abs(x - doorX) > 18) px(ctx, x, wallTop + 4, 1, floor - 19 - wallTop, '#c9a070')
  for (let x = PAD + 10; x < W - PAD - 10; x += 26) {
    px(ctx, x, wallTop, 5, floor - 13 - wallTop, VERM)
    px(ctx, x, wallTop, 1, floor - 13 - wallTop, VERM_L)
  }
  const bx = doorX
  px(ctx, bx - 16, wallTop + 2, 33, floor - 15 - wallTop, '#1a1210')
  ellipse(ctx, bx, wallTop + 14, 10, 10, '#b8902a') // halo
  ellipse(ctx, bx, wallTop + 14, 7, 7, '#1a1210')
  ellipse(ctx, bx, wallTop + 13, 4, 4, GOLD) // head
  px(ctx, bx - 7, wallTop + 18, 15, 14, GOLD) // body
  px(ctx, bx - 9, wallTop + 28, 19, 5, '#c9a040') // lotus
  dot(ctx, bx, wallTop + 11, '#fff0a0')
  windows.push({ x: bx - 15, y: wallTop + 3, w: 31, h: floor - 17 - wallTop })
  // Hanging lanterns.
  const lamps: BuildingArt['lamps'] = []
  for (const x of [bx - 26, bx + 26]) {
    px(ctx, x - 2, wallTop - 2, 5, 7, GOLD)
    px(ctx, x - 1, wallTop + 5, 3, 1, '#7a5a1a')
    lamps.push({ x, y: wallTop + 3, r: 30, color: '#ffc060', hours: [1050, 1290] })
  }
  // The huge roof with a decorated front gable.
  flaredRoof(ctx, cx, 14, wallTop + 1, W - 70, W + 10, RF, 6)
  for (let k = 0; k < 20; k++) px(ctx, cx - k * 2, 4 + k, k * 4 + 1, 1, k < 2 || k === 19 ? RF[0] : k % 4 === 0 ? '#c9a070' : '#e8dcc0')
  dot(ctx, cx, 10, GOLD)
  dot(ctx, cx - 1, 11, GOLD)
  dot(ctx, cx + 1, 11, GOLD)
  px(ctx, cx - (W - 74) / 2, 11, W - 74, 3, RF[0])
  return finish(img, { windows, lamps })
}

export function pagoda(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 186)
  const windows: Rect[] = []
  const cx = Math.round(W / 2)
  px(ctx, PAD + 4, H - 8, W - PAD * 2 - 8, 8, '#8d877c')
  px(ctx, PAD + 4, H - 8, W - PAD * 2 - 8, 2, '#aca596')
  let y = H - 8
  for (let i = 0; i < 5; i++) {
    const w = 44 - i * 4
    const wall = i === 0 ? 18 : 12
    y -= wall
    px(ctx, cx - w / 2, y, w, wall, VERM)
    px(ctx, cx - w / 2, y, 2, wall, VERM_L)
    px(ctx, cx + w / 2 - 2, y, 2, wall, VERM_D)
    px(ctx, cx - 4, y + 2, 8, wall - 3, '#2a1e16')
    for (let x = cx - 3; x < cx + 4; x += 2) px(ctx, x, y + 2, 1, wall - 3, '#f2eee4')
    if (i === 0) windows.push({ x: cx - 4, y: y + 2, w: 8, h: wall - 3 })
    const rw = W - 6 - i * 6
    flaredRoof(ctx, cx, y - 14, y + 1, rw - 30, rw, RF, 5)
    y -= 14
  }
  // The spire: nine bronze rings and a jewel.
  px(ctx, cx - 1, y - 40, 3, 40, '#7a8a5a')
  for (let k = 0; k < 9; k++) px(ctx, cx - 4, y - 6 - k * 4, 9, 2, k % 2 ? '#8a9a5a' : '#c9a040')
  ellipse(ctx, cx, y - 44, 2.5, 3, GOLD)
  dot(ctx, cx - 1, y - 45, '#fff0a0')
  return finish(img, { windows, lamps: [] })
}

export function belltower(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 40)
  const cx = Math.round(W / 2)
  // Flared white skirt base.
  for (let y = 0; y < 18; y++) {
    const inset = Math.round(y * 0.3)
    px(ctx, PAD + 2 + inset, H - 4 - y, W - PAD * 2 - 4 - inset * 2, 1, y < 3 ? '#8d877c' : '#f2eee4')
  }
  px(ctx, PAD + 6, H - 22, W - PAD * 2 - 12, 2, DARKWOOD)
  // Posts and the open bell chamber.
  const top = H - 58
  for (const x of [PAD + 8, W - PAD - 12]) px(ctx, x, top, 4, 36, DARKWOOD)
  px(ctx, PAD + 6, top, W - PAD * 2 - 12, 3, DARKWOOD)
  // The bell (green bronze) and the hanging striker log.
  px(ctx, cx - 1, top + 3, 2, 3, '#3a3a3a')
  ellipse(ctx, cx, top + 8, 5, 3, '#4a6a5a')
  px(ctx, cx - 6, top + 8, 12, 14, '#4a6a5a')
  px(ctx, cx - 6, top + 8, 2, 14, '#6a8a6a')
  for (let y = top + 10; y < top + 20; y += 3) px(ctx, cx - 4, y, 8, 1, '#3a5244')
  px(ctx, cx - 7, top + 21, 14, 2, '#3a5244')
  px(ctx, cx + 7, top + 12, 12, 3, '#c49a62')
  px(ctx, cx + 10, top + 3, 1, 9, '#c9b58a')
  flaredRoof(ctx, cx, top - 16, top + 1, W - 30, W + 4, RF, 4)
  px(ctx, cx - (W - 34) / 2, top - 19, W - 34, 3, RF[0])
  return finish(img, { windows: [], lamps: [] })
}

export function watchtower(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 84)
  const cx = Math.round(W / 2)
  const top = 26
  // Four legs with cross bracing; you can see through it.
  for (const x of [PAD + 3, W - PAD - 6]) {
    px(ctx, x, top, 3, H - top - 2, '#5a3a22')
    px(ctx, x, top, 1, H - top - 2, '#7a5232')
  }
  for (let y = top + 16; y < H - 10; y += 22) {
    for (let i = 0; i < W - PAD * 2 - 9; i++) {
      dot(ctx, PAD + 6 + i, y + Math.round((i * 18) / (W - PAD * 2 - 9)), '#6a4428')
      dot(ctx, PAD + 6 + i, y + 18 - Math.round((i * 18) / (W - PAD * 2 - 9)), '#6a4428')
    }
    px(ctx, PAD + 3, y, W - PAD * 2 - 6, 2, '#5a3a22')
  }
  // Ladder up the middle.
  for (const x of [cx - 4, cx + 3]) px(ctx, x, top + 10, 1, H - top - 12, '#a87a46')
  for (let y = top + 12; y < H - 3; y += 4) px(ctx, cx - 4, y, 8, 1, '#c49a62')
  // Platform with railing, little roof, and the alarm bell.
  px(ctx, PAD, top + 8, W - PAD * 2, 3, '#5a3a22')
  for (let x = PAD + 1; x < W - PAD; x += 3) px(ctx, x, top, 1, 8, '#7a5232')
  px(ctx, PAD, top, W - PAD * 2, 1, '#7a5232')
  ellipse(ctx, cx, top - 4, 3, 3, '#c9a040')
  px(ctx, cx - 3, top - 4, 6, 4, '#c9a040')
  dot(ctx, cx - 2, top - 5, '#fff0a0')
  for (const x of [PAD + 3, W - PAD - 6]) px(ctx, x, top - 12, 2, 12, '#5a3a22')
  tileRoof(ctx, 0, W - 1, 6, top - 10, 6)
  return finish(img, { windows: [], lamps: [] })
}

// ---------- Kame House ----------

export function kamehouse(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 20)
  const windows: Rect[] = []
  const eave = H - 34
  const pink = '#f4a6bc'
  const pinkD = '#d880a0'
  px(ctx, PAD + 3, eave, W - PAD * 2 - 6, H - eave - 3, pink)
  px(ctx, W - PAD - 9, eave, 6, H - eave - 3, pinkD)
  // Round-topped windows with white frames.
  for (const x of [PAD + 8, W - PAD - 22]) {
    px(ctx, x, eave + 8, 12, 12, '#f8f6f0')
    px(ctx, x + 2, eave + 10, 8, 8, '#5aa0c8')
    px(ctx, x + 2, eave + 13, 8, 1, '#f8f6f0')
    px(ctx, x + 5, eave + 10, 1, 8, '#f8f6f0')
    windows.push({ x: x + 2, y: eave + 10, w: 8, h: 8 })
  }
  px(ctx, doorX - 6, eave + 10, 12, H - eave - 13, '#8a4a2a')
  px(ctx, doorX - 6, eave + 10, 12, 2, '#6a3418')
  dot(ctx, doorX + 3, eave + 20, GOLD)
  // The sign: KAME HOUSE.
  const text = 'KAME HOUSE'
  const tw = textWidth(text)
  px(ctx, Math.round(W / 2 - tw / 2) - 2, eave + 2, tw + 4, 7, '#f8f6f0')
  pixelText(ctx, text, Math.round(W / 2 - tw / 2), eave + 3, VERM)
  // A lifebuoy by the door.
  ellipse(ctx, doorX + 13, eave + 18, 4, 4, '#f8f6f0')
  ellipse(ctx, doorX + 13, eave + 18, 2, 2, pinkD)
  dot(ctx, doorX + 13, eave + 14, VERM)
  dot(ctx, doorX + 13, eave + 22, VERM)
  // Red hipped roof.
  for (let y = 6; y <= eave + 2; y++) {
    const t = (y - 6) / (eave - 4)
    const half = Math.round(12 + t * (W / 2 - 12))
    for (let x = Math.round(W / 2) - half; x <= Math.round(W / 2) + half; x++) {
      const shade = x > W / 2 + half * 0.5 ? '#a82a1e' : (x + y) % 5 === 0 ? '#e85a48' : VERM
      dot(ctx, x, y, y >= eave + 1 ? '#7a1a12' : shade)
    }
  }
  px(ctx, Math.round(W / 2) - 12, 4, 24, 3, '#a82a1e')
  return finish(img, { windows, lamps: [{ x: doorX, y: eave + 8, r: 26, color: '#ffc070', hours: [1080, 1320] }] })
}
