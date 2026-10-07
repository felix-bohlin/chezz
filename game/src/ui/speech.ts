// Speech bubbles over villagers' heads and little floating sound words ("Kokekokkō!", "kero kero").
// Drawn on the full-resolution UI layer so the text stays crisp.

import type { Screen } from '../engine/screen'
import { FONT_BODY, FONT_TITLE, PALETTE, roundRect, wrap } from './draw'

export interface Speaker {
  x: number
  y: number
  /** Optional name label on the bubble. */
  spec?: { name: string; look?: { kid?: boolean } }
}

interface Bubble {
  who: Speaker
  text: string
  age: number
  ttl: number
  /** Shouts stay visible (pinned to the screen edge) when the speaker is off-screen. */
  shout: boolean
}

interface Floater {
  x: number
  y: number
  text: string
  color: string
  age: number
  ttl: number
}

export class Speech {
  private bubbles: Bubble[] = []
  private floaters: Floater[] = []

  say(who: Speaker, text: string, ttl?: number, shout = false): void {
    this.bubbles = this.bubbles.filter((b) => b.who !== who)
    this.bubbles.push({ who, text, shout, age: 0, ttl: ttl ?? Math.min(6.5, Math.max(2.6, 1.6 + text.length * 0.055)) })
  }

  floater(x: number, y: number, text: string, color = PALETTE.washi): void {
    this.floaters.push({ x, y, text, color, age: 0, ttl: 1.8 })
  }

  isSpeaking(who: Speaker): boolean {
    return this.bubbles.some((b) => b.who === who)
  }

  update(dt: number): void {
    for (const b of this.bubbles) b.age += dt
    this.bubbles = this.bubbles.filter((b) => b.age < b.ttl)
    for (const f of this.floaters) f.age += dt
    this.floaters = this.floaters.filter((f) => f.age < f.ttl)
  }

  draw(screen: Screen, camX: number, camY: number, hidden: (who: Speaker) => boolean): void {
    const ctx = screen.dctx
    const s = screen.scale
    const u = (n: number) => screen.u(n)

    for (const f of this.floaters) {
      const k = f.age / f.ttl
      const x = (f.x - camX) * s
      const y = (f.y - camY) * s - u(18) * k
      ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25
      ctx.font = `${u(13)}px ${FONT_BODY}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.lineWidth = u(3)
      ctx.strokeStyle = PALETTE.ink
      ctx.strokeText(f.text, x, y)
      ctx.fillStyle = f.color
      ctx.fillText(f.text, x, y)
    }
    ctx.globalAlpha = 1

    // Nearer the bottom of the screen draws last (on top).
    const list = [...this.bubbles].sort((a, b) => a.who.y - b.who.y)
    for (const b of list) {
      if (hidden(b.who)) continue
      const head = b.who.spec ? (b.who.spec.look?.kid ? 26 : 32) : 18
      const ax = (b.who.x - camX) * s
      const ay = (b.who.y - head - camY) * s - u(4)
      const offscreen = ax < -u(20) || ax > screen.W + u(20) || ay < -u(20) || ay > screen.H + u(60)
      if (offscreen && !b.shout) continue
      const fade = Math.min(1, b.age * 6, (b.ttl - b.age) * 3)
      ctx.globalAlpha = fade
      ctx.font = `${u(14)}px ${FONT_BODY}`
      const lines = wrap(ctx, b.text, u(210))
      const lh = u(17)
      const name = b.who.spec?.name
      const pad = u(8)
      const nameH = name ? u(13) : 0
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width), name ? u(40) : 0) + pad * 2
      const h = lines.length * lh + pad * 2 + nameH - u(2)
      let x = ax - w / 2
      x = Math.max(u(6), Math.min(screen.W - w - u(6), x))
      const y = offscreen ? Math.max(u(96), Math.min(screen.H - h - u(80), ay - h - u(7))) : Math.max(u(46), ay - h - u(7))
      // Box with a little tail.
      ctx.fillStyle = PALETTE.washi
      ctx.strokeStyle = PALETTE.ink
      ctx.lineWidth = u(2)
      roundRect(ctx, x, y, w, h, u(5))
      ctx.fill()
      ctx.stroke()
      const tx = Math.max(x + u(10), Math.min(x + w - u(10), ax))
      ctx.beginPath()
      ctx.moveTo(tx - u(5), y + h - u(1))
      ctx.lineTo(tx, y + h + u(7))
      ctx.lineTo(tx + u(5), y + h - u(1))
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(tx - u(5), y + h)
      ctx.lineTo(tx, y + h + u(7))
      ctx.lineTo(tx + u(5), y + h)
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      if (name) {
        ctx.font = `${u(10)}px ${FONT_TITLE}`
        ctx.fillStyle = PALETTE.vermilion
        ctx.fillText(name.toUpperCase(), x + pad, y + pad - u(2))
      }
      ctx.font = `${u(14)}px ${FONT_BODY}`
      ctx.fillStyle = PALETTE.ink
      lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + nameH + i * lh))
    }
    ctx.globalAlpha = 1
  }
}
