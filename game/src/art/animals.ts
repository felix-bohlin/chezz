// Animals, side-on (facing left; right is the mirror) like Stardew's farm animals.

import { canvas, dot, ellipse, flipX, outline, px, type Ctx } from '../engine/pixel'
import type { Sprite } from './sprite'

export type AnimalKind = 'hen' | 'henBrown' | 'rooster' | 'chick' | 'duck' | 'duckling' | 'dog' | 'cat' | 'ox' | 'crow' | 'frog' | 'gull' | 'deer' | 'rat'
export type AnimalFrame = 'stand' | 'walk1' | 'walk2' | 'peck' | 'flap' | 'sit' | 'sleep' | 'swim' | 'fly1' | 'fly2' | 'eat' | 'wag'

const INK = '#1a1220'
const cache = new Map<string, Sprite>()

export function animalSprite(kind: AnimalKind, frame: AnimalFrame, faceRight: boolean): Sprite {
  const key = `${kind}|${frame}|${faceRight}`
  const hit = cache.get(key)
  if (hit) return hit
  let s: Sprite
  if (faceRight) {
    const base = animalSprite(kind, frame, false)
    s = { img: flipX(base.img), ax: base.img.width - base.ax, ay: base.ay }
  } else s = draw(kind, frame)
  cache.set(key, s)
  return s
}

function make(w: number, h: number, ax: number, ay: number, body: (ctx: Ctx) => void, ink = INK): Sprite {
  const [c, ctx] = canvas(w, h)
  body(ctx)
  outline(c, ink)
  return { img: c, ax, ay }
}

function draw(kind: AnimalKind, frame: AnimalFrame): Sprite {
  switch (kind) {
    case 'hen':
    case 'henBrown':
    case 'rooster':
      return chicken(kind, frame)
    case 'chick':
      return make(8, 8, 4, 7, (ctx) => {
        const y = frame === 'walk1' ? 1 : 2
        ellipse(ctx, 4, y + 2, 2.5, 2.2, '#f6d84a')
        dot(ctx, 3, y + 1, '#fff2a0')
        dot(ctx, 2, y + 1, INK)
        dot(ctx, 1, y + 2, '#f2902a')
        if (frame !== 'sleep') {
          dot(ctx, 3, 6, '#f2902a')
          dot(ctx, 5, 6, '#f2902a')
        }
      })
    case 'duck':
    case 'duckling':
      return duck(kind === 'duckling', frame)
    case 'dog':
      return dog(frame)
    case 'cat':
      return cat(frame)
    case 'ox':
      return ox(frame)
    case 'crow':
      return crow(frame)
    case 'gull':
      return gull(frame)
    case 'rat':
      return rat(frame)
    case 'deer':
      return deer(frame)
    case 'frog':
      return make(8, 7, 4, 6, (ctx) => {
        ellipse(ctx, 4, 4, 3, 2, '#4f8a3a')
        ellipse(ctx, 3.5, 3.5, 2, 1.2, '#7cb05a')
        dot(ctx, 2, 2, '#f4f1ea')
        dot(ctx, 4, 2, '#f4f1ea')
        dot(ctx, 2, 2, INK)
        px(ctx, 1, 5, 2, 1, '#3f6a2e')
        px(ctx, 5, 5, 2, 1, '#3f6a2e')
      })
  }
}

function chicken(kind: 'hen' | 'henBrown' | 'rooster', frame: AnimalFrame): Sprite {
  const rooster = kind === 'rooster'
  const body = kind === 'hen' ? '#f6f2e8' : rooster ? '#b8562a' : '#b07a48'
  const shade = kind === 'hen' ? '#cfc8b8' : rooster ? '#8a3a1c' : '#8a5a32'
  const light = kind === 'hen' ? '#ffffff' : rooster ? '#e0843a' : '#d09a62'
  return make(18, 18, 9, 16, (ctx) => {
    const peck = frame === 'peck'
    const sleep = frame === 'sleep'
    const by = sleep ? 11 : 9
    // Tail.
    if (rooster) {
      px(ctx, 12, 3, 2, 6, '#1e3a2e')
      px(ctx, 14, 4, 2, 5, '#2a4a3a')
      px(ctx, 11, 2, 2, 2, '#1e3a2e')
      dot(ctx, 15, 3, '#3a6a4a')
    } else {
      px(ctx, 12, by - 4, 3, 4, shade)
      dot(ctx, 13, by - 4, body)
    }
    // Body.
    ellipse(ctx, 9, by, 5, 3.6, body)
    ellipse(ctx, 9, by + 1, 4.5, 2.5, shade)
    ellipse(ctx, 8.5, by - 0.5, 3.5, 2.2, body)
    // Wing.
    if (frame === 'flap') {
      px(ctx, 8, by - 6, 4, 4, light)
      px(ctx, 9, by - 7, 3, 1, light)
    } else px(ctx, 9, by - 1, 4, 2, shade)
    // Head.
    const hx = peck ? 3 : 5
    const hy = peck ? by + 2 : sleep ? by - 3 : by - 5
    px(ctx, hx, hy, 3, 3, rooster ? '#d8782a' : body)
    if (!peck && !sleep) px(ctx, hx + 1, hy + 3, 2, 2, rooster ? '#d8782a' : body)
    // Comb, beak, wattle, eye.
    px(ctx, hx, hy - 1, rooster ? 3 : 2, 1, '#d23c2a')
    if (rooster) dot(ctx, hx + 1, hy - 2, '#d23c2a')
    dot(ctx, hx - 1, hy + 1, '#f2b030')
    dot(ctx, hx, hy + 3, '#d23c2a')
    if (!sleep) dot(ctx, hx + 1, hy + 1, INK)
    // Legs.
    if (!sleep) {
      const a = frame === 'walk1' ? 1 : 0
      const b = frame === 'walk2' ? 1 : 0
      px(ctx, 8 - a, by + 3, 1, 3, '#f2902a')
      px(ctx, 10 + b, by + 3, 1, 3, '#f2902a')
    }
  })
}

function duck(baby: boolean, frame: AnimalFrame): Sprite {
  const s = baby ? 0.6 : 1
  const body = baby ? '#f6d84a' : '#f6f2e8'
  const shade = baby ? '#d8b83a' : '#cfc8b8'
  return make(18, 14, 9, 11, (ctx) => {
    const swim = frame === 'swim'
    const by = swim ? 9 : 8
    ellipse(ctx, 9, by, 6 * s, 3 * s, body)
    ellipse(ctx, 9.5, by + 1, 5 * s, 2 * s, shade)
    px(ctx, Math.round(9 + 5 * s), by - Math.round(2 * s), 2, 2, body) // tail
    const hx = Math.round(9 - 5 * s)
    const hy = Math.round(by - 5 * s)
    ellipse(ctx, hx + 1, hy + 1, 2.2 * s + 0.5, 2 * s + 0.5, body)
    px(ctx, hx - 2, hy + 1, 2, 1, '#f2902a')
    dot(ctx, hx, hy, INK)
    if (!swim && frame !== 'sleep') {
      px(ctx, 8, by + 3, 1, 2, '#f2902a')
      px(ctx, 10, by + 3, 1, 2, '#f2902a')
    }
  })
}

function dog(frame: AnimalFrame): Sprite {
  const fur = '#d08a3a'
  const furD = '#a86a2a'
  const cream = '#f4e4c8'
  return make(22, 18, 11, 16, (ctx) => {
    if (frame === 'sleep') {
      ellipse(ctx, 11, 12, 7, 4, fur)
      ellipse(ctx, 11, 13, 6, 2.5, furD)
      ellipse(ctx, 6, 11, 3, 2.5, fur) // head tucked
      px(ctx, 4, 12, 3, 1, cream)
      px(ctx, 5, 9, 1, 2, fur)
      px(ctx, 14, 9, 4, 3, cream) // tail curl
      dot(ctx, 3, 11, INK)
      return
    }
    const sit = frame === 'sit' || frame === 'wag'
    // Body.
    if (sit) {
      ellipse(ctx, 12, 11, 4, 4, fur)
      px(ctx, 8, 12, 3, 3, cream)
      px(ctx, 14, 14, 4, 2, furD)
    } else {
      px(ctx, 6, 8, 11, 5, fur)
      px(ctx, 7, 11, 9, 2, cream)
      px(ctx, 15, 8, 2, 4, furD)
    }
    // Legs.
    if (!sit) {
      const a = frame === 'walk1' ? 1 : 0
      const b = frame === 'walk2' ? 1 : 0
      px(ctx, 7 - a, 13, 2, 3, fur)
      px(ctx, 14 + b, 13, 2, 3, furD)
      dot(ctx, 7 - a, 15, cream)
    } else px(ctx, 8, 15, 4, 1, cream)
    // Curled tail, wagging.
    const tx = frame === 'wag' ? 17 : 16
    px(ctx, tx, sit ? 7 : 4, 3, 3, fur)
    dot(ctx, tx + 1, sit ? 8 : 5, cream)
    // Head with pointy ears.
    const hy = sit ? 2 : 3
    px(ctx, 3, hy + 2, 6, 5, fur)
    px(ctx, 1, hy + 5, 4, 2, cream)
    dot(ctx, 1, hy + 5, INK)
    px(ctx, 4, hy, 2, 2, fur)
    px(ctx, 7, hy, 2, 2, fur)
    dot(ctx, 4, hy + 1, furD)
    dot(ctx, 4, hy + 3, INK)
    px(ctx, 3, hy + 4, 2, 1, cream)
  })
}

function cat(frame: AnimalFrame): Sprite {
  const white = '#f4f1ea'
  const orange = '#e08a3a'
  const black = '#2a2233'
  return make(18, 14, 9, 12, (ctx) => {
    if (frame === 'sleep') {
      ellipse(ctx, 9, 9, 6, 3.5, white)
      px(ctx, 5, 7, 4, 3, orange)
      px(ctx, 11, 8, 3, 2, black)
      ellipse(ctx, 4, 9, 2.5, 2, white)
      dot(ctx, 3, 7, orange)
      dot(ctx, 5, 7, orange)
      px(ctx, 3, 9, 2, 1, black)
      px(ctx, 12, 11, 4, 1, orange) // tail wrapped round
      return
    }
    const sit = frame === 'sit'
    if (sit) {
      ellipse(ctx, 10, 9, 4, 3.5, white)
      px(ctx, 11, 7, 3, 3, orange)
      px(ctx, 12, 11, 4, 1, black)
    } else {
      px(ctx, 6, 6, 8, 4, white)
      px(ctx, 9, 6, 3, 2, orange)
      px(ctx, 12, 7, 2, 2, black)
      const a = frame === 'walk1' ? 1 : 0
      px(ctx, 6 + a, 10, 1, 2, white)
      px(ctx, 12 - a, 10, 1, 2, white)
      px(ctx, 14, 3, 1, 4, black) // tail up
    }
    // Head.
    const hy = sit ? 2 : 2
    px(ctx, 3, hy + 1, 5, 4, white)
    dot(ctx, 3, hy, orange)
    dot(ctx, 7, hy, black)
    px(ctx, 6, hy + 1, 2, 2, orange)
    dot(ctx, 4, hy + 2, '#5a8a4a')
    dot(ctx, 3, hy + 3, '#e8a0a0')
  })
}

function ox(frame: AnimalFrame): Sprite {
  const hide = '#3a2c24'
  const hideL = '#5a4638'
  return make(30, 22, 15, 20, (ctx) => {
    const eat = frame === 'eat'
    px(ctx, 9, 7, 16, 8, hide)
    px(ctx, 9, 7, 16, 2, hideL)
    px(ctx, 24, 8, 2, 6, '#2a2018')
    px(ctx, 25, 9, 1, 6, hide) // tail
    // Legs.
    const a = frame === 'walk1' ? 1 : 0
    for (const [x, d] of [
      [10, -a],
      [13, a],
      [20, -a],
      [23, a],
    ])
      px(ctx, x + d, 15, 2, 4, hide)
    // Head (down to the grass when eating).
    const hy = eat ? 11 : 5
    px(ctx, 3, hy, 7, 6, hide)
    px(ctx, 2, hy + 3, 4, 3, '#8a7060')
    dot(ctx, 2, hy + 4, INK)
    dot(ctx, 5, hy + 1, '#f4f1ea')
    dot(ctx, 5, hy + 1, INK)
    px(ctx, 6, hy - 2, 1, 2, '#e8e0cc') // horn
    px(ctx, 8, hy - 2, 1, 2, '#e8e0cc')
    px(ctx, 9, hy + 1, 2, 1, hideL)
  })
}

function crow(frame: AnimalFrame): Sprite {
  const black = '#1e1a24'
  const sheen = '#3a3a54'
  return make(16, 14, 8, 12, (ctx) => {
    if (frame === 'fly1' || frame === 'fly2') {
      const up = frame === 'fly1'
      ellipse(ctx, 8, 7, 4, 2, black)
      px(ctx, 3, 6, 2, 2, black)
      dot(ctx, 2, 7, '#5a5a6a')
      if (up) {
        px(ctx, 6, 2, 3, 4, black)
        px(ctx, 7, 1, 4, 2, sheen)
      } else {
        px(ctx, 6, 8, 3, 4, black)
        px(ctx, 7, 11, 4, 1, sheen)
      }
      px(ctx, 12, 6, 3, 2, black)
      return
    }
    const peck = frame === 'peck'
    ellipse(ctx, 8, 8, 4, 2.6, black)
    px(ctx, 9, 7, 3, 1, sheen)
    px(ctx, 11, 7, 4, 2, black)
    const hx = peck ? 3 : 4
    const hy = peck ? 8 : 4
    px(ctx, hx, hy, 3, 3, black)
    px(ctx, hx - 2, hy + 1, 2, 1, '#4a4a5a')
    dot(ctx, hx, hy, '#8a8aa0')
    px(ctx, 7, 11, 1, 2, '#3a3a40')
    px(ctx, 9, 11, 1, 2, '#3a3a40')
  })
}

function gull(frame: AnimalFrame): Sprite {
  const white = '#f6f4ee'
  const grey = '#a9b4bc'
  return make(22, 14, 11, 12, (ctx) => {
    if (frame === 'fly1' || frame === 'fly2') {
      const up = frame === 'fly1'
      ellipse(ctx, 11, 7, 4, 2, white)
      px(ctx, 5, 6, 2, 2, white)
      dot(ctx, 4, 7, '#f2b030')
      if (up) {
        for (let i = 0; i < 8; i++) {
          dot(ctx, 10 - i, 5 - Math.floor(i / 2), grey)
          dot(ctx, 12 + i, 5 - Math.floor(i / 2), grey)
        }
        dot(ctx, 3, 1, '#2a2233')
        dot(ctx, 19, 1, '#2a2233')
      } else {
        for (let i = 0; i < 8; i++) {
          dot(ctx, 10 - i, 7 + Math.floor(i / 3), grey)
          dot(ctx, 12 + i, 7 + Math.floor(i / 3), grey)
        }
      }
      px(ctx, 15, 7, 3, 1, white)
      return
    }
    const peck = frame === 'peck'
    ellipse(ctx, 11, 8, 5, 3, white)
    px(ctx, 11, 6, 6, 3, grey)
    px(ctx, 16, 7, 2, 2, '#2a2233')
    const hx = peck ? 5 : 6
    const hy = peck ? 8 : 3
    px(ctx, hx, hy, 4, 4, white)
    dot(ctx, hx + 1, hy + 1, '#1a1220')
    px(ctx, hx - 2, hy + 2, 2, 1, '#f2b030')
    if (frame !== 'sleep') {
      const a = frame === 'walk1' ? 1 : 0
      px(ctx, 10 - a, 11, 1, 2, '#f2902a')
      px(ctx, 12 + a, 11, 1, 2, '#f2902a')
    }
  })
}

function deer(frame: AnimalFrame): Sprite {
  const coat = '#a8703c'
  const dark = '#7a4a26'
  const spot = '#f0d8b0'
  return make(24, 22, 12, 20, (ctx) => {
    const bow = frame === 'peck'
    const eat = frame === 'eat'
    px(ctx, 7, 9, 12, 6, coat)
    px(ctx, 7, 13, 12, 2, dark)
    for (const [x, y] of [
      [9, 10],
      [12, 11],
      [15, 10],
      [17, 12],
    ])
      dot(ctx, x, y, spot)
    px(ctx, 18, 9, 2, 3, '#f8f6f0') // white tail
    const a = frame === 'walk1' ? 1 : 0
    const b = frame === 'walk2' ? 1 : 0
    for (const [x, d] of [
      [8, -a],
      [10, b],
      [16, -b],
      [18, a],
    ])
      px(ctx, x + d, 15, 1, 5, dark)
    // Neck and head; it bows (a Nara deer habit) or grazes.
    const hy = bow ? 8 : eat ? 13 : 2
    const hx = bow ? 3 : 4
    px(ctx, 6, Math.min(hy + 3, 9), 3, Math.abs(9 - hy - 3) + 2, coat)
    px(ctx, hx, hy + 1, 5, 4, coat)
    px(ctx, hx - 1, hy + 3, 2, 2, dark)
    dot(ctx, hx + 1, hy + 2, '#1a1220')
    px(ctx, hx + 3, hy - 1, 1, 2, dark) // ear
    // Small antlers.
    px(ctx, hx + 2, hy - 3, 1, 3, '#e8dcc0')
    dot(ctx, hx + 1, hy - 3, '#e8dcc0')
    dot(ctx, hx + 3, hy - 4, '#e8dcc0')
  })
}

function rat(frame: AnimalFrame): Sprite {
  const fur = '#4a3f3a'
  const light = '#6a5d54'
  return make(14, 7, 7, 6, (ctx) => {
    const lift = frame === 'walk1' ? 1 : 0
    // Long bare tail curling off to the right.
    px(ctx, 9, 4, 3, 1, '#a07a74')
    px(ctx, 12, 3 - lift, 2, 1, '#a07a74')
    ellipse(ctx, 6.5, 3.5 - lift * 0.5, 3.5, 2, fur)
    px(ctx, 5, 2 - lift, 3, 1, light)
    // Pointy head, pink nose, ear, eye.
    px(ctx, 1, 3, 3, 2, fur)
    dot(ctx, 0, 4, '#c08a8a')
    dot(ctx, 4, 1, '#8a6a64')
    dot(ctx, 2, 3, '#e05040')
    // Feet.
    if (frame !== 'sit') {
      dot(ctx, frame === 'walk2' ? 3 : 4, 5, '#a07a74')
      dot(ctx, frame === 'walk2' ? 8 : 7, 5, '#a07a74')
    }
  })
}
