// Kame the turtle: walks (slowly), hurries (Shift; still slowly), swims (faster than walking, as
// turtles do), and hides in its shell, which turns it into a rock as far as the village is concerned.

import type { Sprite } from '../art/sprite'
import { turtleSprite } from '../art/turtle'
import { input } from '../engine/input'
import { tileOf } from '../world/grid'
import { idx, T, TILE, type Dir } from '../world/layout'
import type { Game } from '../game'

const WALK = 46
const HURRY = 92
const SWIM = 64

export class Player {
  x: number
  y: number
  dir: Dir = 'down'
  hidden = false
  hiddenFor = 0
  swimming = false
  moving = false
  private walkDist = 0
  private popOut = 0
  private lastEdgeNag = -99
  private rippleT = 0

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  update(g: Game, dt: number, frozen: boolean): void {
    this.moving = false
    if (this.hidden) this.hiddenFor += dt
    if (frozen) return

    if (input.pressed('Space') && !this.swimming) {
      this.hidden = !this.hidden
      this.hiddenFor = 0
      if (this.hidden) g.speech.floater(this.x, this.y - 12, '*fwump*', '#c4ccfa')
    }
    const a = input.axis()
    const wants = Math.hypot(a.x, a.y) > 0.1
    if (this.hidden) {
      // Pop back out after holding a direction for a moment.
      this.popOut = wants ? this.popOut + dt : 0
      if (this.popOut > 0.25) {
        this.hidden = false
        this.popOut = 0
      } else return
    }
    if (!wants) return

    const speed = this.swimming ? SWIM : input.down('ShiftLeft', 'ShiftRight') ? HURRY : WALK
    const dx = a.x * speed * dt
    const dy = a.y * speed * dt
    const before = { x: this.x, y: this.y }
    if (!this.blocked(g, this.x + dx, this.y)) this.x += dx
    if (!this.blocked(g, this.x, this.y + dy)) this.y += dy
    const moved = Math.hypot(this.x - before.x, this.y - before.y)
    this.walkDist += moved
    this.moving = moved > 0.01
    if (Math.abs(a.x) > Math.abs(a.y)) this.dir = a.x < 0 ? 'left' : 'right'
    else this.dir = a.y < 0 ? 'up' : 'down'

    const t = tileOf(this.x, this.y)
    const wasSwimming = this.swimming
    this.swimming = g.world.tiles[idx(t.x, t.y)] === T.Water
    if (this.swimming && !wasSwimming) {
      g.fx.splash(this.x, this.y)
      g.speech.floater(this.x, this.y - 10, '*plop*', '#cfe8f0')
    }
    if (this.swimming && this.moving) {
      this.rippleT -= dt
      if (this.rippleT <= 0) {
        g.fx.ripple(this.x, this.y - 2)
        this.rippleT = 0.35
      }
    }
    // The map edge: Roshi's voice carries a long way.
    if ((t.x <= 1 || t.x >= g.world.w - 2) && g.time - this.lastEdgeNag > 8) {
      this.lastEdgeNag = g.time
      g.speech.say(this, '(Roshi, faintly, from very far away) No sake, no coming home! Hohoho!', 4)
    }
  }

  private blocked(g: Game, x: number, y: number): boolean {
    // Small feet box.
    const pts = [
      [x - 5, y - 3],
      [x + 5, y - 3],
      [x - 5, y + 1],
      [x + 5, y + 1],
    ]
    for (const [px, py] of pts) {
      const tx = Math.floor(px / TILE)
      const ty = Math.floor(py / TILE)
      if (tx < 0 || ty < 0 || tx >= g.world.w || ty >= g.world.h) return true
      if (g.grid.solidPlayer[idx(tx, ty)]) return true
    }
    return false
  }

  /** The point just in front of the turtle (for talking / inspecting). */
  front(): { x: number; y: number } {
    const d = 12
    switch (this.dir) {
      case 'left':
        return { x: this.x - d, y: this.y - 2 }
      case 'right':
        return { x: this.x + d, y: this.y - 2 }
      case 'up':
        return { x: this.x, y: this.y - d }
      default:
        return { x: this.x, y: this.y + d - 4 }
    }
  }

  sprite(): Sprite {
    const frame = this.moving ? Math.floor(this.walkDist / 4) % 4 : 0
    return turtleSprite(this.dir, this.hidden ? 'hide' : this.swimming ? 'swim' : 'walk', frame)
  }
}
