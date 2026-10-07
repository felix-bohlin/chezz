// The game: owns the world, the people and animals, the clock, and draws everything each frame.
//
// Frame order: ground → water shimmer → koi → ripples → everything that stands, sorted by its feet
// (buildings, props, villagers, animals, the turtle) → birds in flight → smoke/butterflies →
// mist → rain → light map (multiply: the hour, the clouds, lanterns) → glowing windows, flames,
// fireflies → lightning → full-res UI on top. The world canvas carries a CSS colour grade.

import { buildingArt, type BuildingArt } from './art/buildings'
import { Ground } from './art/ground'
import { HERMIT, HERMIT_PALETTE } from './art/hermit'
import { portrait } from './art/people'
import { propArt, stallSprite } from './art/props'
import type { Sprite } from './art/sprite'
import { unlockAudio } from './audio/engine'
import { startMusic, stopMusic } from './audio/music'
import { playBell } from './audio/bell'
import { playThunder, setRain } from './audio/ambience'
import { input, onTap } from './engine/input'
import { canvas, ellipse, fromGrid, outline, px, type Ctx } from './engine/pixel'
import { hash, pick, rng } from './engine/rng'
import type { Screen } from './engine/screen'
import { Animal, spawnAnimals } from './entities/animals'
import { Player } from './entities/player'
import { Villager } from './entities/villager'
import { Fx } from './fx'
import { ambientAt, darknessOf, Lighting } from './lighting'
import { CAST } from './sim/cast'
import { makeExtras } from './sim/extras'
import { Clock } from './sim/clock'
import { FONT_BODY, PALETTE } from './ui/draw'
import { Dialog, drawBanner, drawHelp, drawHint, drawHud, drawMap, drawTitle, type Hit, type MapMarker } from './ui/overlays'
import { Speech, type Speaker } from './ui/speech'
import { makeGrid, tileFeet, tileOf, type Grid } from './world/grid'
import { idx, propTiles, T, TILE, type Building, type Prop, type World } from './world/layout'
import { buildWorld } from './world/town'
import { Weather, type WeatherMode } from './weather'

interface Static {
  img: HTMLCanvasElement
  x: number
  y: number
  sortY: number
  /** Tall things fade when the turtle walks behind them. */
  fade: boolean
  building?: { b: Building; art: BuildingArt }
  prop?: Prop
  glow?: { x: number; y: number; r: number; color: string; flame?: boolean }
  smoke?: { x: number; y: number }
}

interface Koi {
  x: number
  y: number
  tx: number
  ty: number
  color: string
  spot: string
}

const WEATHER_SAY: Record<WeatherMode, string> = {
  auto: '(the sky goes back to doing as it pleases)',
  rain: '(it starts to rain. Of course it does.)',
  storm: '(the gods are arguing again)',
  mist: '(a mist rolls in off the sea. Anything could be in it.)',
  clear: '(the clouds part. Briefly. Suspiciously.)',
}

/** Oiled-paper umbrellas (bangasa), plain and patched. */
const UMBRELLA_COLORS = [
  ['#7a3a2a', '#9a5236', '#5a2a1e'],
  ['#5e5a48', '#7a7460', '#423e32'],
  ['#3e4a5a', '#56647a', '#2c3442'],
  ['#8a6a3a', '#a8864e', '#64492a'],
]
const umbrellaCache = new Map<number, HTMLCanvasElement>()
function umbrella(i: number): HTMLCanvasElement {
  const hit = umbrellaCache.get(i)
  if (hit) return hit
  const [base, light, dark] = UMBRELLA_COLORS[i]
  const [c, ctx] = canvas(19, 14)
  // Canopy: a shallow cone with ribs.
  const rows = [3, 7, 11, 15, 17]
  rows.forEach((w, j) => {
    const x0 = 9 - Math.floor(w / 2)
    px(ctx, x0, 1 + j, w, 1, j < 2 ? light : base)
    for (let x = x0 + 1; x < x0 + w - 1; x += 3) px(ctx, x, 1 + j, 1, 1, dark)
  })
  px(ctx, 1, 6, 17, 1, dark)
  // A patch on the grey one.
  if (i === 1) px(ctx, 11, 3, 3, 2, '#8a7a5a')
  px(ctx, 9, 0, 1, 1, dark)
  px(ctx, 9, 7, 1, 7, '#3a2a1c')
  outline(c, '#1a1220')
  umbrellaCache.set(i, c)
  return c
}

const HINT =
  'WASD / arrows: walk · Shift: hurry · Space: hide in shell · E: talk & look · M: map · [ ]: time speed · R: weather · H: help'

export class Game {
  readonly screen: Screen
  readonly world: World
  readonly grid: Grid
  readonly ground: Ground
  readonly clock = new Clock()
  readonly fx: Fx
  readonly speech = new Speech()
  readonly lighting = new Lighting()
  readonly weather = new Weather()
  readonly player: Player
  readonly villagers: Villager[]
  readonly animals: Animal[]
  time = 0
  camX = 0
  camY = 0
  dialog: Dialog | null = null
  title = true
  showMap = false
  showHelp = false
  debug = false
  musicOn = true
  /** Counters for tests and the debug view. */
  readonly stats = { pathFails: 0 }

  private statics: Static[] = []
  private residents = new Map<string, Villager[]>()
  private koi: Koi[] = []
  private hits: Hit[] = []
  private hintT = 0
  private roshi: HTMLCanvasElement
  private smokeT = 0
  private snapshot: HTMLCanvasElement | null = null
  private fpsT = 0
  private fpsN = 0
  private fps = 0
  private r = rng(99)
  private district = ''
  private bannerT = 0
  private lastMinute = -1
  /** A merchant ship sailing across the bay now and then. */
  private sail: { x: number; y: number; speed: number } | null = null
  private sailIn = 20
  private frameDt = 0

  constructor(screen: Screen) {
    this.screen = screen
    this.world = buildWorld()
    this.grid = makeGrid(this.world)
    this.ground = new Ground(this.world)
    this.fx = new Fx(this.world)
    const start = tileFeet(this.world.start)
    this.player = new Player(start.x, start.y)
    this.player.dir = 'up'
    this.villagers = [...CAST, ...makeExtras()].map((s) => new Villager(s, this))
    for (const v of this.villagers) {
      const id = v.spec.home.startsWith('door:') ? v.spec.home.slice(5) : v.spec.home
      this.residents.set(id, [...(this.residents.get(id) ?? []), v])
    }
    this.animals = spawnAnimals(this)
    this.buildStatics()
    this.spawnKoi()
    this.roshi = fromGrid(HERMIT, HERMIT_PALETTE)
    this.snapCamera()
    onTap((cx, cy) => this.onTap(cx, cy))
  }

  // ---------- world queries used by entities ----------

  setPlanted(x: number, y: number, on: boolean): void {
    const i = idx(x, y)
    if (this.world.tiles[i] !== T.Paddy || !!this.world.planted[i] === on) return
    this.world.planted[i] = on ? 1 : 0
    this.ground.repaint(x, y)
    if (this.snapshot) this.snapshot = null
  }

  onScreen(x: number, y: number, margin = 16): boolean {
    return x > this.camX - margin && x < this.camX + this.screen.w + margin && y > this.camY - margin && y < this.camY + this.screen.h + margin
  }

  /** A spot on a building's roof ridge for a perching crow: ground point (x, y) and height z. */
  roofPerch(id: string, k: number): { x: number; y: number; z: number } | null {
    const st = this.statics.find((s) => s.building?.b.id === id)
    if (!st) return null
    const img = st.img
    const col = Math.floor(img.width * (0.25 + k * 0.5))
    const data = img.getContext('2d')!.getImageData(col, 0, 1, img.height).data
    let top = 0
    while (top < img.height && data[top * 4 + 3] === 0) top++
    if (top >= img.height) return null
    const y = st.sortY
    return { x: st.x + col, y, z: y - (st.y + top) + 1 }
  }

  // ---------- setup ----------

  private buildStatics(): void {
    for (const b of this.world.buildings) {
      const art = buildingArt(b)
      const x = b.x * TILE - art.ax
      const y = (b.y + b.h) * TILE - art.ay
      this.statics.push({ img: art.img, x, y, sortY: (b.y + b.h) * TILE - 1, fade: true, building: { b, art } })
    }
    const fences = new Set(this.world.props.filter((p) => p.kind === 'fence').map((p) => `${p.x},${p.y}`))
    const walls = new Set(this.world.props.filter((p) => p.kind === 'wall').map((p) => `${p.x},${p.y}`))
    const WALL_JOINS = new Set(['tower', 'gate', 'gateSide'])
    const wallLike = (x: number, y: number) => {
      if (walls.has(`${x},${y}`)) return true
      if (x < 0 || y < 0 || x >= this.world.w || y >= this.world.h) return false
      const bi = this.grid.buildingAt[idx(x, y)]
      return !!bi && WALL_JOINS.has(this.world.buildings[bi - 1].kind)
    }
    for (const p of this.world.props) {
      let mask = 0
      if (p.kind === 'fence' || p.kind === 'wall') {
        const has = p.kind === 'fence' ? (x: number, y: number) => fences.has(`${x},${y}`) : wallLike
        if (has(p.x - 1, p.y)) mask |= 1
        if (has(p.x + 1, p.y)) mask |= 2
        if (has(p.x, p.y - 1)) mask |= 4
        if (has(p.x, p.y + 1)) mask |= 8
      }
      const art = propArt(p, Math.floor(hash(p.x, p.y, 1) * 1000), mask)
      if (!art) continue
      const ax = p.x * TILE + (p.w ?? 1) * 8
      const ay = p.y * TILE + 14
      const low = p.kind === 'iris' || p.kind === 'reeds' || p.kind === 'redbridge'
      this.statics.push({
        smoke: art.smoke ? { x: ax + art.smoke.x, y: ay + art.smoke.y } : undefined,
        img: art.sprite.img,
        x: ax - art.sprite.ax,
        y: ay - art.sprite.ay,
        sortY: low ? ay - 6 : ay,
        fade: art.sprite.img.height > 30 && p.kind !== 'wall',
        prop: p,
        glow: art.glow ? { ...art.glow, x: ax + art.glow.x, y: ay + art.glow.y } : undefined,
      })
    }
  }

  private spawnKoi(): void {
    const pond = this.world.areas.templePond
    const colors = ['#f08a3a', '#f4f1ea', '#e8604a', '#f2b030', '#f4f1ea']
    for (let i = 0; i < 5; i++) {
      const x = (pond.x + 3 + i * 1.2) * TILE
      const y = (pond.y + 3.5) * TILE
      this.koi.push({ x, y, tx: x, ty: y, color: colors[i], spot: i % 2 ? '#e8604a' : '#2a2233' })
    }
  }

  private snapCamera(): void {
    this.camX = this.player.x - this.screen.w / 2
    this.camY = this.player.y - this.screen.h / 2
    this.clampCamera()
  }

  private clampCamera(): void {
    const maxX = this.world.w * TILE - this.screen.w
    const maxY = this.world.h * TILE - this.screen.h
    this.camX = maxX < 0 ? maxX / 2 : Math.max(0, Math.min(maxX, this.camX))
    this.camY = maxY < 0 ? maxY / 2 : Math.max(0, Math.min(maxY, this.camY))
  }

  // ---------- update ----------

  update(dt: number): void {
    this.time += dt
    this.frameDt = dt
    this.fpsT += dt
    this.fpsN++
    if (this.fpsT > 0.5) {
      this.fps = Math.round(this.fpsN / this.fpsT)
      this.fpsT = 0
      this.fpsN = 0
    }

    if (this.title) {
      if (input.anyPressed()) this.start()
      this.tickWorld(dt, true)
      input.endFrame()
      return
    }

    // Global keys.
    if (input.pressed('KeyM')) {
      this.showMap = !this.showMap
      this.showHelp = false
    }
    if (input.pressed('KeyH', 'Slash', 'F1')) {
      this.showHelp = !this.showHelp
      this.showMap = false
    }
    if (input.pressed('Escape')) {
      this.showMap = false
      this.showHelp = false
    }
    if (input.pressed('KeyG')) this.debug = !this.debug
    if (input.pressed('KeyN')) this.toggleMusic()
    if (input.pressed('BracketRight', 'Equal', 'NumpadAdd')) this.clock.faster()
    if (input.pressed('BracketLeft', 'Minus', 'NumpadSubtract')) this.clock.slower()
    if (input.pressed('KeyP')) this.clock.paused = !this.clock.paused
    if (input.pressed('KeyR')) this.speech.floater(this.player.x, this.player.y - 28, WEATHER_SAY[this.weather.cycle()], '#c8d4dc')

    if (this.dialog) {
      this.dialog.update(dt)
      if (input.pressed('KeyE', 'Enter', 'Space', 'Click', 'Escape') && this.dialog.advance()) this.dialog = null
    } else if (!this.showMap && !this.showHelp && input.pressed('KeyE', 'Enter', 'NumpadEnter', 'Click')) this.interact()

    this.tickWorld(dt, !!this.dialog || this.showHelp)
    this.hintT += dt
    input.endFrame()
  }

  /** Advance the simulation; `frozen` stops the clock and the turtle (dialogue, help, title). */
  private tickWorld(dt: number, frozen: boolean): void {
    const clockDt = frozen ? 0 : dt
    const dmin = this.clock.tick(clockDt)
    const simDt = clockDt * this.clock.speed
    this.player.update(this, dt, frozen || this.showMap)
    for (const v of this.villagers) v.update(this, dt, simDt, dmin)
    const adt = simDt > 0 ? dt : 0
    for (const a of this.animals) a.update(this, adt, simDt)
    this.updateKoi(adt)
    this.fx.update(dt, this.world, this.clock.minutes, { x: this.camX, y: this.camY, w: this.screen.w, h: this.screen.h })
    this.speech.update(dt)
    this.emitSmoke(dt)
    this.updateDistrict(dt)
    this.updateSail(frozen ? 0 : dt * Math.max(1, this.clock.speed / 4))
    this.weather.update(dt, dmin, this.clock.day, this.clock.minutes)
    if (this.weather.thunder && this.musicOn) playThunder()
    setRain(this.weather.rain, this.musicOn && !this.title)
    this.screen.setGrade(this.weather.grade())
    // Temple bells at dawn and dusk.
    const m = Math.floor(this.clock.minutes)
    if (this.lastMinute >= 0 && m !== this.lastMinute)
      for (const bell of [6 * 60, 18 * 60]) if (this.lastMinute < bell && m >= bell && m - this.lastMinute < 30) this.tollBell()
    this.lastMinute = m
    // Ohana scatters grain while feeding.
    for (const v of this.villagers)
      if (!v.inside && v.entry?.doing.kind === 'area' && v.entry.doing.pose === 'feed' && this.r() < adt * 3) this.fx.grain(v.x - 6, v.y - 10)

    // Camera eases after the turtle.
    const tx = this.player.x - this.screen.w / 2
    const ty = this.player.y - this.screen.h / 2
    const k = Math.min(1, dt * 6)
    this.camX += (tx - this.camX) * k
    this.camY += (ty - this.camY) * k
    this.clampCamera()
  }

  private updateDistrict(dt: number): void {
    this.bannerT += dt
    const t = tileOf(this.player.x, this.player.y)
    const d = this.world.districts.find((r) => t.x >= r.x && t.y >= r.y && t.x < r.x + r.w && t.y < r.y + r.h)
    const name = d?.name ?? 'Kumoi'
    if (name !== this.district) {
      this.district = name
      this.bannerT = 0
    }
  }

  private updateSail(dt: number): void {
    if (!this.sail) {
      this.sailIn -= dt
      if (this.sailIn <= 0) {
        const fromLeft = this.r() < 0.5
        this.sail = { x: fromLeft ? -120 : this.world.w * TILE + 120, y: (this.world.h - 2) * TILE, speed: fromLeft ? 11 : -11 }
      }
      return
    }
    this.sail.x += this.sail.speed * dt
    if (this.sail.x < -200 || this.sail.x > this.world.w * TILE + 200) {
      this.sail = null
      this.sailIn = 120 + this.r() * 180
    }
  }

  private tollBell(): void {
    const bell = this.world.places.bell
    const f = tileFeet(bell)
    if (this.musicOn) playBell()
    this.speech.floater(f.x, f.y - 50, 'GOOONNNNG\u2026', '#e0b13c')
    if (!this.onScreen(f.x, f.y, 200)) this.speech.floater(this.player.x, this.player.y - 28, '(far off, the temple bell: GONNNG\u2026)', '#e0b13c')
  }

  private start(): void {
    this.title = false
    this.hintT = 0
    void unlockAudio().then(() => {
      if (this.musicOn) startMusic()
    })
  }

  private toggleMusic(): void {
    this.musicOn = !this.musicOn
    if (this.musicOn) void unlockAudio().then(() => startMusic())
    else stopMusic()
  }

  private onTap(cssX: number, cssY: number): boolean {
    if (this.title) return false
    const x = cssX * this.screen.dpr
    const y = cssY * this.screen.dpr
    if (this.showMap || this.showHelp) {
      this.showMap = false
      this.showHelp = false
      return true
    }
    for (const h of this.hits)
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
        if (h.action === 'map') this.showMap = true
        if (h.action === 'help') this.showHelp = true
        if (h.action === 'music') this.toggleMusic()
        if (h.action === 'speed') this.clock.cycle()
        return true
      }
    return false
  }

  private interact(): void {
    const f = this.player.front()
    // People first.
    let best: Villager | null = null
    let bestD = 20
    for (const v of this.villagers) {
      if (v.inside) continue
      const d = Math.min(Math.hypot(v.x - f.x, v.y - 4 - f.y), Math.hypot(v.x - this.player.x, v.y - this.player.y) + 4)
      if (d < bestD) {
        best = v
        bestD = d
      }
    }
    if (best) {
      const v = best
      v.talking = true
      this.dialog = new Dialog({
        name: v.spec.name,
        subtitle: v.spec.title,
        portrait: portrait(v.id, v.spec.look),
        pages: [v.nextTalkLine(this)],
        onClose: () => (v.talking = false),
      })
      return
    }
    for (const a of this.animals) {
      if (!a.visible || a.z > 0.5 || !a.talk.length) continue
      if (Math.hypot(a.x - f.x, a.y - 3 - f.y) < 15) {
        this.dialog = new Dialog({ name: a.name, pages: [pick(this.r, a.talk)] })
        return
      }
    }
    const t = tileOf(f.x, f.y)
    const prop = this.world.props.find((p) => p.text && propTiles(p).some((q) => q.x === t.x && q.y === t.y))
    if (prop?.text) {
      this.dialog = new Dialog({ name: prop.name ?? prop.kind, pages: Array.isArray(prop.text) ? prop.text : [prop.text] })
      return
    }
    const bi = this.grid.buildingAt[idx(t.x, t.y)]
    if (bi) {
      const b = this.world.buildings[bi - 1]
      this.dialog = new Dialog({ name: b.name, pages: Array.isArray(b.text) ? b.text : [b.text] })
    }
  }

  private updateKoi(dt: number): void {
    const water = (x: number, y: number) => this.world.tiles[idx(Math.floor(x / TILE), Math.floor(y / TILE))] === T.Water
    for (const k of this.koi) {
      const dx = k.tx - k.x
      const dy = k.ty - k.y
      const d = Math.hypot(dx, dy)
      if (d < 2) {
        const pond = this.world.areas.templePond
        for (let i = 0; i < 10; i++) {
          const x = (pond.x + this.r() * pond.w) * TILE
          const y = (pond.y + this.r() * pond.h) * TILE
          if (water(x, y) && water(x + 8, y) && water(x - 8, y) && water(x, y - 8) && water(x, y + 8)) {
            k.tx = x
            k.ty = y
            break
          }
        }
      } else {
        k.x += (dx / d) * 9 * dt
        k.y += (dy / d) * 9 * dt
      }
    }
  }

  private buildingLit(b: Building): boolean {
    if (b.id === 'teahouse') {
      const oume = this.residents.get('teahouse')?.[0]
      if (oume && !oume.inside && oume.entry?.label.startsWith('serving')) return true
    }
    const res = this.residents.get(b.id)
    if (res) return res.some((v) => v.inside && v.lit)
    return !!b.litHours?.some(([a, z]) => this.clock.between(a, z))
  }

  private emitSmoke(dt: number): void {
    this.smokeT -= dt
    if (this.smokeT > 0) return
    this.smokeT = 0.45
    const m = this.clock.minutes
    const meal = (m > 300 && m < 480) || (m > 660 && m < 780) || (m > 1020 && m < 1200)
    for (const s of this.statics) {
      if (s.smoke && this.onScreen(s.smoke.x, s.smoke.y, 60)) this.fx.smoke(s.smoke.x, s.smoke.y, true)
      const bb = s.building
      if (!bb?.art.chimney) continue
      const wx = s.x + bb.art.chimney.x
      const wy = s.y + bb.art.chimney.y
      if (!this.onScreen(wx, wy, 60)) continue
      if (bb.b.kind === 'brewery') {
        if (m > 270 && m < 720) this.fx.smoke(wx, wy, true)
      } else if (bb.b.kind === 'teahouse') {
        if (this.buildingLit(bb.b) && m > 420 && m < 1260) this.fx.smoke(wx, wy)
      } else if (meal && this.buildingLit(bb.b)) this.fx.smoke(wx, wy)
    }
  }

  // ---------- render ----------

  render(): void {
    const s = this.screen
    const ctx = s.ctx
    const camX = Math.round(this.camX)
    const camY = Math.round(this.camY)
    ctx.fillStyle = '#1a1220'
    ctx.fillRect(0, 0, s.w, s.h)
    ctx.drawImage(this.ground.canvas, Math.max(0, camX), Math.max(0, camY), s.w, s.h, Math.max(0, -camX), Math.max(0, -camY), s.w, s.h)
    this.drawWater(ctx, camX, camY)
    this.drawKoi(ctx, camX, camY)
    this.fx.drawGround(ctx, camX, camY)

    // Everything that stands, sorted by feet.
    const items: { sortY: number; draw: () => void }[] = []
    const vx0 = camX - 80
    const vx1 = camX + s.w + 80
    const vy0 = camY - 40
    const vy1 = camY + s.h + 120
    const p = this.player
    const pr = { x0: p.x - 9, x1: p.x + 9, y0: p.y - 16, y1: p.y }
    for (const st of this.statics) {
      if (st.x > vx1 || st.x + st.img.width < vx0 || st.y > vy1 || st.y + st.img.height < vy0) continue
      items.push({
        sortY: st.sortY,
        draw: () => {
          const behind = st.fade && p.y < st.sortY && pr.x1 > st.x && pr.x0 < st.x + st.img.width && pr.y1 > st.y + 6 && pr.y0 < st.sortY
          if (behind) ctx.globalAlpha = 0.5
          ctx.drawImage(st.img, st.x - camX, st.y - camY)
          ctx.globalAlpha = 1
        },
      })
    }
    for (const v of this.villagers) {
      if (v.inside || v.x < vx0 || v.x > vx1 || v.y < vy0 || v.y > vy1) continue
      const sitting = v.isSitting()
      items.push({ sortY: v.y + (sitting ? 5 : 0), draw: () => this.drawVillager(ctx, v, camX, camY, sitting) })
    }
    for (const a of this.animals) {
      if (!a.visible || a.z > 0.5 || a.x < vx0 || a.x > vx1 || a.y < vy0 || a.y > vy1) continue
      items.push({ sortY: a.y, draw: () => this.drawSprite(ctx, a.sprite(), a.x, a.y, camX, camY, a.kind !== 'frog' && a.kind !== 'duck' && a.kind !== 'duckling') })
    }
    const jinbei = this.villagers.find((v) => v.id === 'jinbei')
    if (jinbei && !jinbei.inside && !jinbei.isMoving && jinbei.status.startsWith('selling')) {
      const at = this.world.places.stall
      const f = tileFeet({ x: at.x, y: at.y + 1 })
      items.push({ sortY: f.y, draw: () => this.drawSprite(ctx, stallSprite(), f.x - 8, f.y, camX, camY, false) })
    }
    items.push({ sortY: p.y, draw: () => this.drawPlayer(ctx, camX, camY) })
    const sail = this.sail
    if (sail && sail.x > camX - 200 && sail.x < camX + s.w + 200 && sail.y < vy1 + 140) {
      const art = propArt({ kind: 'ship', x: 0, y: 0, solid: false }, 0)
      if (art) {
        const img = art.sprite.img
        items.push({
          sortY: sail.y,
          draw: () => {
            const x = Math.round(sail.x - camX - img.width / 2)
            const y = Math.round(sail.y - camY - art.sprite.ay)
            if (sail.speed < 0) {
              ctx.save()
              ctx.translate(x + img.width, y)
              ctx.scale(-1, 1)
              ctx.drawImage(img, 0, 0)
              ctx.restore()
            } else ctx.drawImage(img, x, y)
          },
        })
      }
    }
    items.sort((a, b) => a.sortY - b.sortY)
    for (const it of items) it.draw()

    // Birds in flight, with their shadows on the ground.
    for (const a of this.animals) {
      if (!a.visible || a.z <= 0.5) continue
      if (a.state !== 'idle') {
        ctx.globalAlpha = 0.25
        ellipse(ctx, a.x - camX, a.y - camY, 4, 1.5, '#10140c')
        ctx.globalAlpha = 1
      }
      this.drawSprite(ctx, a.sprite(), a.x, a.y - a.z, camX, camY, false)
    }
    const W = this.weather
    const ambient = this.ambient()
    const dark = darknessOf(ambient)
    this.fx.drawAir(ctx, camX, camY, dark < 0.3 && W.rain < 0.2)
    W.drawFog(ctx, camX, camY, s.w, s.h, this.time)
    W.drawRain(ctx, s.w, s.h, this.frameDt)
    this.drawLight(ctx, camX, camY, ambient, dark)
    if (W.flash > 0.02) {
      ctx.globalAlpha = Math.min(0.7, W.flash * 0.7)
      ctx.fillStyle = '#e8eef8'
      ctx.fillRect(0, 0, s.w, s.h)
      ctx.globalAlpha = 1
    }
    if (this.debug) this.drawDebug(ctx, camX, camY)

    s.present()

    // ---- full-resolution UI ----
    this.speech.draw(s, camX, camY, (who: Speaker) => who instanceof Villager && who.inside)
    this.hits = []
    if (!this.title) {
      drawHud(s, this.clock, this.musicOn, this.hits)
      drawBanner(s, this.district, this.bannerT)
      const hintAlpha = this.hintT < 30 ? 1 : Math.max(0, 1 - (this.hintT - 30) / 3)
      if (!this.dialog) drawHint(s, HINT, hintAlpha)
    }
    if (this.dialog) this.dialog.draw(s)
    if (this.showMap) drawMap(s, this.mapSnapshot(), this.mapMarkers(), this.player, this.clock, this.time)
    if (this.showHelp) drawHelp(s)
    if (this.title) drawTitle(s, this.roshi, this.time)
    if (this.debug) this.drawDebugText()
    this.drawStick()
  }

  private drawSprite(ctx: Ctx, sp: Sprite, x: number, y: number, camX: number, camY: number, shadow: boolean): void {
    if (shadow) {
      ctx.globalAlpha = 0.22
      ellipse(ctx, x - camX, y - camY, Math.max(3, sp.img.width * 0.22), 1.6, '#10140c')
      ctx.globalAlpha = 1
    }
    ctx.drawImage(sp.img, Math.round(x - sp.ax - camX), Math.round(y - sp.ay - camY))
  }

  private drawVillager(ctx: Ctx, v: Villager, camX: number, camY: number, sitting: boolean): void {
    const sp = v.sprite(this)
    const x = Math.round(v.x - sp.ax - camX)
    const y = Math.round(v.y - sp.ay - camY) + (sitting ? -3 : 0)
    if (v.wading(this)) {
      // Legs under the paddy water.
      const water = Math.round(v.y - camY - 3)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, sp.img.width, water - y)
      ctx.clip()
      ctx.drawImage(sp.img, x, y)
      ctx.restore()
      ctx.globalAlpha = 0.7
      px(ctx, v.x - camX - 5, water, 10, 1, '#cfe8f0')
      ctx.globalAlpha = 1
      return
    }
    if (!sitting) {
      ctx.globalAlpha = 0.22
      ellipse(ctx, v.x - camX, v.y - camY, 5, 1.6, '#10140c')
      ctx.globalAlpha = 1
    }
    ctx.drawImage(sp.img, x, y)
    if (this.weather.rain > 0.35 && this.wantsUmbrella(v)) {
      const um = umbrella(Math.floor(hash(v.spec.id.length, v.spec.id.charCodeAt(0), 3) * UMBRELLA_COLORS.length))
      ctx.drawImage(um, Math.round(v.x - camX - um.width / 2), y - um.height + 7)
    }
  }

  private wantsUmbrella(v: Villager): boolean {
    if (v.isMoving) return true
    const d = v.entry?.doing
    if (!d) return false
    const pose = d.kind === 'spot' || d.kind === 'area' ? d.pose : d.kind === 'patrol' ? d.stop ?? 'stand' : 'stand'
    return pose === 'stand' || pose === 'shop' || pose === 'call' || pose === 'guard'
  }

  private drawPlayer(ctx: Ctx, camX: number, camY: number): void {
    const p = this.player
    const sp = p.sprite()
    const x = Math.round(p.x - sp.ax - camX)
    const y = Math.round(p.y - sp.ay - camY)
    if (p.swimming) {
      const water = Math.round(p.y - camY - 2)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y + 3, sp.img.width, water - y - 3)
      ctx.clip()
      ctx.drawImage(sp.img, x, y + 3)
      ctx.restore()
      ctx.globalAlpha = 0.8
      ctx.strokeStyle = '#d4ecf2'
      ctx.beginPath()
      ctx.ellipse(p.x - camX + 0.5, water + 0.5, 9, 2.5, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      return
    }
    ctx.globalAlpha = 0.25
    ellipse(ctx, p.x - camX, p.y - camY, 7, 2, '#10140c')
    ctx.globalAlpha = 1
    ctx.drawImage(sp.img, x, y)
  }

  private drawWater(ctx: Ctx, camX: number, camY: number): void {
    const t = this.time
    const rain = this.weather.rain
    if (rain > 0.05)
      for (const p of this.ground.puddles) {
        if (!this.onScreen(p.x, p.y, 20)) continue
        this.rainRings(ctx, p.x - p.w + 1 - camX, p.y - 2 - camY, p.w * 2 - 2, 4, p.x * 7 + p.y, rain * 0.7)
      }
    const tx0 = Math.max(0, Math.floor(camX / TILE))
    const ty0 = Math.max(0, Math.floor(camY / TILE))
    const tx1 = Math.min(this.world.w - 1, Math.ceil((camX + this.screen.w) / TILE))
    const ty1 = Math.min(this.world.h - 1, Math.ceil((camY + this.screen.h) / TILE))
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const tile = this.world.tiles[idx(tx, ty)]
        if (tile === T.Sand) {
          // Waves lapping the beach.
          if (ty + 1 < this.world.h && this.world.tiles[idx(tx, ty + 1)] === T.Sea) {
            const wave = Math.sin(t * 1.3 + tx * 0.4)
            const y = ty * TILE - camY + 12 + Math.round(wave * 2.5)
            ctx.globalAlpha = 0.55 + wave * 0.25
            px(ctx, tx * TILE - camX, y, TILE, 1, '#f2f8f8')
            px(ctx, tx * TILE - camX + ((tx * 5) % 7), y + 1, 6, 1, '#d4ecf2')
          }
          continue
        }
        if (tile !== T.Water && tile !== T.Paddy && tile !== T.Sea && tile !== T.Moat) continue
        const northWater = ty > 0 && this.world.tiles[idx(tx, ty - 1)] === tile
        const ox = tx * TILE - camX
        const oy = ty * TILE - camY
        for (let i = 0; i < 2; i++) {
          const h = hash(tx, ty, i + 40)
          const on = Math.sin(t * 1.7 + h * 40)
          if (on < 0.75) continue
          const sx = Math.floor(hash(tx, ty, i + 50) * 12) + 1
          const sy = Math.floor(hash(tx, ty, i + 60) * (northWater ? 14 : 9)) + (northWater ? 1 : 6)
          ctx.globalAlpha = (on - 0.75) * 3
          px(ctx, ox + sx, oy + sy, 2, 1, tile === T.Paddy ? '#c8e4dc' : '#cfe8f0')
        }
        if (rain > 0.05) this.rainRings(ctx, ox, oy, TILE, TILE, tx * 131 + ty, rain)
        // The river flows south.
        if (tile === T.Water && tx > 115 && northWater) {
          const h = hash(tx, ty, 70)
          const fy = (t * 9 + h * 16) % 16
          ctx.globalAlpha = 0.45
          px(ctx, ox + 2 + Math.floor(h * 11), oy + fy, 1, 3, '#86bfd6')
        }
      }
    ctx.globalAlpha = 1
  }

  /** Rings spreading where raindrops hit water, inside a w×h box at (x, y) (screen px). */
  private rainRings(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, rain: number): void {
    const n = Math.max(1, Math.round((w * h) / 90))
    for (let i = 0; i < n; i++) {
      const ph = this.time * 1.6 + hash(seed, i, 91) * 7
      const cyc = Math.floor(ph)
      if (hash(seed, cyc, i + 92) > rain) continue
      const k = ph - cyc
      const cx = Math.round(x + 1 + hash(seed + cyc, i, 93) * (w - 2))
      const cy = Math.round(y + 1 + hash(seed + cyc, i, 94) * (h - 2))
      ctx.globalAlpha = (1 - k) * 0.6
      if (k < 0.25) px(ctx, cx, cy, 1, 1, '#c8d6dc')
      else {
        const r = Math.round(1 + k * 2.5)
        px(ctx, cx - r, cy, 1, 1, '#a8bcc4')
        px(ctx, cx + r, cy, 1, 1, '#a8bcc4')
        px(ctx, cx - r + 1, cy - 1, r * 2 - 1, 1, '#a8bcc4')
        px(ctx, cx - r + 1, cy + 1, r * 2 - 1, 1, '#a8bcc4')
      }
    }
    ctx.globalAlpha = 1
  }

  private drawKoi(ctx: Ctx, camX: number, camY: number): void {
    const dark = darknessOf(this.ambient())
    ctx.globalAlpha = Math.max(0.2, 0.85 - dark * 0.6)
    for (const k of this.koi) {
      if (!this.onScreen(k.x, k.y)) continue
      const right = k.tx > k.x
      const x = Math.round(k.x - camX)
      const y = Math.round(k.y - camY)
      px(ctx, x - 2, y, 5, 2, k.color)
      px(ctx, right ? x - 4 : x + 3, y, 2, 1, k.color)
      px(ctx, right ? x + 1 : x - 1, y, 1, 1, k.spot)
    }
    ctx.globalAlpha = 1
  }

  /** The light of the hour, dimmed by cloud and rain. */
  private ambient(): [number, number, number] {
    const a = ambientAt(this.clock.minutes)
    const t = this.weather.ambientTint()
    // Clouds steal less light when there's little left to steal.
    const k = Math.max(0.35, 1 - darknessOf(a))
    return [a[0] * (1 - (1 - t[0]) * k), a[1] * (1 - (1 - t[1]) * k), a[2] * (1 - (1 - t[2]) * k)]
  }

  private drawLight(ctx: Ctx, camX: number, camY: number, ambient: [number, number, number], dark: number): void {
    const s = this.screen
    const L = this.lighting
    L.begin(s.w, s.h, ambient)
    const lampsOn = dark > 0.22
    const flick = (seed: number) => 0.85 + Math.sin(this.time * 9 + seed) * 0.08 + Math.sin(this.time * 23 + seed * 3) * 0.05
    const litWindows: { x: number; y: number; w: number; h: number }[] = []
    const flames: { x: number; y: number; big: boolean }[] = []
    for (const st of this.statics) {
      if (st.x > camX + s.w + 60 || st.x + st.img.width < camX - 60 || st.y > camY + s.h + 60 || st.y + st.img.height < camY - 60) continue
      const always = st.prop?.kind === 'campfire'
      if (st.glow && (lampsOn || always)) {
        const brazier = st.prop?.kind === 'brazier' || st.prop?.kind === 'lighthouse' || always
        L.add(st.glow.x - camX, st.glow.y - camY, st.glow.r, st.glow.color, flick(st.x) * Math.min(1, dark * 2))
        flames.push({ x: st.glow.x, y: st.glow.y, big: brazier })
      }
      const bb = st.building
      if (bb && lampsOn && this.buildingLit(bb.b)) {
        for (const w of bb.art.windows) {
          const wx = st.x + w.x
          const wy = st.y + w.y
          litWindows.push({ x: wx, y: wy, w: w.w, h: w.h })
          L.add(wx + w.w / 2 - camX, wy + w.h + 4 - camY, Math.max(18, w.w * 0.9), '#ffb860', 0.75 * Math.min(1, dark * 2))
        }
      }
      if (bb && lampsOn)
        for (const l of bb.art.lamps) {
          const [from, to] = l.hours ?? [18 * 60, 22 * 60]
          if (!this.clock.between(from, to)) continue
          L.add(st.x + l.x - camX, st.y + l.y - camY, l.r, l.color, flick(l.x) * Math.min(1, dark * 2))
          flames.push({ x: st.x + l.x, y: st.y + l.y, big: false })
        }
    }
    const fireflies = dark > 0.42 && this.weather.rain < 0.15 ? this.fx.fireflyLights() : []
    for (const f of fireflies) if (f.on > 0.2 && this.onScreen(f.x, f.y)) L.add(f.x - camX, f.y - camY, 9, '#a8e070', f.on * 0.9)
    // A faint halo so the turtle can see its own feet.
    L.add(this.player.x - camX, this.player.y - 6 - camY, 52, '#4a4a66', dark)
    L.apply(ctx)

    // Emissive bits on top of the darkness.
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = `rgba(255, 170, 70, ${Math.min(0.55, dark * 0.9)})`
    for (const w of litWindows) ctx.fillRect(w.x - camX, w.y - camY, w.w, w.h)
    ctx.globalCompositeOperation = 'source-over'
    for (const f of flames) {
      const x = Math.round(f.x - camX)
      const y = Math.round(f.y - camY)
      const j = Math.floor(this.time * 10 + f.x) % 2
      if (f.big) {
        px(ctx, x - 3, y + 1, 6, 2, '#f06a2a')
        px(ctx, x - 2 + j, y - 2, 3, 3, '#ffb84a')
        px(ctx, x - 1, y - 4 - j, 2, 2, '#fff0a0')
      } else px(ctx, x - 1, y - 1, 2, 2 + j, '#ffe08a')
    }
    for (const f of fireflies) {
      if (f.on < 0.3) continue
      ctx.globalAlpha = f.on
      px(ctx, f.x - camX, f.y - camY, 1, 1, '#f0ffb0')
    }
    ctx.globalAlpha = 1
  }

  private mapSnapshot(): HTMLCanvasElement {
    if (this.snapshot) return this.snapshot
    const [c, ctx] = canvas(this.world.w * TILE, this.world.h * TILE)
    ctx.drawImage(this.ground.canvas, 0, 0)
    for (const st of [...this.statics].sort((a, b) => a.sortY - b.sortY)) ctx.drawImage(st.img, st.x, st.y)
    this.snapshot = c
    return c
  }

  private mapMarkers(): MapMarker[] {
    const out: MapMarker[] = []
    for (const v of this.villagers) {
      if (v.spec.extra) {
        if (!v.inside) out.push({ x: v.x, y: v.y, color: '#a89c84' })
        continue
      }
      const away = v.spec.home === 'westEdge' && v.inside
      out.push({
        x: v.x,
        y: v.y,
        color: v.spec.color,
        label: v.spec.name,
        status: away ? 'on the road (not a market day)' : v.inside ? v.entry?.label ?? 'at home' : v.status,
        inside: v.inside,
      })
    }
    for (const a of this.animals) if (a.visible && ['dog', 'cat', 'ox'].includes(a.kind)) out.push({ x: a.x, y: a.y, color: '#c9a752', label: a.name })
    return out
  }

  // ---------- debug ----------

  private drawDebug(ctx: Ctx, camX: number, camY: number): void {
    const tx0 = Math.max(0, Math.floor(camX / TILE))
    const ty0 = Math.max(0, Math.floor(camY / TILE))
    for (let ty = ty0; ty < Math.min(this.world.h, ty0 + this.screen.h / TILE + 2); ty++)
      for (let tx = tx0; tx < Math.min(this.world.w, tx0 + this.screen.w / TILE + 2); tx++) {
        const i = idx(tx, ty)
        if (this.grid.solidNpc[i] && this.grid.solidPlayer[i]) ctx.fillStyle = 'rgba(210,60,42,0.28)'
        else if (this.grid.solidNpc[i]) ctx.fillStyle = 'rgba(60,120,210,0.22)'
        else if (this.grid.solidPlayer[i]) ctx.fillStyle = 'rgba(224,177,60,0.3)'
        else continue
        ctx.fillRect(tx * TILE - camX, ty * TILE - camY, TILE, TILE)
      }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    for (const v of this.villagers) {
      if (v.inside || !v.pathPoints.length) continue
      ctx.beginPath()
      ctx.moveTo(v.x - camX, v.y - camY)
      for (const p of v.pathPoints) ctx.lineTo(p.x - camX, p.y - camY)
      ctx.stroke()
    }
  }

  private drawDebugText(): void {
    const s = this.screen
    const ctx = s.dctx
    const u = (n: number) => s.u(n)
    ctx.font = `${u(11)}px ${FONT_BODY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const v of this.villagers) {
      if (v.inside) continue
      const x = (v.x - this.camX) * s.scale
      const y = (v.y - this.camY) * s.scale + u(4)
      ctx.lineWidth = u(3)
      ctx.strokeStyle = PALETTE.ink
      ctx.strokeText(`${v.spec.name}: ${v.status}`, x, y)
      ctx.fillStyle = '#fff4c0'
      ctx.fillText(`${v.spec.name}: ${v.status}`, x, y)
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff4c0'
    const t = tileOf(this.player.x, this.player.y)
    ctx.fillText(`${this.fps} fps · tile ${t.x},${t.y} · ${this.clock.hhmm()} ×${this.clock.speed}`, u(10), u(44))
    ctx.textBaseline = 'alphabetic'
  }

  private drawStick(): void {
    const st = input.stick()
    if (!st) return
    const ctx = this.screen.dctx
    const d = this.screen.dpr
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = PALETTE.washi
    ctx.lineWidth = this.screen.u(2)
    ctx.beginPath()
    ctx.arc(st.x0 * d, st.y0 * d, this.screen.u(36), 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = PALETTE.washi
    ctx.beginPath()
    const dx = st.x - st.x0
    const dy = st.y - st.y0
    const len = Math.min(36, Math.hypot(dx, dy))
    const a = Math.atan2(dy, dx)
    ctx.arc((st.x0 + Math.cos(a) * len) * d, (st.y0 + Math.sin(a) * len) * d, this.screen.u(14), 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}
