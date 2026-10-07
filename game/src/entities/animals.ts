// Village animals. Each kind has a small brain:
//   hens, rooster, chicks — peck around the yard, flee from turtles/kids/dog, crowd round Ohana's
//     grain, go into the coop at dusk; the rooster crows at dawn.
//   ducks — a mother and ducklings in a line, paddling round the koi pond.
//   Pochi (shiba) — follows Taro; sleeps on the doorstep when the children are in.
//   Mike (calico cat) — moves between four favourite sunny spots and sleeps in each.
//   Benkei (ox) — grazes in his pen and moos.
//   crows — come for Gonbei's fresh seedlings while he plants, pull some up, scatter when chased.
//   frogs — only at night, by the paddies, saying "kero kero".
//   roof crows — sit on the ridges of the poorer roofs and the ruin, watching; take off when you pass.
//   rats — the harbour's real owners: out at dusk, in the rain and all night; scatter from turtles.

import { animalSprite, type AnimalFrame, type AnimalKind } from '../art/animals'
import type { Sprite } from '../art/sprite'
import { pick, rng, type Rng } from '../engine/rng'
import { areaTiles, findPath, tileFeet, tileOf } from '../world/grid'
import { idx, isWet, T, TILE, type Area, type Pt } from '../world/layout'
import type { Game } from '../game'
import type { Villager } from './villager'

type State = 'inside' | 'idle' | 'walk' | 'peck' | 'flee' | 'away' | 'flyIn' | 'flyOut' | 'sleep' | 'sit'

export class Animal {
  kind: AnimalKind
  name: string
  talk: string[]
  x: number
  y: number
  /** Height above the ground (flying crows). */
  z = 0
  faceRight = false
  visible = true
  state: State = 'idle'
  private t = 0
  tx = 0
  private ty = 0
  private path: Pt[] = []
  private walkDist = 0
  private r: Rng
  private lastNoise = -999
  private outsideFor = 0
  private stuck = 0
  /** Stable per-animal randomness (bedtime offsets etc.). */
  private jitter: number
  /** Where it belongs: an area (ducks, deer), or favourite places by time of day (cats: "night,morning,noon,afternoon"). */
  home = ''
  /** Chick → its hen; duckling → the duck ahead of it. */
  leader: Animal | null = null

  constructor(kind: AnimalKind, x: number, y: number, seed: number, name = '', talk: string[] = []) {
    this.kind = kind
    this.x = x
    this.y = y
    this.tx = x
    this.ty = y
    this.r = rng(seed)
    this.jitter = this.r()
    this.name = name
    this.talk = talk
  }

  get isChicken(): boolean {
    return this.kind === 'hen' || this.kind === 'henBrown' || this.kind === 'rooster'
  }

  get tile(): Pt {
    return tileOf(this.x, this.y)
  }

  inRect(a: Area): boolean {
    const t = this.tile
    return t.x >= a.x && t.y >= a.y && t.x < a.x + a.w && t.y < a.y + a.h
  }

  update(g: Game, dt: number, simDt: number): void {
    switch (this.kind) {
      case 'hen':
      case 'henBrown':
      case 'rooster':
        return this.chicken(g, dt, simDt)
      case 'chick':
        return this.follower(g, dt, simDt, 7, 26)
      case 'duck':
        return this.duck(g, dt, simDt)
      case 'duckling':
        return this.follower(g, dt, simDt, 9, 22)
      case 'dog':
        return this.dog(g, dt, simDt)
      case 'cat':
        return this.cat(g, dt, simDt)
      case 'ox':
        return this.ox(g, dt, simDt)
      case 'crow':
        return this.home ? this.roofCrow(g, dt) : this.crow(g, dt, simDt)
      case 'rat':
        return this.rat(g, dt, simDt)
      case 'frog':
        return this.frog(g, dt)
      case 'gull':
        return this.gull(g, dt)
      case 'deer':
        return this.deer(g, dt, simDt)
    }
  }

  // ---------- shared movement ----------

  private solid(g: Game, px: number, py: number): boolean {
    const tx = Math.floor(px / TILE)
    const ty = Math.floor(py / TILE)
    if (tx < 0 || ty < 0 || tx >= g.world.w || ty >= g.world.h) return true
    return !!g.grid.solidNpc[idx(tx, ty)]
  }

  /** Step toward (tx, ty) with axis-separated tile collision. Returns true when arrived. */
  private stepTo(g: Game, tx: number, ty: number, dist: number): boolean {
    const dx = tx - this.x
    const dy = ty - this.y
    const d = Math.hypot(dx, dy)
    if (d < 1) return true
    const s = Math.min(dist, d)
    const nx = this.x + (dx / d) * s
    const ny = this.y + (dy / d) * s
    let moved = false
    if (!this.solid(g, nx, this.y)) {
      this.x = nx
      moved = true
    }
    if (!this.solid(g, this.x, ny)) {
      this.y = ny
      moved = true
    }
    if (Math.abs(dx) > 0.3) this.faceRight = dx > 0
    this.walkDist += s
    this.stuck = moved ? 0 : this.stuck + 1
    return d <= dist
  }

  /** Follow an A* path (tile centres). Returns true when done. */
  private followPath(dist: number): boolean {
    while (dist > 0 && this.path.length) {
      const p = this.path[0]
      const dx = p.x - this.x
      const dy = p.y - this.y
      const d = Math.hypot(dx, dy)
      if (Math.abs(dx) > 0.3) this.faceRight = dx > 0
      if (d <= dist) {
        this.x = p.x
        this.y = p.y
        this.path.shift()
        dist -= d
        this.walkDist += d
      } else {
        this.x += (dx / d) * dist
        this.y += (dy / d) * dist
        this.walkDist += dist
        dist = 0
      }
    }
    return this.path.length === 0
  }

  private pathTo(g: Game, t: Pt): void {
    const p = findPath(g.world, g.grid, this.tile, t)
    this.path = p ? p.map(tileFeet) : []
    if (!p) {
      g.stats.pathFails++
      const f = tileFeet(t)
      this.x = f.x
      this.y = f.y
    }
  }

  private noise(g: Game, text: string, every: number, color?: string): void {
    if (g.time - this.lastNoise < every) return
    if (!g.onScreen(this.x, this.y)) return
    this.lastNoise = g.time
    g.speech.floater(this.x, this.y - 14, text, color)
  }

  // ---------- chickens ----------

  private chicken(g: Game, dt: number, simDt: number): void {
    const yard = g.world.areas.chickenYard
    const coop = tileFeet(g.world.places['door:coop'])
    const m = g.clock.minutes
    const bedtime = m >= 18 * 60 + 50 + this.jitter * 30 || m < 5 * 60 + 30 + this.jitter * 10
    if (this.state === 'inside') {
      if (!bedtime) {
        this.visible = true
        this.x = coop.x
        this.y = coop.y
        this.state = 'walk'
        this.pickYardTarget(g, yard)
        if (this.kind === 'rooster') this.noise(g, 'Kokekokkō!', 0, '#f2d04a')
      }
      return
    }
    if (bedtime) {
      if (!this.path.length) this.pathTo(g, g.world.places['door:coop'])
      if (this.followPath(18 * simDt)) {
        this.state = 'inside'
        this.visible = false
      }
      return
    }
    if (this.kind === 'rooster' && m > 5 * 60 + 30 && m < 8 * 60 && this.r() < dt * 0.04) this.noise(g, 'Kokekokkō!', 20, '#f2d04a')

    // Threats: the turtle (unless it's a rock right now), the children, the dog.
    const threat = this.nearestThreat(g)
    if (threat) {
      this.state = 'flee'
      this.t = 0.5 + this.r() * 0.5
      const dx = this.x - threat.x
      const dy = this.y - threat.y
      const d = Math.hypot(dx, dy) || 1
      this.tx = this.x + (dx / d) * 30 + (this.r() - 0.5) * 16
      this.ty = this.y + (dy / d) * 30 + (this.r() - 0.5) * 16
      this.path = []
      if (this.r() < dt * 3) this.noise(g, pick(this.r, ['Bok!', 'BOK BOK!', 'Bwak!']), 2)
    }
    const inYard = this.inRect(yard)
    this.outsideFor = inYard ? 0 : this.outsideFor + dt

    switch (this.state) {
      case 'flee':
        this.t -= dt
        this.stepTo(g, this.tx, this.ty, 46 * dt)
        if (this.t <= 0) this.state = 'idle'
        break
      case 'walk':
        if (this.path.length) {
          if (this.followPath(16 * simDt)) this.startPeck()
        } else if (this.stepTo(g, this.tx, this.ty, 14 * simDt) || this.stuck > 20) this.startPeck()
        break
      case 'peck':
      case 'idle':
        this.t -= simDt
        if (this.t <= 0) {
          this.state = 'walk'
          if (this.outsideFor > 4) this.pathTo(g, pick(this.r, areaTiles(g.world, g.grid, yard)))
          else this.pickYardTarget(g, yard)
        }
        break
    }
  }

  private startPeck(): void {
    this.state = 'peck'
    this.t = 1 + this.r() * 3
  }

  private pickYardTarget(g: Game, yard: Area): void {
    // Crowd around Ohana when she's scattering grain.
    const ohana = g.villagers.find((v) => v.id === 'ohana')
    if (ohana && !ohana.inside && ohana.entry?.doing.kind === 'area' && ohana.entry.doing.pose === 'feed' && this.r() < 0.7) {
      this.tx = ohana.x + (this.r() - 0.5) * 28
      this.ty = ohana.y + 4 + (this.r() - 0.5) * 16
      return
    }
    this.tx = (yard.x + 0.3 + this.r() * (yard.w - 0.6)) * TILE
    this.ty = (yard.y + 0.5 + this.r() * (yard.h - 0.7)) * TILE
  }

  private nearestThreat(g: Game): { x: number; y: number } | null {
    const list: { x: number; y: number; r: number }[] = []
    const p = g.player
    if (!p.hidden && !p.swimming) list.push({ x: p.x, y: p.y, r: 26 })
    for (const v of g.villagers) if (!v.inside && (v.id === 'taro' || v.id === 'kiku')) list.push({ x: v.x, y: v.y, r: 22 })
    const dog = g.animals.find((a) => a.kind === 'dog')
    if (dog && dog.visible) list.push({ x: dog.x, y: dog.y, r: 28 })
    let best: { x: number; y: number } | null = null
    let bestD = Infinity
    for (const t of list) {
      const d = Math.hypot(t.x - this.x, t.y - this.y)
      if (d < t.r && d < bestD) {
        best = t
        bestD = d
      }
    }
    return best
  }

  // ---------- chicks & ducklings: follow the leader ----------

  private follower(g: Game, dt: number, simDt: number, gap: number, speed: number): void {
    const l = this.leader
    if (!l) return
    this.visible = l.visible
    if (!l.visible) {
      this.x = l.x
      this.y = l.y
      return
    }
    this.state = l.state === 'flee' ? 'flee' : 'walk'
    const d = Math.hypot(l.x - this.x, l.y - this.y)
    if (d > 80) {
      this.x = l.x
      this.y = l.y
    }
    if (d > gap) {
      const sp = (l.state === 'flee' ? 50 : speed) * (l.state === 'flee' ? dt : simDt)
      if (this.kind === 'duckling') {
        const dx = l.x - this.x
        const dy = l.y - this.y
        this.x += (dx / d) * Math.min(sp, d - gap)
        this.y += (dy / d) * Math.min(sp, d - gap)
        if (Math.abs(dx) > 0.3) this.faceRight = dx > 0
        this.walkDist += sp
      } else this.stepTo(g, l.x + (this.faceRight ? -4 : 4), l.y + 2, Math.min(sp, d - gap))
    } else this.state = 'idle'
  }

  // ---------- ducks ----------

  private duck(g: Game, dt: number, simDt: number): void {
    const night = g.clock.minutes > 20 * 60 || g.clock.minutes < 5 * 60
    if (night) {
      this.state = 'sleep'
      return
    }
    this.state = 'walk'
    const arrived = this.stepToWater(g, this.tx, this.ty, 10 * simDt)
    if (arrived || this.stuck > 30) {
      const pond = areaTiles(g.world, g.grid, g.world.areas[this.home])
      const t = pick(this.r, pond)
      this.tx = t.x * TILE + 4 + this.r() * 8
      this.ty = t.y * TILE + 6 + this.r() * 6
      this.stuck = 0
    }
    if (this.r() < dt * 0.03) this.noise(g, 'gā gā', 8)
  }

  private stepToWater(g: Game, tx: number, ty: number, dist: number): boolean {
    const dx = tx - this.x
    const dy = ty - this.y
    const d = Math.hypot(dx, dy)
    if (d < 1) return true
    const s = Math.min(dist, d)
    const nx = this.x + (dx / d) * s
    const ny = this.y + (dy / d) * s
    const water = (x: number, y: number) => isWet(g.world.tiles[idx(Math.floor(x / TILE), Math.floor(y / TILE))])
    if (water(nx, ny)) {
      this.x = nx
      this.y = ny
      this.stuck = 0
    } else this.stuck++
    if (Math.abs(dx) > 0.3) this.faceRight = dx > 0
    this.walkDist += s
    return d <= dist
  }

  // ---------- Pochi ----------

  private dog(g: Game, dt: number, simDt: number): void {
    const taro = g.villagers.find((v) => v.id === 'taro')
    const p = g.player
    const pd = Math.hypot(p.x - this.x, p.y - this.y)
    if (pd < 40 && !p.hidden && this.visible) this.noise(g, pick(this.r, ['Wan! Wan!', 'Wan!', '*wag wag wag*']), 25, '#f2c9a0')
    if (!taro || taro.inside) {
      const bed = g.world.places.dogBed
      const f = tileFeet(bed)
      if (Math.hypot(f.x - this.x, f.y - this.y) > 2) {
        if (!this.path.length) this.pathTo(g, bed)
        this.state = 'walk'
        if (this.followPath(30 * simDt)) this.state = 'sleep'
      } else {
        this.state = 'sleep'
        if (this.r() < dt * 0.02) this.noise(g, 'z z z', 15, '#c4ccfa')
      }
      return
    }
    this.path = []
    const behindX = taro.x + (taro.dir === 'left' ? 14 : taro.dir === 'right' ? -14 : 8)
    const behindY = taro.y + (taro.dir === 'up' ? 10 : taro.dir === 'down' ? -6 : 2)
    const d = Math.hypot(behindX - this.x, behindY - this.y)
    if (d > 120 || this.stuck > 40) {
      this.x = taro.x
      this.y = taro.y
      this.stuck = 0
    }
    if (d > 6) {
      this.state = 'walk'
      this.stepTo(g, behindX, behindY, Math.min(d, 40 * simDt + (d > 30 ? 30 * dt : 0)))
    } else {
      this.state = pd < 50 ? 'sit' : 'idle'
      this.faceRight = taro.x > this.x
    }
  }

  // ---------- Mike ----------

  private cat(g: Game, dt: number, simDt: number): void {
    const m = g.clock.minutes
    const spots = this.home.split(',')
    const spot = m < 7 * 60 || m >= 21 * 60 ? spots[0] : m < 11 * 60 ? spots[1] : m < 15 * 60 ? spots[2] : spots[3]
    const target = g.world.places[spot]
    const f = tileFeet(target)
    if (Math.hypot(f.x - this.x, f.y - this.y) > 2) {
      if (!this.path.length) this.pathTo(g, target)
      this.state = 'walk'
      this.followPath(14 * simDt)
      return
    }
    const p = g.player
    const pd = Math.hypot(p.x - this.x, p.y - this.y)
    this.state = pd < 30 ? 'sit' : 'sleep'
    if (pd < 30) this.noise(g, pick(this.r, ['nyā', '…', 'mrrp']), 40)
    void dt
  }

  // ---------- Benkei ----------

  private ox(g: Game, dt: number, simDt: number): void {
    const pen = g.world.areas.oxPen
    if (this.state === 'walk') {
      if (this.stepTo(g, this.tx, this.ty, 7 * simDt) || this.stuck > 30) {
        this.state = 'peck'
        this.t = 6 + this.r() * 14
      }
    } else {
      this.state = 'peck'
      this.t -= simDt
      if (this.t <= 0) {
        this.state = 'walk'
        this.tx = (pen.x + 0.5 + this.r() * (pen.w - 1)) * TILE
        this.ty = (pen.y + 0.6 + this.r() * (pen.h - 1)) * TILE
      }
    }
    if (this.r() < dt * 0.02) this.noise(g, 'Mōōō…', 30, '#e8e0cc')
  }

  // ---------- crows ----------

  private crow(g: Game, dt: number, simDt: number): void {
    const m = g.clock.minutes
    const farmers = g.villagers.filter((v) => !v.inside && v.entry?.doing.kind === 'area' && v.entry.doing.pose === 'plant' && v.wading(g))
    const active = m > 6 * 60 && m < 17 * 60 + 30 && farmers.length > 0
    switch (this.state) {
      case 'away':
        this.visible = false
        this.t -= simDt
        if (active && this.t <= 0) {
          const farmer = pick(this.r, farmers)
          const planted = areaTiles(g.world, g.grid, g.world.areas.paddies).filter((t) => {
            const d = Math.abs(t.x - farmer.tile.x) + Math.abs(t.y - farmer.tile.y)
            return g.world.planted[idx(t.x, t.y)] && d > 2 && d < 8
          })
          if (!planted.length) {
            this.t = 10
            return
          }
          const land = pick(this.r, planted)
          this.tx = land.x * TILE + 4 + this.r() * 8
          this.ty = land.y * TILE + 6 + this.r() * 6
          this.x = this.tx - 140 - this.r() * 60
          this.y = this.ty - 60
          this.z = 90
          this.state = 'flyIn'
          this.visible = true
        }
        break
      case 'flyIn': {
        const d = Math.hypot(this.tx - this.x, this.ty - this.y)
        this.faceRight = this.tx > this.x
        const s = Math.min(d, 80 * Math.max(dt, simDt * 0.25))
        this.x += ((this.tx - this.x) / (d || 1)) * s
        this.y += ((this.ty - this.y) / (d || 1)) * s
        this.z = Math.min(90, d * 0.5)
        this.walkDist += s
        if (d < 1) {
          this.z = 0
          this.state = 'peck'
          this.t = 2 + this.r() * 5
          this.noise(g, 'Kaa!', 4)
        }
        break
      }
      case 'peck':
      case 'idle': {
        const scare = this.crowThreat(g, farmers)
        if (scare || !active) {
          this.flyAway(scare ?? { x: this.x - 50, y: this.y + 50 })
          if (scare?.farmer && this.r() < 0.6) g.speech.say(scare.farmer, pick(this.r, ['Shoo! SHOO!', 'Get out of my rice!', 'Filthy crows!']), 2.5)
          break
        }
        this.t -= simDt
        if (this.t <= 0) {
          const t = this.tile
          if (g.world.tiles[idx(t.x, t.y)] === T.Paddy && g.world.planted[idx(t.x, t.y)] && this.r() < 0.6) {
            g.setPlanted(t.x, t.y, false)
            this.noise(g, 'Kaa! Kaa!', 1)
          }
          // Hop to a neighbouring patch.
          this.tx = this.x + (this.r() - 0.5) * 30
          this.ty = this.y + (this.r() - 0.5) * 20
          this.state = 'flyIn'
          this.t = 3 + this.r() * 6
        }
        break
      }
      case 'flyOut': {
        this.x += this.tx * dt * 90
        this.y += this.ty * dt * 90
        this.z += dt * 70
        this.walkDist += dt * 90
        this.t -= dt
        if (this.t <= 0) {
          this.state = 'away'
          this.visible = false
          this.t = 10 + this.r() * 25
        }
        break
      }
      default:
        this.state = 'away'
        this.t = this.r() * 30
    }
  }

  private crowThreat(g: Game, farmers: Villager[]): { x: number; y: number; farmer?: Villager } | null {
    const p = g.player
    if (!p.hidden && Math.hypot(p.x - this.x, p.y - this.y) < 40) return { x: p.x, y: p.y }
    const dog = g.animals.find((a) => a.kind === 'dog' && a.visible)
    if (dog && Math.hypot(dog.x - this.x, dog.y - this.y) < 50) return { x: dog.x, y: dog.y }
    for (const f of farmers) if (Math.hypot(f.x - this.x, f.y - this.y) < 26) return { x: f.x, y: f.y, farmer: f }
    return null
  }

  private flyAway(from: { x: number; y: number }): void {
    const dx = this.x - from.x
    const dy = this.y - from.y
    const d = Math.hypot(dx, dy) || 1
    this.tx = dx / d
    this.ty = dy / d - 0.6
    this.state = 'flyOut'
    this.t = 2.5
  }

  // ---------- seagulls ----------

  private gull(g: Game, dt: number): void {
    const night = g.clock.minutes > 20 * 60 || g.clock.minutes < 4 * 60 + 30
    const quay = g.world.areas[this.home]
    switch (this.state) {
      case 'away': // circling over the harbour
        this.t -= dt
        this.walkDist += dt * 40
        this.tx += dt * (0.5 + this.jitter * 0.4)
        this.x = (quay.x + quay.w * (0.25 + this.jitter * 0.5)) * TILE + Math.cos(this.tx) * (90 + this.jitter * 60)
        this.y = (quay.y + 3) * TILE + Math.sin(this.tx) * 40
        this.z = 60 + Math.sin(this.tx * 2) * 12
        this.faceRight = Math.sin(this.tx) < 0
        if ((this.t <= 0 || night) && quay) {
          const tiles = areaTiles(g.world, g.grid, quay)
          const land = pick(this.r, tiles)
          this.ty = 0
          this.path = [{ x: land.x * TILE + 8, y: land.y * TILE + 10 }]
          this.state = 'flyIn'
        }
        if (this.r() < dt * 0.05) this.noise(g, pick(this.r, ['Kyaa!', 'Kyaa kyaa!', 'Myaa!']), 6, '#f6f4ee')
        break
      case 'flyIn': {
        const p = this.path[0]
        const d = Math.hypot(p.x - this.x, p.y - this.y)
        const s = Math.min(d, 70 * dt)
        this.x += ((p.x - this.x) / (d || 1)) * s
        this.y += ((p.y - this.y) / (d || 1)) * s
        this.faceRight = p.x > this.x
        this.z = Math.min(this.z, d * 0.5)
        this.walkDist += s
        if (d < 1) {
          this.z = 0
          this.state = 'peck'
          this.t = 6 + this.r() * 12
        }
        break
      }
      case 'peck':
      case 'idle': {
        const p = g.player
        const kid = g.villagers.find((v) => !v.inside && (v.id === 'hachi' || v.id === 'taro' || v.id === 'kiku') && Math.hypot(v.x - this.x, v.y - this.y) < 30)
        if ((!p.hidden && Math.hypot(p.x - this.x, p.y - this.y) < 30) || kid) {
          this.state = 'flyOut'
          this.noise(g, 'KYAA!', 1, '#f6f4ee')
          break
        }
        if (!night) this.t -= dt
        if (this.t <= 0) this.state = 'flyOut'
        break
      }
      case 'flyOut':
        this.z += dt * 50
        this.walkDist += dt * 50
        if (this.z > 55) {
          this.state = 'away'
          this.t = 10 + this.r() * 25
          this.tx = Math.atan2(this.y - (quay.y + 3) * TILE, this.x - (quay.x + quay.w / 2) * TILE)
        }
        break
      default:
        this.state = 'away'
        this.t = this.r() * 20
    }
    this.visible = true
  }

  // ---------- temple deer ----------

  private deer(g: Game, dt: number, simDt: number): void {
    const area = g.world.areas[this.home]
    const p = g.player
    const pd = Math.hypot(p.x - this.x, p.y - this.y)
    if (this.state === 'sit') {
      // Bowing to a visitor.
      this.t -= dt
      if (this.t <= 0) {
        this.state = 'idle'
        this.t = 3
      }
      return
    }
    if (pd < 36 && !p.hidden && g.time - this.lastNoise > 20) {
      this.state = 'sit'
      this.t = 1.6
      this.faceRight = p.x > this.x
      this.noise(g, '*bows*', 0, '#f0d8b0')
      return
    }
    if (this.state === 'walk') {
      if (this.stepTo(g, this.tx, this.ty, 9 * simDt) || this.stuck > 30) {
        this.state = this.r() < 0.5 ? 'peck' : 'idle'
        this.t = 4 + this.r() * 10
      }
    } else {
      this.t -= simDt
      if (this.t <= 0) {
        this.state = 'walk'
        this.tx = (area.x + 0.5 + this.r() * (area.w - 1)) * TILE
        this.ty = (area.y + 0.6 + this.r() * (area.h - 1)) * TILE
      }
    }
    void dt
  }

  // ---------- crows on the rooftops ----------

  /** Perched on a roof ridge (`home` lists building ids); z is the ridge height above the ground row. */
  private roofCrow(g: Game, dt: number): void {
    switch (this.state) {
      case 'idle': {
        const p = g.player
        const near = Math.hypot(p.x - this.x, p.y - (this.y - this.z)) < 34 || Math.hypot(p.x - this.x, p.y - this.y) < 30
        if (near && !p.hidden) {
          this.noise(g, 'KRAA!', 2)
          this.tx = this.x < p.x ? -1 : 1
          this.ty = -0.4
          this.state = 'flyOut'
          this.t = 3
          break
        }
        if (this.r() < dt * 0.04) this.noise(g, pick(this.r, ['Kaa.', 'Kaa\u2026', 'Kraa.']), 8, '#9a94a8')
        if (this.r() < dt * 0.3) this.faceRight = !this.faceRight
        break
      }
      case 'flyOut':
        this.x += this.tx * dt * 80
        this.y += this.ty * dt * 80
        this.z += dt * 30
        this.walkDist += dt * 80
        this.t -= dt
        if (this.t <= 0) {
          this.state = 'away'
          this.visible = false
          this.t = 15 + this.r() * 30
        }
        break
      default: {
        this.visible = false
        this.t -= dt
        if (this.t > 0) break
        const perch = g.roofPerch(pick(this.r, this.home.split(',')), this.r())
        if (!perch || g.onScreen(perch.x, perch.y - perch.z, 10)) {
          this.t = 5
          break
        }
        this.x = perch.x
        this.y = perch.y
        this.z = perch.z
        this.visible = true
        this.state = 'idle'
      }
    }
  }

  // ---------- rats ----------

  private rat(g: Game, dt: number, simDt: number): void {
    const m = g.clock.minutes
    const out = m > 18 * 60 + 30 || m < 5 * 60 + 30 || g.weather.rain > 0.3
    const area = g.world.areas[this.home]
    if (!out) {
      // Back into the cracks in the quay as soon as nobody is looking.
      if (this.visible && !g.onScreen(this.x, this.y, 20)) this.visible = false
    } else if (!this.visible && !g.onScreen(this.x, this.y, 20)) this.visible = true
    if (!this.visible) return
    const p = g.player
    const dp = Math.hypot(p.x - this.x, p.y - this.y)
    if (dp < 28 && !p.hidden && this.state !== 'flee') {
      this.state = 'flee'
      this.t = 0.8
      const d = dp || 1
      this.tx = this.x + ((this.x - p.x) / d) * 60
      this.ty = this.y + ((this.y - p.y) / d) * 30
      if (this.r() < 0.4) this.noise(g, 'squeak!', 2, '#c08a8a')
    }
    switch (this.state) {
      case 'flee':
      case 'walk': {
        const speed = this.state === 'flee' ? 70 : 34
        const arrived = this.stepTo(g, this.tx, this.ty, speed * (this.state === 'flee' ? dt : Math.max(dt, simDt * 0.3)))
        this.t -= dt
        if (arrived || this.stuck > 6 || (this.state === 'flee' && this.t <= 0)) {
          this.state = 'peck'
          this.t = 0.5 + this.r() * 3
        }
        break
      }
      default: {
        this.t -= dt
        if (this.t > 0) break
        const tiles = areaTiles(g.world, g.grid, area)
        const here = this.tile
        const near = tiles.filter((t) => Math.abs(t.x - here.x) < 5 && Math.abs(t.y - here.y) < 3)
        const to = pick(this.r, near.length ? near : tiles)
        this.tx = to.x * TILE + 2 + this.r() * 12
        this.ty = to.y * TILE + 4 + this.r() * 10
        this.state = 'walk'
        this.t = 4
      }
    }
  }

  // ---------- frogs ----------

  private frog(g: Game, dt: number): void {
    const night = g.clock.minutes > 19 * 60 + 30 || g.clock.minutes < 4 * 60 + 30
    this.visible = night
    if (night && this.r() < dt * 0.06) this.noise(g, pick(this.r, ['kero kero', 'kero', 'gero gero']), 6, '#a6d46c')
  }

  // ---------- drawing ----------

  sprite(): Sprite {
    let frame: AnimalFrame = 'stand'
    const step = Math.floor(this.walkDist / 3) % 2 ? 'walk1' : 'walk2'
    switch (this.state) {
      case 'walk':
      case 'flee':
        frame = this.kind === 'duck' || this.kind === 'duckling' ? 'swim' : step
        if (this.isChicken && this.state === 'flee') frame = 'flap'
        break
      case 'peck':
        frame = this.kind === 'ox' || this.kind === 'deer' ? 'eat' : 'peck'
        if (this.isChicken || this.kind === 'crow') frame = Math.floor(this.t * 3) % 2 ? 'peck' : 'stand'
        break
      case 'sleep':
        frame = this.kind === 'duck' || this.kind === 'duckling' ? 'swim' : 'sleep'
        break
      case 'sit':
        if (this.kind === 'deer') {
          frame = 'peck'
          break
        }
        frame = this.kind === 'dog' ? (Math.floor(this.walkDist + performance.now() / 150) % 2 ? 'wag' : 'sit') : 'sit'
        break
      case 'flyIn':
      case 'flyOut':
      case 'away':
        frame = Math.floor(this.walkDist / 6) % 2 ? 'fly1' : 'fly2'
        break
      default:
        frame = this.kind === 'duck' || this.kind === 'duckling' ? 'swim' : 'stand'
    }
    return animalSprite(this.kind, frame, this.faceRight)
  }
}

/** Populate the village's animals. */
export function spawnAnimals(g: Game): Animal[] {
  const out: Animal[] = []
  const yard = g.world.areas.chickenYard
  let seed = 100
  const yardPt = () => ({ x: (yard.x + 0.5 + ((seed * 37) % 40) / 10) * TILE, y: (yard.y + 3 + ((seed * 17) % 25) / 10) * TILE })
  const hens: Animal[] = []
  const henTalk = ['Bok.', 'Bok bok. (The hen does not respect you.)', 'The hen stares at you with the eyes of a tiny dinosaur.']
  for (const kind of ['rooster', 'hen', 'hen', 'henBrown', 'henBrown', 'hen'] as const) {
    seed++
    const p = yardPt()
    const name = kind === 'rooster' ? 'Rooster' : seed === 103 ? 'Nobunaga (hen)' : 'Hen'
    const talk = kind === 'rooster' ? ['The rooster puffs up. He thinks he runs this village. He might.'] : seed === 103 ? ['Nobunaga the hen pecks your shell. Hard. She fears no one.'] : henTalk
    const a = new Animal(kind, p.x, p.y, seed * 977, name, talk)
    out.push(a)
    if (kind !== 'rooster') hens.push(a)
  }
  // Chicks follow the first brown hen.
  for (let i = 0; i < 3; i++) {
    const c = new Animal('chick', hens[2].x + i * 4, hens[2].y + 4, 3000 + i, 'Chick', ['Peep! (It thinks you are its mother.)'])
    c.leader = hens[2]
    out.push(c)
  }
  // Duck families on the moat.
  for (const [area, seed0] of [
    ['moat', 4242],
    ['moatSouth', 4343],
  ] as const) {
    const water = areaTiles(g.world, g.grid, g.world.areas[area])
    const start = tileFeet(water[Math.floor(water.length * 0.3)])
    const mama = new Animal('duck', start.x, start.y - 3, seed0, 'Duck', ['The duck looks at you like you owe it money.'])
    mama.home = area
    mama.state = 'walk'
    out.push(mama)
    let prev = mama
    for (let i = 0; i < 3; i++) {
      const d = new Animal('duckling', start.x + 8 * (i + 1), start.y - 3, seed0 + 10 + i, 'Duckling', ['Peep.'])
      d.leader = prev
      d.state = 'walk'
      out.push(d)
      prev = d
    }
  }
  // Pochi, the cats, Benkei.
  const bed = tileFeet(g.world.places.dogBed)
  out.push(new Animal('dog', bed.x, bed.y, 7, 'Pochi', ['Pochi wags so hard his whole body wags.', 'Pochi sniffs your shell thoroughly. You pass inspection.']))
  const cats: [string, string, string[]][] = [
    ['Mike', 'catTea,catWell,catFish,catInari', ['Mike the cat is asleep. Mike is always asleep. Mike has figured it out.', 'Mike opens one eye. Closes it. You have been judged.']],
    ['Tora', 'catFish,catFish,catFish2,catFish', ['Tora, union representative of the fish market cats. He wants a word about fish heads.']],
    ['Kuro', 'catFish2,catFish3,catFish3,catFish2', ['Kuro, a black cat. Sailors say black cats bring luck at sea. Kuro has heard this and expects payment.']],
  ]
  cats.forEach(([name, spots, talk], i) => {
    const at = tileFeet(g.world.places[spots.split(',')[0]])
    const c = new Animal('cat', at.x, at.y, 8 + i * 31, name, talk)
    c.home = spots
    c.state = 'sleep'
    out.push(c)
  })
  const pen = g.world.areas.oxPen
  out.push(new Animal('ox', (pen.x + 2) * TILE, (pen.y + 2) * TILE, 9, 'Benkei', ['Benkei regards you with deep, bovine indifference.', 'M\u014d\u014d\u014d. (Benkei would like you to move. You are standing on his grass.)']))
  // Crows wait off-screen until Gonbei starts planting.
  for (let i = 0; i < 4; i++) {
    const c = new Animal('crow', -100, -100, 9000 + i, 'Crow', ['Kaa.'])
    c.state = 'away'
    c.visible = false
    out.push(c)
  }
  // Crows on the rooftops: the ruin, the row houses, the fish market.
  for (let i = 0; i < 5; i++) {
    const c = new Animal('crow', -100, -100, 9100 + i, 'Crow', ['The crow looks at you the way crows look at everything: as possible food.', 'Kaa. (It has seen things. It will not say which.)'])
    c.home = i < 2 ? 'ruin,ruin,nagayaD' : i < 4 ? 'fishmarket,nagayaB,nagayaC,tentB' : 'castle,sanmon,belltower'
    c.state = 'away'
    c.visible = false
    out.push(c)
  }
  // Rats along the quay and round the fish market.
  for (let i = 0; i < 6; i++) {
    const quay = areaTiles(g.world, g.grid, g.world.areas.quay)
    const at = tileFeet(quay[Math.floor((i / 6) * quay.length)])
    const rat = new Animal('rat', at.x, at.y, 9500 + i, 'Rat', [
      'A harbour rat, the size of a small cat. It is not afraid of you. It should be. (It shouldn’t.)',
      'The rat looks at your shell, then at you, and decides you are not food. Today.',
    ])
    rat.home = 'quay'
    rat.state = 'peck'
    out.push(rat)
  }
  // Seagulls over the harbour.
  for (let i = 0; i < 8; i++) {
    const gull = new Animal('gull', 0, 0, 7000 + i, 'Seagull', ['The seagull eyes your scarf. It eyes everything. It is a seagull.'])
    gull.home = 'quay'
    gull.state = 'away'
    gull.tx = i * 0.8
    out.push(gull)
  }
  // Deer at the temple. They bow.
  const grounds = g.world.areas.templeGrounds
  for (let i = 0; i < 4; i++) {
    const d = new Animal('deer', (grounds.x + 4 + i * 9) * TILE, (grounds.y + 9 + (i % 2) * 2) * TILE, 8000 + i, 'Temple deer', [
      'A temple deer. It bows to you. You bow back. Your shell clacks. The deer seems satisfied.',
      'The deer sniffs you for rice crackers. You have none. It bows anyway. Polite deer.',
    ])
    d.home = 'templeGrounds'
    d.state = 'idle'
    out.push(d)
  }
  // Frogs on the paddy levees and by the temple pond.
  const frogSpots: Pt[] = [
    { x: 8, y: 36 },
    { x: 14, y: 40 },
    { x: 8, y: 44 },
    { x: 13, y: 37 },
    { x: 19, y: 42 },
    { x: 2, y: 47 },
    { x: 44, y: 6 },
    { x: 54, y: 4 },
  ]
  frogSpots.forEach((t, i) => {
    const f = tileFeet(t)
    const frog = new Animal('frog', f.x + (i % 3) * 3 - 3, f.y, 600 + i, 'Frog', ['The frog says nothing. The frog has said everything it needs to say.'])
    frog.state = 'idle'
    out.push(frog)
  })
  return out
}
