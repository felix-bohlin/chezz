// Weather for the rainy season (tsuyu, June): dawn mist off the sea, overcast days, rain that comes
// and goes, the odd thunderstorm. Each day's plan is drawn from a seeded RNG, so day 1 always looks
// the same (mist at dawn, rain around midday). Press R to force a weather for a look.

import { canvas, type Ctx } from './engine/pixel'
import { hash, noise, rng } from './engine/rng'

export type WeatherMode = 'auto' | 'clear' | 'rain' | 'storm' | 'mist'
export const WEATHER_MODES: WeatherMode[] = ['auto', 'rain', 'storm', 'mist', 'clear']

interface Plan {
  /** Rain spells: [from, to) minutes, intensity. */
  rain: { from: number; to: number; level: number }[]
  /** Dawn mist strength (0–1). */
  mist: number
}

interface Drop {
  x: number
  y: number
  len: number
  speed: number
  /** Screen row where it hits the ground. */
  stop: number
}

export class Weather {
  rain = 0
  fog = 0
  cloud = 0
  wind = 0.35
  flash = 0
  mode: WeatherMode = 'auto'
  private plans = new Map<number, Plan>()
  private drops: Drop[] = []
  private splashes: { x: number; y: number; age: number }[] = []
  private fogTex: HTMLCanvasElement
  private r = rng(31337)
  private thunderIn = 0
  /** Set when lightning strikes; the game plays thunder a moment later. */
  thunder = false

  constructor() {
    this.fogTex = makeFog()
  }

  private plan(day: number): Plan {
    const hit = this.plans.get(day)
    if (hit) return hit
    let p: Plan
    if (day === 1) p = { rain: [{ from: 11 * 60, to: 15 * 60 + 30, level: 0.75 }], mist: 0.85 }
    else {
      const r = rng(day * 977 + 13)
      const rain: Plan['rain'] = []
      const spells = r() < 0.25 ? 0 : r() < 0.6 ? 1 : 2
      for (let i = 0; i < spells; i++) {
        const from = (5 + r() * 15) * 60
        rain.push({ from, to: from + (1.5 + r() * 5) * 60, level: 0.35 + r() * 0.65 })
      }
      p = { rain, mist: r() < 0.7 ? 0.5 + r() * 0.5 : 0.15 }
    }
    this.plans.set(day, p)
    return p
  }

  private targets(day: number, m: number): { rain: number; fog: number; cloud: number } {
    switch (this.mode) {
      case 'clear':
        return { rain: 0, fog: 0, cloud: 0 }
      case 'rain':
        return { rain: 0.7, fog: 0.15, cloud: 1 }
      case 'storm':
        return { rain: 1, fog: 0.1, cloud: 1 }
      case 'mist':
        return { rain: 0, fog: 0.9, cloud: 0.6 }
    }
    const p = this.plan(day)
    let rain = 0
    for (const s of p.rain) {
      if (m < s.from || m >= s.to) continue
      // Ease in and out over half an hour.
      const k = Math.min(1, (m - s.from) / 30, (s.to - m) / 30)
      rain = Math.max(rain, s.level * k)
    }
    // Dawn mist, thickest around 5:30, gone by 9; a thinner mist late at night.
    const dawn = Math.max(0, 1 - Math.abs(m - 330) / 200)
    const late = m > 1320 || m < 120 ? 0.25 : 0
    const fog = Math.max(p.mist * dawn, late * p.mist, rain * 0.2)
    const cloud = Math.min(1, 0.35 + rain * 1.2 + fog * 0.3)
    return { rain, fog, cloud }
  }

  update(dt: number, dmin: number, day: number, minutes: number): void {
    const t = this.targets(day, minutes)
    const k = this.mode === 'auto' ? Math.min(1, dmin / 15 + dt * 0.02) : Math.min(1, dt * 0.8)
    this.rain += (t.rain - this.rain) * k
    this.fog += (t.fog - this.fog) * k
    this.cloud += (t.cloud - this.cloud) * k
    this.wind = 0.3 + this.rain * 0.5 + Math.sin(performance.now() / 9000) * 0.1
    // Lightning in heavy rain.
    this.flash = Math.max(0, this.flash - dt * 3)
    this.thunder = false
    if (this.rain > 0.85) {
      this.thunderIn -= dt
      if (this.thunderIn <= 0) {
        this.flash = 1
        this.thunder = true
        this.thunderIn = 8 + this.r() * 20
      }
    }
  }

  cycle(): WeatherMode {
    this.mode = WEATHER_MODES[(WEATHER_MODES.indexOf(this.mode) + 1) % WEATHER_MODES.length]
    return this.mode
  }

  /** Ambient light multiplier for clouds and rain. */
  ambientTint(): [number, number, number] {
    const c = this.cloud
    return [1 - c * 0.3, 1 - c * 0.27, 1 - c * 0.2]
  }

  /** CSS colour grade for the world layer. */
  grade(): string {
    const q = (v: number) => Math.round(v * 50) / 50
    const sat = q(0.66 - this.cloud * 0.14)
    const bri = q(0.98 - this.rain * 0.06)
    return `saturate(${sat}) contrast(1.12) brightness(${bri}) sepia(0.14)`
  }

  /** Drifting mist, drawn over the world before the light map. */
  drawFog(ctx: Ctx, camX: number, camY: number, w: number, h: number, time: number): void {
    if (this.fog < 0.03) return
    const tex = this.fogTex
    const layers = [
      { k: 0.6, speed: 6, alpha: 0.5 },
      { k: 0.85, speed: 11, alpha: 0.35 },
    ]
    for (const l of layers) {
      const ox = Math.floor(((camX * l.k + time * l.speed * this.wind * 2) % tex.width) + tex.width) % tex.width
      const oy = Math.floor(((camY * l.k) % tex.height) + tex.height) % tex.height
      ctx.globalAlpha = Math.min(0.6, this.fog * l.alpha * 1.15)
      for (let y = -oy; y < h; y += tex.height) for (let x = -ox; x < w; x += tex.width) ctx.drawImage(tex, x, y)
    }
    ctx.globalAlpha = 1
  }

  /** Rain streaks and splashes in screen space. */
  drawRain(ctx: Ctx, w: number, h: number, dt: number): void {
    const want = Math.round(this.rain * (w * h) / 170)
    while (this.drops.length < want) this.drops.push(this.newDrop(w, h, true))
    if (this.drops.length > want) this.drops.length = want
    if (!want && !this.splashes.length) return
    const slant = this.wind * 0.6
    ctx.fillStyle = '#c4ced8'
    for (const d of this.drops) {
      d.y += d.speed * dt
      d.x += d.speed * slant * dt
      if (d.y >= d.stop) {
        if (this.splashes.length < 200) this.splashes.push({ x: d.x, y: d.stop, age: 0 })
        Object.assign(d, this.newDrop(w, h, false))
        continue
      }
      ctx.globalAlpha = d.len > 7 ? 0.6 : 0.4
      for (let i = 0; i < d.len; i++) ctx.fillRect(Math.round(d.x - slant * i), Math.round(d.y - i), 1, 1)
    }
    ctx.globalAlpha = 0.6
    ctx.fillStyle = '#d4dee8'
    for (const s of this.splashes) {
      s.age += dt
      const x = Math.round(s.x)
      const y = Math.round(s.y)
      if (s.age < 0.08) ctx.fillRect(x, y - 1, 1, 1)
      else {
        ctx.fillRect(x - 1, y, 1, 1)
        ctx.fillRect(x + 1, y, 1, 1)
      }
    }
    this.splashes = this.splashes.filter((s) => s.age < 0.16)
    ctx.globalAlpha = 1
  }

  private newDrop(w: number, h: number, anywhere: boolean): Drop {
    const stop = this.r() * h
    return {
      x: this.r() * (w + 40) - 40 * this.wind,
      y: anywhere ? this.r() * stop : -10 - this.r() * 40,
      len: 4 + Math.floor(this.r() * 7),
      speed: 220 + this.r() * 120,
      stop,
    }
  }
}

/** Soft, dithered mist texture (tiles seamlessly enough at this scale). */
function makeFog(): HTMLCanvasElement {
  const W = 192
  const H = 128
  const [c, ctx] = canvas(W, H)
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // Wrap the noise so the texture tiles.
      const fx = (x / W) * 6
      const fy = (y / H) * 4
      const n =
        noise(fx, fy, 3) * (1 - x / W) * (1 - y / H) +
        noise(fx - 6, fy, 3) * (x / W) * (1 - y / H) +
        noise(fx, fy - 4, 3) * (1 - x / W) * (y / H) +
        noise(fx - 6, fy - 4, 3) * (x / W) * (y / H)
      const v = n * 0.7 + noise(x / 9, y / 7, 4) * 0.3
      // Stepped alpha with a dither so it reads as pixel art.
      let a = v < 0.42 ? 0 : v < 0.55 ? 0.35 : v < 0.68 ? 0.6 : 0.85
      if (a > 0 && (x + y) % 2 === 0 && hash(x, y, 5) < 0.3) a -= 0.25
      const o = (y * W + x) * 4
      img.data[o] = 214
      img.data[o + 1] = 218
      img.data[o + 2] = 222
      img.data[o + 3] = Math.max(0, a) * 255
    }
  ctx.putImageData(img, 0, 0)
  return c
}
