// Villagers as procedural paper dolls: head, hair or hat, kimono, sash, legs, plus extras (armour,
// apron, yamabushi pom-poms, the peddler's box, a sashimono banner) and a tool for the job at hand.
// Drawn facing down, up and left (right is the mirror), 4 walk frames, then outlined in ink.
//
// Local body box is 16×24 with the feet on row 22; it sits at (OX, OY) inside a 32×34 canvas so
// fishing rods, hoes and banners have room to stick out.

import { canvas, dot, ellipse, flipX, outline, px, type Ctx } from '../engine/pixel'
import type { Dir } from '../world/layout'
import type { Look, Pose } from '../sim/cast'
import type { Sprite } from './sprite'

export type DrawPose = Pose | 'walk'

const W = 32
const H = 34
const OX = 8
const OY = 6
const FEET = 22

const SKIN = '#f2c9a0'
const SKIN_D = '#d49a72'
const SKIN_L = '#f8dcbc'
const EYE = '#2a1f2d'
const BLUSH = '#eaa088'
const HAIR = '#231c2b'
const HAIR_L = '#3d3449'
const STRAW = ['#9c7e36', '#c9a752', '#dcbe6a']
const STEEL = '#d8dee8'
const WOOD = '#8f6038'

const cache = new Map<string, Sprite>()

export function personSprite(id: string, look: Look, dir: Dir, pose: DrawPose, frame: number): Sprite {
  const key = `${id}|${dir}|${pose}|${frame}`
  const hit = cache.get(key)
  if (hit) return hit
  let img: HTMLCanvasElement
  if (dir === 'right') img = flipX(personSprite(id, look, 'left', pose, frame).img)
  else {
    const [c, ctx] = canvas(W, H)
    drawPerson(ctx, look, dir, pose, frame)
    outline(c, '#1a1220')
    img = c
  }
  const s = { img, ax: OX + 8, ay: OY + FEET + 1 }
  cache.set(key, s)
  return s
}

/** Big front-facing portrait for the dialogue box. */
export function portrait(id: string, look: Look): HTMLCanvasElement {
  return personSprite(id, look, 'down', 'stand', 0).img
}

function drawPerson(ctx: Ctx, look: Look, view: 'down' | 'up' | 'left', pose: DrawPose, frame: number): void {
  const kid = !!look.kid
  const sitting = pose === 'sit' || pose === 'nap' || pose === 'meditate'
  const bend = pose === 'plant'
  const walking = pose === 'walk' || pose === 'play' || pose === 'carry' || pose === 'serve'
  const step = walking ? frame % 4 : 0
  const bob = walking && step % 2 === 1 ? 1 : 0
  const extras = new Set(look.extras ?? [])

  const headTop0 = kid ? 8 : 4
  const bodyTop0 = headTop0 + 8
  const sitDY = sitting ? (kid ? 2 : 3) : 0
  const upperDY = bob + sitDY + (bend ? 2 : 0)
  const headTop = headTop0 + upperDY + (pose === 'nap' && view !== 'up' ? 1 : 0)
  const bodyTop = bodyTop0 + bob + sitDY + (bend ? 1 : 0)
  const hemBottom = 19 + (sitting ? sitDY - 1 : 0)
  const legs = look.legs ?? SKIN
  const robe = look.robe
  const shade = look.robeShade
  const collar = look.collar ?? '#f1e6cc'

  const P = (x: number, y: number, w: number, h: number, c: string) => px(ctx, OX + x, OY + y, w, h, c)
  const D = (x: number, y: number, c: string) => dot(ctx, OX + x, OY + y, c)
  const side = view === 'left'

  // ---- behind the body ----
  if (view !== 'up') {
    if (extras.has('banner')) {
      const px0 = side ? 10 : 12
      P(px0, headTop - 7, 1, bodyTop - headTop + 9, '#5a3a22')
      P(px0 + 1, headTop - 7, 4, 7, '#2f3f73')
      D(px0 + 2, headTop - 5, '#f4f1ea')
      D(px0 + 3, headTop - 4, '#f4f1ea')
    }
    if (extras.has('backpack')) {
      if (side) {
        P(10, headTop + 1, 4, bodyTop - headTop + 6, '#7a5232')
        P(10, headTop + 1, 4, 1, '#a87a46')
        P(10, headTop + 6, 4, 1, '#4a2e1a')
        P(10, headTop + 11, 4, 1, '#4a2e1a')
      } else {
        P(1, headTop + 2, 2, bodyTop - headTop + 4, '#7a5232')
        P(13, headTop + 2, 2, bodyTop - headTop + 4, '#7a5232')
        P(2, headTop - 1, 12, 3, '#7a5232')
        P(2, headTop - 1, 12, 1, '#a87a46')
      }
    }
  }

  // ---- legs ----
  if (!sitting) {
    const foot = (x: number, y: number, w = 2) => P(x, y, w, 1, '#3d3449')
    if (side) {
      if (step === 1) {
        P(4, 20, 2, 2, legs)
        foot(3, FEET, 3)
        P(9, 20, 2, 2, legs)
        foot(9, FEET)
      } else if (step === 3) {
        P(5, 20, 2, 2, legs)
        foot(4, FEET, 3)
        P(8, 20, 2, 2, legs)
        foot(8, FEET)
      } else {
        P(6, 20, 3, 2, legs)
        foot(5, FEET, 4)
      }
    } else {
      const liftL = step === 1 ? 1 : 0
      const liftR = step === 3 ? 1 : 0
      P(5, 20, 2, 2 - liftL, legs)
      foot(5, FEET - liftL)
      P(9, 20, 2, 2 - liftR, legs)
      foot(9, FEET - liftR)
    }
  }

  // ---- torso ----
  const torso = (x0: number, w: number) => {
    P(x0, bodyTop, w, hemBottom - bodyTop + 1, robe)
    const obiY = kid ? bodyTop + 2 : bodyTop + 3
    P(x0, obiY, w, kid ? 1 : 2, look.sash)
    P(x0, hemBottom, w, 1, shade)
    return obiY
  }
  let obiY: number
  if (side) {
    obiY = torso(5, 6)
    D(5, bodyTop, collar)
    D(6, bodyTop + 1, collar)
    P(10, bodyTop, 1, hemBottom - bodyTop + 1, shade)
    if (sitting) P(3, hemBottom - 1, 8, 2, shade)
  } else {
    obiY = torso(4, 8)
    P(11, bodyTop, 1, hemBottom - bodyTop + 1, shade)
    if (view === 'down') {
      D(7, bodyTop, SKIN)
      D(8, bodyTop, SKIN)
      D(6, bodyTop, collar)
      D(9, bodyTop, collar)
      D(7, bodyTop + 1, collar)
      D(8, bodyTop + 1, collar)
      P(8, obiY + (kid ? 1 : 2), 1, hemBottom - obiY - (kid ? 1 : 2), shade)
    } else {
      P(6, bodyTop, 4, 1, collar)
      const bow = look.hair === 'bun' || look.hair === 'grayBun' || look.hair === 'kidGirl'
      if (bow) {
        P(5, obiY - 1, 6, 3, look.sash)
        D(5, obiY - 1, shade)
        D(10, obiY - 1, shade)
      }
    }
    if (sitting) P(3, hemBottom - 1, 10, 2, shade)
  }

  // ---- extras on the torso ----
  if (extras.has('armor') && view !== 'up') {
    const x0 = side ? 5 : 4
    const w = side ? 6 : 8
    P(x0, bodyTop, w, 4, '#2a2233')
    for (let y = bodyTop + 1; y < bodyTop + 4; y += 2) P(x0, y, w, 1, '#c0262f')
    if (!side) {
      P(2, bodyTop, 2, 2, '#2a2233')
      P(12, bodyTop, 2, 2, '#2a2233')
    }
  }
  if (extras.has('apron') && view === 'down') {
    P(5, obiY + 1, 6, hemBottom - obiY - 1, '#f4f1ea')
    P(5, hemBottom, 6, 1, '#d8d0bc')
  }
  if (extras.has('apron') && side) P(4, obiY + 1, 2, hemBottom - obiY - 1, '#f4f1ea')
  if (extras.has('happi') && view === 'down') {
    P(6, bodyTop, 1, hemBottom - bodyTop + 1, look.collar ?? '#2f3f73')
    P(9, bodyTop, 1, hemBottom - bodyTop + 1, look.collar ?? '#2f3f73')
  }
  if (extras.has('pompoms') && view !== 'up') {
    const xs = side ? [5] : [5, 9]
    for (const x of xs) {
      P(x, bodyTop + 1, 2, 2, '#d8506a')
      if (!kid) P(x, bodyTop + 5, 2, 2, '#d8506a')
    }
  }
  if (extras.has('creel')) {
    const x = side ? 9 : 11
    P(x, obiY + 1, 3, 3, STRAW[1])
    D(x, obiY + 1, STRAW[2])
    P(x, obiY + 3, 3, 1, STRAW[0])
  }

  // ---- arms (sleeves + hands), unless the pose holds something with them ----
  const handsBusy = ['chant', 'conch', 'call', 'serve', 'alms', 'carry', 'meditate', 'plant'].includes(pose)
  const sleeveRows = kid ? 3 : 4
  if (side) {
    if (!handsBusy) {
      const swing = walking ? (step === 1 ? -2 : step === 3 ? 2 : 0) : 0
      P(7, bodyTop, 2, sleeveRows, shade)
      D(7 + swing, bodyTop + sleeveRows, SKIN)
      if (swing) D(7 + swing / 2, bodyTop + sleeveRows - 1, shade)
    }
  } else if (!handsBusy) {
    const lift = walking ? [0, 1, 0, -1][step] : 0
    P(3, bodyTop, 1, sleeveRows, shade)
    P(12, bodyTop, 1, sleeveRows, shade)
    D(3, bodyTop + sleeveRows + Math.max(0, -lift) - Math.max(0, lift), view === 'up' ? SKIN_D : SKIN)
    D(12, bodyTop + sleeveRows + Math.max(0, lift) - Math.max(0, -lift), view === 'up' ? SKIN_D : SKIN)
    if (pose === 'play') {
      D(3, bodyTop - 1, SKIN)
      D(12, bodyTop - 1, SKIN)
    }
  }

  // ---- head ----
  drawHead(P, D, (x, y) => ctx.clearRect(OX + x, OY + y, 1, 1), look, view, headTop, pose)

  // ---- in front of the body ----
  if (view === 'up') {
    if (extras.has('backpack')) {
      P(3, headTop - 2, 10, bodyTop - headTop + 8, '#7a5232')
      P(3, headTop - 2, 10, 1, '#a87a46')
      for (let y = headTop + 2; y < bodyTop + 6; y += 4) P(4, y, 8, 1, '#4a2e1a')
      D(8, headTop + 4, '#e0b13c')
    }
    if (extras.has('banner')) {
      P(8, headTop - 7, 1, bodyTop - headTop + 8, '#5a3a22')
      P(9, headTop - 7, 4, 7, '#2f3f73')
      D(10, headTop - 5, '#f4f1ea')
    }
  }

  // ---- hands and tools ----
  const handY = bodyTop + sleeveRows
  const fwd = side ? -1 : 0 // facing left
  switch (pose) {
    case 'plant': {
      // Bent over the water, a bundle of seedlings in hand.
      if (side) {
        P(5, bodyTop + 1, 2, 4, shade)
        P(3, bodyTop + 5, 2, 1, SKIN)
        P(2, bodyTop + 6, 1, frame ? 3 : 2, '#68a548')
      } else {
        P(3, bodyTop + 1, 1, 4, shade)
        P(12, bodyTop + 1, 1, 4, shade)
        D(3, bodyTop + 5 + frame, SKIN)
        D(12, bodyTop + 5 + (1 - frame), SKIN)
        P(12, bodyTop + 6 + (1 - frame), 1, 2, '#68a548')
      }
      break
    }
    case 'hoe': {
      const up = frame === 0
      if (side) {
        if (up) {
          line(ctx, OX + 7, OY + handY, OX + 1, OY + headTop - 3, WOOD)
          P(-1, headTop - 5, 3, 2, STEEL)
        } else {
          line(ctx, OX + 6, OY + handY, OX + 0, OY + FEET - 1, WOOD)
          P(-2, FEET - 1, 3, 2, STEEL)
        }
        D(6, handY, SKIN)
      } else {
        const x = view === 'down' ? 13 : 2
        if (up) {
          P(x, headTop - 3, 1, handY - headTop + 4, WOOD)
          P(x - 1, headTop - 5, 3, 2, STEEL)
        } else {
          P(x, handY - 1, 1, FEET - handY + 1, WOOD)
          P(x - 1, FEET, 3, 1, STEEL)
        }
      }
      break
    }
    case 'sweep': {
      const sw = frame ? 1 : -1
      if (side) {
        line(ctx, OX + 7, OY + handY - 2, OX + 2 + sw, OY + FEET - 2, '#b59a5a')
        P(0 + sw, FEET - 2, 5, 3, STRAW[1])
        D(1 + sw, FEET - 2, STRAW[2])
      } else {
        line(ctx, OX + 12, OY + handY - 2, OX + 9 + sw * 2, OY + FEET - 1, '#b59a5a')
        P(7 + sw * 2, FEET - 1, 5, 2, STRAW[1])
      }
      break
    }
    case 'fish': {
      if (side) {
        D(6, handY - 1, SKIN)
        line(ctx, OX + 6, OY + handY - 1, OX - 7, OY + headTop - 4, '#a87a46')
        // Line and float, twitching.
        P(-7, headTop - 3, 1, 14, '#e8e0cc')
        D(-7, headTop + 11 + frame, '#d23c2a')
      } else {
        const x = view === 'down' ? 12 : 3
        P(x, headTop - 6, 1, handY - headTop + 6, '#a87a46')
      }
      break
    }
    case 'chant':
    case 'meditate': {
      if (side) {
        P(5, bodyTop, 2, 3, shade)
        P(4, bodyTop + (pose === 'meditate' ? 4 : 1), 1, 2, SKIN)
      } else if (view === 'down') {
        P(3, bodyTop, 1, 3, shade)
        P(12, bodyTop, 1, 3, shade)
        P(7, bodyTop + (pose === 'meditate' ? 4 : 1), 2, 2, SKIN)
      }
      break
    }
    case 'conch': {
      if (side) {
        P(5, bodyTop, 2, 2, shade)
        ellipse(ctx, OX + 3, OY + headTop + 6, 2.5, 1.8, '#f4e0c8')
        D(1, headTop + 6, '#d88a6a')
      } else if (view === 'down') {
        ellipse(ctx, OX + 8, OY + headTop + 7, 3, 2, '#f4e0c8')
        D(10, headTop + 7, '#d88a6a')
        D(5, headTop + 8, SKIN)
      }
      break
    }
    case 'call': {
      if (view === 'down') {
        D(5, headTop + 6, SKIN)
        D(10, headTop + 6, SKIN)
        P(3, bodyTop - 1, 1, 2, shade)
        P(12, bodyTop - 1, 1, 2, shade)
      } else if (side) {
        P(4, headTop + 5, 1, 2, SKIN)
        P(5, bodyTop - 1, 2, 2, shade)
      }
      break
    }
    case 'serve': {
      if (view === 'up') break
      const x0 = side ? -1 : 3
      P(x0, bodyTop + 2, side ? 6 : 10, 1, '#5a3a22')
      D(x0 + 1, bodyTop + 1, '#f4f1ea')
      D(x0 + 3, bodyTop + 1, '#f4f1ea')
      if (!side) D(x0 + 6, bodyTop + 1, '#f0a0b8')
      break
    }
    case 'alms': {
      if (view === 'down') {
        P(6, bodyTop + 2, 4, 2, '#2a2233')
        P(6, bodyTop + 2, 4, 1, '#4a4058')
        D(5, bodyTop + 3, SKIN)
        D(10, bodyTop + 3, SKIN)
      } else if (side) {
        P(2, bodyTop + 2, 4, 2, '#2a2233')
        D(5, bodyTop + 3, SKIN)
      }
      break
    }
    case 'carry': {
      if (view === 'up') break
      const x0 = side ? 0 : 3
      const y0 = bodyTop - 1
      P(x0, y0, 9, 7, STRAW[1])
      P(x0, y0, 2, 7, STRAW[2])
      P(x0, y0 + 2, 9, 1, '#7a5a2a')
      P(x0 + 3, y0 + 3, 3, 3, '#f4f1ea')
      D(x0 + 4, y0 + 4, '#c0262f')
      break
    }
    case 'feed': {
      if (side) {
        P(3, handY - 1, 4, 1, shade)
        D(2, handY - 1, SKIN)
        if (frame) for (const [x, y] of [[1, handY + 2], [0, handY + 4], [2, handY + 5]]) D(x, y, '#f2d04a')
      } else if (view === 'down') {
        P(12, bodyTop + 1, 2, 1, shade)
        D(14, bodyTop + 1, SKIN)
        if (frame) for (const [x, y] of [[14, bodyTop + 4], [13, bodyTop + 6], [15, bodyTop + 7]]) D(x, y, '#f2d04a')
      }
      break
    }
  }
  // The guard never lets go of his spear.
  if (extras.has('armor') && !['sit', 'nap'].includes(pose)) {
    const x = side ? 3 + fwd : view === 'down' ? 13 : 2
    P(x, headTop - 9, 1, FEET - headTop + 9, WOOD)
    P(x, headTop - 12, 1, 3, STEEL)
    D(x, headTop - 13, STEEL)
  }
}

type Plot = (x: number, y: number, w: number, h: number, c: string) => void
type Dot = (x: number, y: number, c: string) => void

function drawHead(P: Plot, D: Dot, clear: (x: number, y: number) => void, look: Look, view: 'down' | 'up' | 'left', top: number, pose: DrawPose): void {
  const side = view === 'left'
  const hair = look.hairColor ?? (look.hair === 'grayBun' ? '#c4bdb0' : HAIR)
  const hairL = look.hair === 'grayBun' ? '#e0dad0' : HAIR_L
  const x0 = side ? 4 : 4
  const w = side ? 7 : 8
  // Skull.
  P(x0, top, w, 8, SKIN)
  P(x0 + w - 1, top + 1, 1, 6, SKIN_D)
  P(x0 + 1, top + 7, w - 2, 1, SKIN_D)
  // Trim corners to round the head.
  for (const [x, y] of [
    [x0, top],
    [x0 + w - 1, top],
    [x0, top + 7],
    [x0 + w - 1, top + 7],
  ])
    clear(x, y)
  if (side) D(3, top + 5, SKIN) // nose

  // Face.
  const asleep = pose === 'nap' || pose === 'meditate' || pose === 'chant'
  if (view === 'down') {
    if (asleep) {
      P(5, top + 5, 2, 1, EYE)
      P(9, top + 5, 2, 1, EYE)
    } else {
      P(6, top + 4, 1, 2, EYE)
      P(9, top + 4, 1, 2, EYE)
    }
    D(5, top + 6, BLUSH)
    D(10, top + 6, BLUSH)
  } else if (side) {
    if (asleep) P(4, top + 5, 2, 1, EYE)
    else P(5, top + 4, 1, 2, EYE)
    D(6, top + 6, BLUSH)
  }

  // Hair.
  const H = (x: number, y: number, ww: number, hh: number) => P(x, y, ww, hh, hair)
  switch (look.hair) {
    case 'topknot':
      if (view === 'up') {
        H(4, top + 1, 8, 6)
        P(6, top, 4, 1, SKIN_L)
        P(7, top - 2, 2, 3, hair)
      } else if (side) {
        P(4, top, 4, 2, SKIN_L)
        H(8, top, 3, 6)
        H(7, top + 2, 1, 2)
        P(6, top - 2, 3, 2, hair)
        D(5, top - 1, hair)
      } else {
        P(5, top, 6, 2, SKIN_L)
        H(4, top, 1, 5)
        H(11, top, 1, 5)
        H(5, top + 2, 1, 1)
        H(10, top + 2, 1, 1)
        P(7, top - 2, 2, 2, hair)
        D(7, top - 2, hairL)
      }
      break
    case 'short':
      if (view === 'up') H(4, top, 8, 7)
      else if (side) {
        H(4, top, 7, 2)
        H(8, top, 3, 6)
      } else {
        H(4, top, 8, 3)
        H(4, top, 1, 5)
        H(11, top, 1, 5)
        D(6, top + 1, hairL)
      }
      break
    case 'bun':
    case 'grayBun':
      if (view === 'up') {
        H(4, top, 8, 7)
        H(5, top - 3, 6, 3)
        D(6, top - 2, hairL)
      } else if (side) {
        H(4, top, 7, 3)
        H(8, top, 3, 7)
        H(8, top - 3, 4, 3)
        D(11, top - 3, '#d23c2a')
      } else {
        H(4, top, 8, 3)
        H(4, top, 1, 6)
        H(11, top, 1, 6)
        H(5, top - 3, 6, 3)
        D(6, top - 2, hairL)
        D(11, top - 2, '#d23c2a')
        D(12, top - 3, '#e0b13c')
      }
      break
    case 'kidBoy':
      if (view === 'up') H(4, top, 8, 6)
      else if (side) {
        H(4, top, 7, 2)
        H(8, top, 3, 5)
      } else {
        H(4, top, 8, 2)
        H(4, top, 1, 4)
        H(11, top, 1, 4)
      }
      P(7, top - 1, 2, 1, hair)
      break
    case 'kidGirl':
      if (view === 'up') H(4, top, 8, 7)
      else if (side) {
        H(4, top, 7, 3)
        H(7, top, 4, 7)
      } else {
        H(4, top, 8, 4)
        H(4, top, 1, 7)
        H(11, top, 1, 7)
        D(6, top + 3, SKIN)
        D(9, top + 3, SKIN)
      }
      P(side ? 9 : 10, top - 1, 2, 2, '#d23c2a')
      break
    case 'bald':
      D(view === 'down' ? 6 : 5, top + 1, SKIN_L)
      break
  }

  // Hats.
  switch (look.hat) {
    case 'kasa': {
      const rows: [number, number][] = [
        [7, 2],
        [6, 4],
        [5, 6],
        [3, 10],
        [2, 12],
        [1, 14],
      ]
      rows.forEach(([x, ww], i) => P(x, top - 3 + i, ww, 1, i === 3 ? STRAW[0] : i < 2 ? STRAW[2] : STRAW[1]))
      if (view === 'down') P(4, top + 3, 8, 1, SKIN_D)
      break
    }
    case 'jingasa': {
      const rows: [number, number][] = [
        [7, 2],
        [5, 6],
        [3, 10],
        [2, 12],
      ]
      rows.forEach(([x, ww], i) => P(x, top - 2 + i, ww, 1, i === 0 ? '#4a4058' : '#2a2233'))
      P(4, top - 1, 3, 1, '#4a4058')
      if (view !== 'up') P(7, top - 1, 2, 1, '#e0b13c')
      break
    }
    case 'tokin':
      P(side ? 5 : 7, top - 1, 2, 2, '#1a1220')
      D(side ? 5 : 7, top - 1, '#3d3449')
      break
    case 'hachimaki':
      P(4, top + 2, side ? 7 : 8, 1, '#f4f1ea')
      if (side) {
        D(11, top + 2, '#f4f1ea')
        D(12, top + 3, '#f4f1ea')
      } else if (view === 'up') {
        P(7, top + 3, 2, 2, '#f4f1ea')
      }
      break
    case 'tenugui': {
      const cloth = look.hair === 'grayBun' ? '#7a6a9a' : '#5a74a8'
      if (side) {
        P(4, top - 1, 7, 3, cloth)
        P(10, top + 2, 2, 2, cloth)
      } else {
        P(4, top - 1, 8, 3, cloth)
        if (view === 'down') P(7, top - 2, 2, 1, cloth)
        else P(6, top + 2, 4, 2, cloth)
      }
      D(side ? 6 : 6, top, '#f4f1ea')
      D(side ? 9 : 10, top + 1, '#f4f1ea')
      break
    }
  }
}

/** Bresenham line in sprite space. */
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string): void {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    dot(ctx, x0, y0, c)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}
