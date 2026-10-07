// Day/night: the scene is multiplied by a light map — the ambient colour of the hour, plus warm
// pools around lanterns, windows, the brazier and fireflies. Light pools are stepped rings rather
// than smooth gradients so they stay pixel-art.

import { canvas, hexRgb, type Ctx } from './engine/pixel'

type RGB = [number, number, number]

const NIGHT: RGB = [58, 66, 124]
const KEYS: [number, RGB][] = [
  [0, NIGHT],
  [270, NIGHT],
  [330, [140, 118, 162]],
  [375, [255, 192, 168]],
  [450, [255, 255, 255]],
  [1020, [255, 255, 255]],
  [1095, [255, 204, 160]],
  [1140, [206, 136, 150]],
  [1200, [96, 96, 160]],
  [1290, NIGHT],
  [1440, NIGHT],
]

export function ambientAt(minutes: number): RGB {
  for (let i = 1; i < KEYS.length; i++) {
    const [m1, c1] = KEYS[i]
    const [m0, c0] = KEYS[i - 1]
    if (minutes <= m1) {
      const t = (minutes - m0) / (m1 - m0)
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t]
    }
  }
  return NIGHT
}

/** 0 at noon, ~0.6 at midnight. */
export function darknessAt(minutes: number): number {
  const [r, g, b] = ambientAt(minutes)
  return 1 - (r + g + b) / (3 * 255)
}

const texCache = new Map<string, HTMLCanvasElement>()

function lightTexture(radius: number, color: string): HTMLCanvasElement {
  const r = Math.max(4, Math.round(radius))
  const key = `${r}|${color}`
  const hit = texCache.get(key)
  if (hit) return hit
  const [c, ctx] = canvas(r * 2, r * 2)
  const img = ctx.createImageData(r * 2, r * 2)
  const [cr, cg, cb] = hexRgb(color)
  for (let y = 0; y < r * 2; y++)
    for (let x = 0; x < r * 2; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r
      if (d >= 1) continue
      // Four stepped rings, with a 1-in-2 dither on each ring edge.
      const ring = Math.floor(d * 4)
      const edge = d * 4 - ring > 0.82 && (x + y) % 2 === 0 ? 1 : 0
      const k = [1, 0.66, 0.4, 0.18][Math.min(3, ring + edge)]
      const o = (y * r * 2 + x) * 4
      img.data[o] = cr * k
      img.data[o + 1] = cg * k
      img.data[o + 2] = cb * k
      img.data[o + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  texCache.set(key, c)
  return c
}

export class Lighting {
  private map: HTMLCanvasElement
  private ctx: Ctx

  constructor() {
    ;[this.map, this.ctx] = canvas(16, 16)
  }

  begin(w: number, h: number, ambient: RGB): void {
    if (this.map.width !== w || this.map.height !== h) {
      this.map.width = w
      this.map.height = h
    }
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.fillStyle = `rgb(${ambient.map(Math.round).join(',')})`
    this.ctx.fillRect(0, 0, w, h)
    this.ctx.globalCompositeOperation = 'lighter'
  }

  add(x: number, y: number, radius: number, color: string, strength = 1): void {
    if (strength <= 0.01) return
    const tex = lightTexture(radius, color)
    this.ctx.globalAlpha = Math.min(1, strength)
    this.ctx.drawImage(tex, Math.round(x - tex.width / 2), Math.round(y - tex.height / 2))
    this.ctx.globalAlpha = 1
  }

  apply(target: Ctx): void {
    target.globalCompositeOperation = 'multiply'
    target.drawImage(this.map, 0, 0)
    target.globalCompositeOperation = 'source-over'
  }
}
