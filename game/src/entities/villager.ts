// A villager runs their timetable: walk (A*) to wherever the current entry says, then hold a pose
// there, work their way around an area, or patrol a route. "Inside" means home with the door
// shut (windows lit or dark). They bark lines now and then, react to the turtle, and stop to talk.

import { personSprite, type DrawPose } from '../art/people'
import type { Sprite } from '../art/sprite'
import { pick, rng, type Rng } from '../engine/rng'
import { toMin } from '../sim/clock'
import type { Entry, VillagerSpec } from '../sim/cast'
import { areaTiles, findPath, tileFeet, tileOf } from '../world/grid'
import { idx, T, type Dir, type Pt } from '../world/layout'
import type { Game } from '../game'

export function currentEntry(spec: VillagerSpec, minutes: number, market: boolean): Entry {
  const list = spec.schedule.filter((e) => !e.days || market)
  let cur = list[list.length - 1]
  for (const e of list) if (toMin(e.at) <= minutes) cur = e
  return cur
}

export class Villager {
  readonly spec: VillagerSpec
  x = 0
  y = 0
  dir: Dir = 'down'
  inside = true
  lit = false
  entry: Entry | null = null
  talking = false
  /** What the villager is visibly doing right now (for the map). */
  status = ''

  private path: Pt[] = []
  private goal: Pt | null = null
  private phase: 'go' | 'act' = 'go'
  private actLeft = 0
  private patrolIdx = 0
  private pose: DrawPose = 'stand'
  private walkDist = 0
  private moving = false
  private barkIn: number
  private lastTurtle = -999
  private lastShell = -999
  private r: Rng
  private talkIdx = 0
  private pendingSay: { text: string; shout: boolean } | null = null

  constructor(spec: VillagerSpec, g: Game) {
    this.spec = spec
    this.r = rng(spec.id.length * 7717 + spec.id.charCodeAt(0))
    this.barkIn = 5 + this.r() * 20
    const door = g.world.places[spec.home]
    const f = tileFeet(door)
    this.x = f.x
    this.y = f.y
    // Start the day already where the timetable says, so the village looks lived-in at once.
    const e = currentEntry(spec, g.clock.minutes, g.clock.isMarketDay)
    this.entry = e
    const d = e.doing
    if (d.kind === 'inside') {
      this.inside = true
      this.lit = d.lit
    } else {
      this.inside = false
      const start = d.kind === 'spot' ? g.world.places[d.at] : d.kind === 'patrol' ? g.world.places[d.route[0]] : this.randomAreaTile(g, d.area)
      if (start) {
        const p = tileFeet(start)
        this.x = p.x
        this.y = p.y
        this.goal = start
        if (d.kind === 'spot') this.dir = g.world.places[d.at].face ?? 'down'
      }
      this.phase = 'act'
      this.actLeft = 2 + this.r() * 6
    }
  }

  get id(): string {
    return this.spec.id
  }

  get isMoving(): boolean {
    return this.moving
  }

  /** Remaining walk, in pixels (debug view). */
  get pathPoints(): readonly Pt[] {
    return this.path
  }

  get tile(): Pt {
    return tileOf(this.x, this.y)
  }

  update(g: Game, dt: number, simDt: number, dmin: number): void {
    const e = currentEntry(this.spec, g.clock.minutes, g.clock.isMarketDay)
    if (e !== this.entry) this.start(g, e)
    if (this.talking) {
      this.moving = false
      this.facePoint(g.player.x, g.player.y)
      return
    }
    const d = (this.entry ?? e).doing
    this.status = (this.entry ?? e).label
    const speed = this.spec.speed * simDt

    if (d.kind === 'inside') {
      if (this.inside) {
        this.lit = d.lit
        return
      }
      const door = g.world.places[this.spec.home]
      if (!this.goalIs(door)) this.goTo(g, door)
      this.moving = this.move(speed)
      if (!this.moving) {
        this.inside = true
        this.lit = d.lit
      }
      return
    }

    if (this.inside) this.emerge(g)
    if (this.pendingSay) {
      g.speech.say(this, this.pendingSay.text, this.pendingSay.shout ? 4.5 : 3.5, this.pendingSay.shout)
      this.pendingSay = null
    }

    switch (d.kind) {
      case 'spot': {
        const place = g.world.places[d.at]
        if (!this.goalIs(place)) this.goTo(g, place)
        this.moving = this.move(speed)
        if (!this.moving) {
          this.pose = d.pose
          this.dir = place.face ?? this.dir
        }
        break
      }
      case 'area': {
        if (this.phase === 'go') {
          this.moving = this.move(speed)
          if (!this.moving) {
            this.phase = 'act'
            this.actLeft = d.style === 'work' ? 12 + this.r() * 14 : d.style === 'chase' ? 1 + this.r() * 2 : 3 + this.r() * 9
            this.pose = d.pose
            if (d.style === 'chase') this.facePoint(this.x + (this.r() - 0.5) * 10, this.y + 4)
          }
        } else {
          this.actLeft -= dmin
          if (d.pose === 'plant' && this.r() < dt * 0.8) g.fx.ripple(this.x, this.y - 1)
          if (this.actLeft <= 0) {
            if (d.pose === 'plant' && this.goal) g.setPlanted(this.goal.x, this.goal.y, true)
            this.nextAreaTarget(g, d.area, d.style, d.pose)
          }
        }
        break
      }
      case 'patrol': {
        const place = g.world.places[d.route[this.patrolIdx % d.route.length]]
        if (this.phase === 'go') {
          if (!this.goalIs(place)) this.goTo(g, place)
          this.moving = this.move(speed)
          if (!this.moving) {
            this.phase = 'act'
            this.actLeft = 4 + this.r() * 6
            this.pose = 'stand'
            this.dir = place.face ?? (['down', 'left', 'right'] as const)[Math.floor(this.r() * 3)]
          }
        } else {
          this.actLeft -= dmin
          if (this.actLeft <= 0) {
            this.patrolIdx++
            this.phase = 'go'
          }
        }
        break
      }
    }
    this.chatter(g, dt)
  }

  private start(g: Game, e: Entry): void {
    this.entry = e
    this.phase = 'go'
    this.path = []
    this.goal = null
    this.patrolIdx = 0
    const d = e.doing
    if (d.kind === 'area') this.nextAreaTarget(g, d.area, d.style, d.pose)
    // Said once they're out of the door (see update).
    this.pendingSay = e.say && (e.shout || this.distToPlayer(g) < 14 * 16) ? { text: e.say, shout: !!e.shout } : null
  }

  private emerge(g: Game): void {
    const door = tileFeet(g.world.places[this.spec.home])
    this.x = door.x
    this.y = door.y
    this.inside = false
    this.dir = 'down'
    // The current target was computed from inside; recompute from the door.
    const goal = this.goal
    this.path = []
    if (goal) {
      this.goal = null
      this.goTo(g, goal)
    }
  }

  private nextAreaTarget(g: Game, areaId: string, style: string, pose: DrawPose): void {
    let target: Pt | null = null
    if (pose === 'plant') {
      // Plant the nearest bare patch of paddy.
      const tiles = areaTiles(g.world, g.grid, g.world.areas[areaId]).filter((t) => !g.world.planted[idx(t.x, t.y)])
      if (tiles.length) {
        const here = this.tile
        tiles.sort((a, b) => Math.abs(a.x - here.x) + Math.abs(a.y - here.y) - (Math.abs(b.x - here.x) + Math.abs(b.y - here.y)))
        target = tiles[Math.floor(this.r() * Math.min(5, tiles.length))]
      }
    }
    if (style === 'chase') {
      const a = g.world.areas[areaId]
      const hens = g.animals.filter((an) => an.isChicken && an.visible && an.inRect(a))
      if (hens.length) target = pick(this.r, hens).tile
    }
    if (!target) target = this.randomAreaTile(g, areaId)
    this.phase = 'go'
    if (target) this.goTo(g, target)
  }

  private randomAreaTile(g: Game, areaId: string): Pt | null {
    const tiles = areaTiles(g.world, g.grid, g.world.areas[areaId])
    return tiles.length ? pick(this.r, tiles) : null
  }

  private goalIs(p: Pt): boolean {
    return !!this.goal && this.goal.x === p.x && this.goal.y === p.y
  }

  private goTo(g: Game, target: Pt): void {
    this.goal = { x: target.x, y: target.y }
    const from = this.tile
    const path = findPath(g.world, g.grid, from, target)
    if (!path) {
      // Unreachable (shouldn't happen; scripts/check.ts guards the layout) — just appear there.
      g.stats.pathFails++
      const f = tileFeet(target)
      this.x = f.x
      this.y = f.y
      this.path = []
      return
    }
    this.path = path.map(tileFeet)
  }

  /** Walk `dist` px along the path. Returns true while still walking. */
  private move(dist: number): boolean {
    let moved = false
    while (dist > 0 && this.path.length) {
      const p = this.path[0]
      const dx = p.x - this.x
      const dy = p.y - this.y
      const d = Math.hypot(dx, dy)
      if (d > 0.01) {
        if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right'
        else this.dir = dy < 0 ? 'up' : 'down'
      }
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
      moved = true
    }
    return moved || this.path.length > 0
  }

  private facePoint(px: number, py: number): void {
    const dx = px - this.x
    const dy = py - this.y
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right'
    else this.dir = dy < 0 ? 'up' : 'down'
  }

  distToPlayer(g: Game): number {
    return Math.hypot(g.player.x - this.x, g.player.y - this.y)
  }

  /** Ambient barks, plus reactions to the turtle. */
  private chatter(g: Game, dt: number): void {
    const near = this.distToPlayer(g)
    const pl = g.player
    if (near < 34 && !pl.hidden && g.time - this.lastTurtle > 90) {
      this.lastTurtle = g.time
      const night = g.clock.minutes > 20 * 60 || g.clock.minutes < 4 * 60
      g.speech.say(this, pick(this.r, night && this.spec.night ? this.spec.night : this.spec.turtle))
      this.barkIn = 12 + this.r() * 10
      return
    }
    if (near < 40 && pl.hidden && pl.hiddenFor > 1.5 && g.time - this.lastShell > 45) {
      this.lastShell = g.time
      g.speech.say(this, pick(this.r, this.spec.shell))
      return
    }
    if (near > 13 * 16) return
    this.barkIn -= dt
    if (this.barkIn > 0) return
    this.barkIn = 14 + this.r() * 22
    const key = this.moving ? 'walk' : this.pose
    const lines = this.spec.barks[key as keyof VillagerSpec['barks']]
    if (lines?.length && this.r() < 0.75) g.speech.say(this, pick(this.r, lines))
  }

  nextTalkLine(g: Game): string {
    if (this.pose === 'nap' && !this.moving) return `Zzz… (${this.spec.name} is meditating. Loudly.)`
    const night = g.clock.minutes > 21 * 60 || g.clock.minutes < 4 * 60
    if (night && this.spec.night && this.r() < 0.5) return pick(this.r, this.spec.night)
    const line = this.spec.talk[this.talkIdx % this.spec.talk.length]
    this.talkIdx++
    return line
  }

  /** Is the villager standing in water (paddy)? Their legs get hidden. */
  wading(g: Game): boolean {
    const t = this.tile
    return g.world.tiles[idx(t.x, t.y)] === T.Paddy
  }

  isSitting(): boolean {
    return !this.moving && (this.pose === 'sit' || this.pose === 'nap' || this.pose === 'meditate')
  }

  sprite(g: Game): Sprite {
    let pose: DrawPose = this.pose
    let frame = 0
    if (this.moving) {
      const d = this.entry?.doing
      const carry = d && d.kind === 'area' && (d.pose === 'carry' || d.pose === 'play') ? d.pose : d && d.kind === 'spot' && d.pose === 'serve' ? 'serve' : 'walk'
      pose = carry
      frame = Math.floor(this.walkDist / 5) % 4
    } else {
      const t = g.time + this.spec.id.length * 0.37
      if (['hoe', 'sweep', 'plant', 'feed', 'fish'].includes(pose)) frame = Math.floor(t * (pose === 'fish' ? 1.1 : 2.2)) % 2
      if (pose === 'play') {
        pose = 'play'
        frame = Math.floor(t * 4) % 4
      }
      if (pose === 'serve' || pose === 'carry' || pose === 'shop' || pose === 'tend' || pose === 'guard') {
        frame = 0
        if (pose === 'shop' || pose === 'tend' || pose === 'guard') pose = 'stand'
      }
    }
    return personSprite(this.spec.id, this.spec.look, this.dir, pose, frame)
  }
}
