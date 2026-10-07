// Kame, Master Roshi's errand turtle: green dome shell, sleepy eyes, and Roshi's spare red bandana.
// Facing down / up / left (right mirrors left). Modes: walking, swimming (only the dome above
// water), hiding (head and legs pulled in).

import { canvas, dot, ellipse, flipX, outline, px, type Ctx } from '../engine/pixel'
import type { Dir } from '../world/layout'
import type { Sprite } from './sprite'

export type TurtleMode = 'walk' | 'swim' | 'hide'

const SHELL = '#5f7f3a'
const SHELL_D = '#425e26'
const SHELL_L = '#86a650'
const SHELL_H = '#a8c46a'
const RIM = '#c9b060'
const RIM_D = '#9c8440'
const SKIN = '#a4c470'
const SKIN_D = '#78964a'
const EYE = '#1a1220'
const SCARF = '#d23c2a'
const SCARF_D = '#a32a1e'

const W = 22
const H = 18
const cache = new Map<string, Sprite>()

export function turtleSprite(dir: Dir, mode: TurtleMode, frame: number): Sprite {
  const key = `${dir}|${mode}|${frame}`
  const hit = cache.get(key)
  if (hit) return hit
  let img: HTMLCanvasElement
  if (dir === 'right') img = flipX(turtleSprite('left', mode, frame).img)
  else {
    const [c, ctx] = canvas(W, H)
    if (dir === 'left') side(ctx, mode, frame)
    else if (dir === 'down') front(ctx, mode, frame)
    else back(ctx, mode, frame)
    outline(c, '#1a2410')
    img = c
  }
  const s = { img, ax: 11, ay: 16 }
  cache.set(key, s)
  return s
}

function dome(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, top: boolean): void {
  ellipse(ctx, cx, cy, rx, ry, SHELL)
  ellipse(ctx, cx - 1, cy - 1, rx - 2, ry - 1.6, SHELL_L)
  ellipse(ctx, cx - 2, cy - 2, rx - 4.5, ry - 3.2, SHELL_H)
  // Scutes: a darker hex-ish grid.
  if (top) {
    px(ctx, cx - 1, cy - ry + 1, 1, ry * 2 - 2, SHELL_D)
    px(ctx, cx - rx + 2, cy, rx * 2 - 4, 1, SHELL_D)
    dot(ctx, cx - 4, cy - 2, SHELL_D)
    dot(ctx, cx + 3, cy - 2, SHELL_D)
    dot(ctx, cx - 4, cy + 2, SHELL_D)
    dot(ctx, cx + 3, cy + 2, SHELL_D)
  } else {
    px(ctx, cx - 3, cy - ry + 2, 1, ry, SHELL_D)
    px(ctx, cx + 2, cy - ry + 2, 1, ry, SHELL_D)
    px(ctx, cx - rx + 2, cy, rx * 2 - 3, 1, SHELL_D)
  }
}

function side(ctx: Ctx, mode: TurtleMode, frame: number): void {
  const swim = mode === 'swim'
  const hide = mode === 'hide'
  const f = frame % 4
  const by = hide ? 1 : 0
  // Legs (paddles when swimming).
  if (!hide) {
    if (swim) {
      px(ctx, 4 + (f % 2), 12, 3, 1, SKIN_D)
      px(ctx, 14 - (f % 2), 12, 3, 1, SKIN_D)
    } else {
      const a = f === 1 ? -1 : f === 3 ? 1 : 0
      px(ctx, 6 + a, 12, 3, 3, SKIN)
      px(ctx, 6 + a, 14, 3, 1, SKIN_D)
      px(ctx, 14 - a, 12, 3, 3, SKIN)
      px(ctx, 14 - a, 14, 3, 1, SKIN_D)
      dot(ctx, 18, 11, SKIN) // tail
    }
  }
  // Shell.
  dome(ctx, 12, 8 + by, 7, 5, false)
  px(ctx, 5, 11 + by, 14, 2, RIM)
  px(ctx, 5, 12 + by, 14, 1, RIM_D)
  if (hide) {
    ellipse(ctx, 5, 11 + by, 1.5, 1.2, '#2a2a1a')
    return
  }
  // Head, poking forward, with the bandana.
  const hb = swim ? 1 : f === 1 || f === 3 ? 1 : 0
  px(ctx, 1, 6 + hb, 5, 4, SKIN)
  px(ctx, 1, 9 + hb, 5, 1, SKIN_D)
  dot(ctx, 2, 7 + hb, EYE)
  dot(ctx, 3, 7 + hb, SKIN_D) // sleepy lid
  px(ctx, 5, 8 + hb, 2, 3, SCARF)
  dot(ctx, 6, 10 + hb, SCARF_D)
}

function front(ctx: Ctx, mode: TurtleMode, frame: number): void {
  const swim = mode === 'swim'
  const hide = mode === 'hide'
  const f = frame % 4
  if (!hide && !swim) {
    const a = f === 1 ? 1 : 0
    const b = f === 3 ? 1 : 0
    px(ctx, 3, 11 - a, 3, 3, SKIN)
    px(ctx, 3, 13 - a, 3, 1, SKIN_D)
    px(ctx, 16, 11 - b, 3, 3, SKIN)
    px(ctx, 16, 13 - b, 3, 1, SKIN_D)
  }
  if (swim) {
    px(ctx, 2 + (f % 2), 11, 3, 1, SKIN_D)
    px(ctx, 17 - (f % 2), 11, 3, 1, SKIN_D)
  }
  dome(ctx, 11, 7 + (hide ? 1 : 0), 8, 5.5, true)
  px(ctx, 4, 11 + (hide ? 1 : 0), 14, 2, RIM)
  if (hide) {
    ellipse(ctx, 11, 12, 2, 1, '#2a2a1a')
    return
  }
  // Head facing us.
  px(ctx, 8, 9, 6, 6, SKIN)
  px(ctx, 8, 14, 6, 1, SKIN_D)
  px(ctx, 9, 11, 1, 1, EYE)
  px(ctx, 12, 11, 1, 1, EYE)
  px(ctx, 9, 10, 1, 1, SKIN_D)
  px(ctx, 12, 10, 1, 1, SKIN_D)
  px(ctx, 10, 13, 2, 1, SKIN_D)
  px(ctx, 7, 14, 8, 2, SCARF)
  px(ctx, 10, 16, 2, 1, SCARF_D)
}

function back(ctx: Ctx, mode: TurtleMode, frame: number): void {
  const swim = mode === 'swim'
  const hide = mode === 'hide'
  const f = frame % 4
  if (!hide && !swim) {
    const a = f === 1 ? 1 : 0
    const b = f === 3 ? 1 : 0
    px(ctx, 3, 12 - a, 3, 3, SKIN)
    px(ctx, 16, 12 - b, 3, 3, SKIN)
    px(ctx, 10, 14, 2, 2, SKIN) // tail
  }
  if (swim) {
    px(ctx, 2 + (f % 2), 11, 3, 1, SKIN_D)
    px(ctx, 17 - (f % 2), 11, 3, 1, SKIN_D)
  }
  if (!hide) {
    px(ctx, 8, 1, 6, 4, SKIN)
    px(ctx, 8, 4, 6, 2, SCARF)
  }
  dome(ctx, 11, 8 + (hide ? 1 : 0), 8, 5.5, true)
  px(ctx, 4, 12 + (hide ? 1 : 0), 14, 2, RIM)
}
