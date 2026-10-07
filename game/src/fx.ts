// Small ambient life: chimney smoke and brewery steam, water ripples and splashes, grain, fireflies
// at night, butterflies by day, and the odd fish jumping in the river.

import { dot, ellipse, px, type Ctx } from './engine/pixel'
import { rng } from './engine/rng'
import { idx, T, TILE, type World } from './world/layout'

interface Puff {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: string
}

interface Ring {
  x: number
  y: number
  age: number
  life: number
  max: number
}

interface Bug {
  x: number
  y: number
  hx: number
  hy: number
  phase: number
  speed: number
}

export class Fx {
  private puffs: Puff[] = []
  private rings: Ring[] = []
  private fireflies: Bug[] = []
  private butterflies: Bug[] = []
  private grains: Puff[] = []
  private r = rng(4711)
  private fishT = 2

  constructor(world: World) {
    // Fireflies live near water; butterflies near flowers and fields.
    const near: { x: number; y: number }[] = []
    for (let y = 2; y < world.h - 2; y++)
      for (let x = 2; x < world.w - 2; x++) {
        const t = world.tiles[idx(x, y)]
        if (t !== T.Grass) continue
        const wet = [world.tiles[idx(x + 1, y)], world.tiles[idx(x - 1, y)], world.tiles[idx(x, y + 1)], world.tiles[idx(x, y - 1)]].some(
          (n) => n === T.Water || n === T.Paddy,
        )
        if (wet) near.push({ x, y })
      }
    for (let i = 0; i < 46; i++) {
      const t = near[Math.floor(this.r() * near.length)]
      const x = t.x * TILE + this.r() * TILE
      const y = t.y * TILE + this.r() * TILE
      this.fireflies.push({ x, y, hx: x, hy: y, phase: this.r() * 10, speed: 0.4 + this.r() * 0.6 })
    }
    const flowers = world.props.filter((p) => p.kind === 'hydrangea' || p.kind === 'iris')
    for (let i = 0; i < 9; i++) {
      const p = flowers[Math.floor(this.r() * flowers.length)]
      const x = p.x * TILE + 8
      const y = p.y * TILE
      this.butterflies.push({ x, y, hx: x, hy: y, phase: this.r() * 10, speed: 0.7 + this.r() * 0.6 })
    }
  }

  smoke(x: number, y: number, steam = false): void {
    this.puffs.push({
      x: x + (this.r() - 0.5) * 3,
      y,
      vx: 3 + this.r() * 3,
      vy: -8 - this.r() * 5,
      age: 0,
      life: 3 + this.r() * 1.5,
      size: 1.5 + this.r(),
      color: steam ? '#f4f4f0' : '#b8b0a8',
    })
  }

  ripple(x: number, y: number): void {
    this.rings.push({ x, y, age: 0, life: 1.1, max: 7 + this.r() * 3 })
  }

  splash(x: number, y: number): void {
    for (let i = 0; i < 3; i++) this.rings.push({ x: x + (this.r() - 0.5) * 6, y, age: -i * 0.15, life: 0.9, max: 9 })
    for (let i = 0; i < 6; i++)
      this.grains.push({ x, y: y - 2, vx: (this.r() - 0.5) * 40, vy: -30 - this.r() * 30, age: 0, life: 0.5, size: 1, color: '#cfe8f0' })
  }

  grain(x: number, y: number): void {
    this.grains.push({ x, y, vx: (this.r() - 0.5) * 30, vy: -10 - this.r() * 15, age: 0, life: 0.7, size: 1, color: '#f2d04a' })
  }

  update(dt: number, world: World, minutes: number, view: { x: number; y: number; w: number; h: number }): void {
    for (const p of this.puffs) {
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy *= 1 - dt * 0.3
      p.size += dt * 1.2
    }
    this.puffs = this.puffs.filter((p) => p.age < p.life)
    for (const r of this.rings) r.age += dt
    this.rings = this.rings.filter((r) => r.age < r.life)
    for (const g of this.grains) {
      g.age += dt
      g.x += g.vx * dt
      g.y += g.vy * dt
      g.vy += 120 * dt
    }
    this.grains = this.grains.filter((g) => g.age < g.life)

    // A fish jumps somewhere in view now and then.
    this.fishT -= dt
    if (this.fishT <= 0) {
      this.fishT = 3 + this.r() * 6
      for (let k = 0; k < 8; k++) {
        const x = Math.floor((view.x + this.r() * view.w) / TILE)
        const y = Math.floor((view.y + this.r() * view.h) / TILE)
        if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue
        if (world.tiles[idx(x, y)] !== T.Water) continue
        this.splash(x * TILE + 8, y * TILE + 10)
        break
      }
    }
    const t = performance.now() / 1000
    for (const f of this.fireflies) {
      f.x = f.hx + Math.sin(t * f.speed + f.phase) * 10 + Math.sin(t * 0.37 + f.phase * 2) * 6
      f.y = f.hy + Math.cos(t * f.speed * 0.8 + f.phase) * 6 - 6
    }
    for (const b of this.butterflies) {
      b.x = b.hx + Math.sin(t * b.speed * 0.6 + b.phase) * 18 + Math.sin(t * 2.3 + b.phase) * 3
      b.y = b.hy + Math.cos(t * b.speed * 0.5 + b.phase) * 10 - 10 + Math.abs(Math.sin(t * 6 + b.phase)) * 2
    }
    void minutes
  }

  /** Ground-level effects (under everything that stands). */
  drawGround(ctx: Ctx, camX: number, camY: number): void {
    for (const r of this.rings) {
      if (r.age < 0) continue
      const k = r.age / r.life
      const rad = 2 + k * r.max
      ctx.globalAlpha = (1 - k) * 0.8
      ctx.strokeStyle = '#d4ecf2'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(Math.round(r.x - camX) + 0.5, Math.round(r.y - camY) + 0.5, rad, rad * 0.45, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  /** Things in the air (above standing sprites). */
  drawAir(ctx: Ctx, camX: number, camY: number, day: boolean): void {
    for (const p of this.puffs) {
      const k = p.age / p.life
      ctx.globalAlpha = (1 - k) * 0.55
      ellipse(ctx, p.x - camX, p.y - camY, p.size, p.size * 0.8, p.color)
    }
    ctx.globalAlpha = 1
    for (const g of this.grains) dot(ctx, g.x - camX, g.y - camY, g.color)
    if (day) {
      const t = performance.now() / 1000
      for (const b of this.butterflies) {
        const flap = Math.sin(t * 18 + b.phase) > 0
        const x = Math.round(b.x - camX)
        const y = Math.round(b.y - camY)
        const c = b.phase > 5 ? '#f6f2e8' : '#f2d04a'
        if (flap) {
          px(ctx, x - 2, y - 1, 2, 2, c)
          px(ctx, x + 1, y - 1, 2, 2, c)
        } else px(ctx, x - 1, y - 1, 3, 1, c)
        dot(ctx, x, y, '#3d3449')
      }
    }
  }

  /** Fireflies: drawn after the night lighting so they glow. Also returned as lights. */
  fireflyLights(): { x: number; y: number; on: number }[] {
    const t = performance.now() / 1000
    return this.fireflies.map((f) => ({ x: f.x, y: f.y, on: Math.max(0, Math.sin(t * 2.2 * f.speed + f.phase * 3)) }))
  }
}
