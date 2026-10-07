// Screen-space UI: the clock panel, buttons, the dialogue box, the title card with Master Roshi,
// the village map with the who's-where list, and the help card.

import type { Screen } from '../engine/screen'
import { SPEEDS, type Clock } from '../sim/clock'
import { FONT_BODY, FONT_NUM, FONT_TITLE, PALETTE, panel, roundRect, wrap } from './draw'

export type Action = 'map' | 'help' | 'music' | 'speed'
export interface Hit {
  x: number
  y: number
  w: number
  h: number
  action: Action
}

// ---------- clock + buttons ----------

export function drawHud(screen: Screen, clock: Clock, musicOn: boolean, hits: Hit[]): void {
  const ctx = screen.dctx
  const u = (n: number) => screen.u(n)
  const W = u(178)
  const H = u(70)
  const x = screen.W - W - u(10)
  const y = u(10)
  panel(ctx, x, y, W, H, u)
  hits.push({ x, y, w: W, h: H, action: 'speed' })

  const m = clock.minutes
  const day = m >= 6 * 60 && m < 18 * 60 + 30
  // Sun or moon.
  const ix = x + u(22)
  const iy = y + u(24)
  ctx.beginPath()
  ctx.arc(ix, iy, u(9), 0, Math.PI * 2)
  ctx.fillStyle = day ? '#f2b030' : '#f1e6cc'
  ctx.fill()
  if (!day) {
    ctx.beginPath()
    ctx.arc(ix + u(4), iy - u(3), u(8), 0, Math.PI * 2)
    ctx.fillStyle = '#2a2040'
    ctx.fill()
  }
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.washi
  ctx.font = `${u(34)}px ${FONT_NUM}`
  ctx.fillText(clock.hhmm(), x + u(40), y + u(34))
  if (clock.speed > 1 || clock.paused) {
    ctx.font = `${u(20)}px ${FONT_NUM}`
    ctx.fillStyle = PALETTE.gold
    ctx.textAlign = 'right'
    ctx.fillText(clock.paused ? 'II' : `×${clock.speed}`, x + W - u(10), y + u(30))
    ctx.textAlign = 'left'
  }
  const z = clock.zodiac()
  ctx.font = `${u(12)}px ${FONT_BODY}`
  ctx.fillStyle = PALETTE.dim
  ctx.fillText(`Hour of the ${z.name} ${z.kanji}`, x + u(12), y + u(50))
  ctx.fillText(`Day ${clock.day}${clock.isMarketDay ? ' · market day' : ''}`, x + u(12), y + u(64))

  // Buttons.
  const labels: [Action, string][] = [
    ['map', 'MAP'],
    ['help', '?'],
    ['music', musicOn ? '♪ ON' : '♪ OFF'],
  ]
  let bx = u(10)
  ctx.font = `${u(11)}px ${FONT_TITLE}`
  for (const [action, label] of labels) {
    const bw = ctx.measureText(label).width + u(18)
    const bh = u(26)
    panel(ctx, bx, u(10), bw, bh, u)
    ctx.fillStyle = PALETTE.washi
    ctx.textBaseline = 'middle'
    ctx.fillText(label, bx + u(9), u(10) + bh / 2 + u(1))
    hits.push({ x: bx, y: u(10), w: bw, h: bh, action })
    bx += bw + u(6)
  }
  ctx.textBaseline = 'alphabetic'
}

export function drawHint(screen: Screen, text: string, alpha: number): void {
  if (alpha <= 0) return
  const ctx = screen.dctx
  const u = (n: number) => screen.u(n)
  ctx.globalAlpha = alpha
  ctx.font = `${u(12)}px ${FONT_BODY}`
  const lines = wrap(ctx, text, Math.min(screen.W - u(40), u(520)))
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + u(20)
  const h = lines.length * u(16) + u(14)
  const x = u(10)
  const y = screen.H - h - u(10)
  panel(ctx, x, y, w, h, u)
  ctx.fillStyle = PALETTE.washi
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, x + u(10), y + u(8) + i * u(16)))
  ctx.globalAlpha = 1
  ctx.textBaseline = 'alphabetic'
}

// ---------- dialogue box ----------

export interface DialogContent {
  name: string
  subtitle?: string
  portrait?: HTMLCanvasElement
  pages: string[]
  onClose?: () => void
}

export class Dialog {
  readonly content: DialogContent
  private page = 0
  private shown = 0

  constructor(content: DialogContent) {
    this.content = content
  }

  update(dt: number): void {
    this.shown += dt * 60
  }

  /** E pressed: finish the line, turn the page, or close. Returns true when closed. */
  advance(): boolean {
    const text = this.content.pages[this.page]
    if (this.shown < text.length) {
      this.shown = text.length
      return false
    }
    if (this.page < this.content.pages.length - 1) {
      this.page++
      this.shown = 0
      return false
    }
    this.content.onClose?.()
    return true
  }

  draw(screen: Screen): void {
    const ctx = screen.dctx
    const u = (n: number) => screen.u(n)
    const W = Math.min(screen.W - u(20), u(660))
    const hasPortrait = !!this.content.portrait
    const pw = hasPortrait ? u(96) : 0
    ctx.font = `${u(17)}px ${FONT_BODY}`
    const textW = W - pw - u(40)
    const full = this.content.pages[this.page]
    const lines = wrap(ctx, full, textW)
    const H = Math.max(u(118), lines.length * u(24) + u(62))
    const x = (screen.W - W) / 2
    const y = screen.H - H - u(14)
    panel(ctx, x, y, W, H, u, true)
    if (hasPortrait) {
      const img = this.content.portrait!
      const box = u(80)
      ctx.fillStyle = '#e2d4b2'
      roundRect(ctx, x + u(12), y + u(12), box, box, u(4))
      ctx.fill()
      ctx.imageSmoothingEnabled = false
      // Crop to head and shoulders.
      const crop = 24
      const kk = Math.max(1, Math.floor(box / crop))
      ctx.drawImage(img, 4, 0, crop, crop, x + u(12) + (box - crop * kk) / 2, y + u(12) + (box - crop * kk) / 2, crop * kk, crop * kk)
    }
    const tx = x + pw + u(20)
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.font = `${u(13)}px ${FONT_TITLE}`
    ctx.fillStyle = PALETTE.vermilion
    ctx.fillText(this.content.name.toUpperCase(), tx, y + u(14))
    if (this.content.subtitle) {
      const nw = ctx.measureText(this.content.name.toUpperCase()).width
      ctx.font = `${u(12)}px ${FONT_BODY}`
      ctx.fillStyle = '#7a6a58'
      ctx.fillText(`· ${this.content.subtitle}`, tx + nw + u(8), y + u(15))
    }
    ctx.font = `${u(17)}px ${FONT_BODY}`
    ctx.fillStyle = PALETTE.ink
    let left = Math.floor(this.shown)
    lines.forEach((l, i) => {
      if (left <= 0) return
      ctx.fillText(l.slice(0, left), tx, y + u(40) + i * u(24))
      left -= l.length + 1
    })
    if (this.shown >= full.length && Math.floor(performance.now() / 400) % 2 === 0) {
      ctx.font = `${u(12)}px ${FONT_TITLE}`
      ctx.fillStyle = PALETTE.vermilion
      ctx.textAlign = 'right'
      const more = this.page < this.content.pages.length - 1
      ctx.fillText(more ? 'E ▸' : 'E ✕', x + W - u(14), y + H - u(22))
      ctx.textAlign = 'left'
    }
    ctx.textBaseline = 'alphabetic'
  }
}

// ---------- title card ----------

export function drawTitle(screen: Screen, roshi: HTMLCanvasElement, t: number): void {
  const ctx = screen.dctx
  const u = (n: number) => screen.u(n)
  ctx.fillStyle = 'rgba(26, 18, 32, 0.72)'
  ctx.fillRect(0, 0, screen.W, screen.H)
  const cx = screen.W / 2
  const narrow = screen.W < u(640)
  const k = Math.max(2, Math.floor(u(narrow ? 3 : 5)))
  const rw = roshi.width * k
  const rh = roshi.height * k
  // Title.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${u(narrow ? 30 : 46)}px ${FONT_TITLE}`
  ctx.fillStyle = PALETTE.gold
  const ty = screen.H * (narrow ? 0.16 : 0.2)
  ctx.fillText('SHELL OF IGA', cx, ty)
  ctx.font = `${u(14)}px ${FONT_BODY}`
  ctx.fillStyle = PALETTE.washi
  if (narrow) {
    ctx.fillText('Kumoi village, Iga Province', cx, ty + u(26))
    ctx.fillText('early summer, 1582 · a village prototype', cx, ty + u(44))
  } else ctx.fillText('Kumoi village, Iga Province · early summer, 1582 · a village prototype', cx, ty + u(28))
  // Roshi with his speech bubble.
  const bob = Math.round(Math.sin(t * 2) * u(2))
  const rx = narrow ? cx - rw / 2 : cx - u(250)
  const ry = narrow ? ty + u(64) : screen.H * 0.3
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(roshi, rx, ry + bob, rw, rh)
  const bx = narrow ? u(16) : rx + rw + u(24)
  const by = narrow ? ry + rh + u(16) : ry + u(10)
  const bw = narrow ? screen.W - u(32) : Math.min(u(420), screen.W - bx - u(20))
  const text = [
    'Hohoho! Turtle! Go to the village and fetch me a jug of the GOOD sake.',
    'Kurozaemon will give it to you. Probably. Mention my name. Actually, don’t mention my name.',
    'And don’t dawdle! …Oh, who am I kidding.',
  ]
  ctx.font = `${u(16)}px ${FONT_BODY}`
  const lines = text.flatMap((p, i) => [...wrap(ctx, p, bw - u(28)), ...(i < text.length - 1 ? [''] : [])])
  const bh = lines.length * u(21) + u(48)
  panel(ctx, bx, by, bw, bh, u, true)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `${u(12)}px ${FONT_TITLE}`
  ctx.fillStyle = PALETTE.vermilion
  ctx.fillText('MASTER ROSHI', bx + u(14), by + u(12))
  ctx.font = `${u(16)}px ${FONT_BODY}`
  ctx.fillStyle = PALETTE.ink
  lines.forEach((l, i) => ctx.fillText(l, bx + u(14), by + u(34) + i * u(21)))
  // Prompt.
  if (Math.floor(t * 1.6) % 2 === 0) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `${u(14)}px ${FONT_TITLE}`
    ctx.fillStyle = PALETTE.gold
    ctx.fillText('PRESS ANY KEY · TAP TO START', cx, screen.H - u(28))
  }
  ctx.textAlign = 'left'
}

// ---------- help ----------

const HELP: [string, string][] = [
  ['WASD / arrows', 'walk (touch: drag anywhere)'],
  ['Shift', 'hurry (it’s a turtle; manage expectations)'],
  ['Space', 'hide in your shell — you become a rock (touch: double-tap)'],
  ['E / Enter / click', 'talk, look at things (touch: tap)'],
  ['[  ]', 'slow down / speed up time (or click the clock)'],
  ['P', 'pause time'],
  ['M', 'village map with who’s where'],
  ['N', 'music on / off'],
  ['G', 'debug view: collisions, paths, plans'],
]

const TRY = [
  'Follow Gonbei to his paddies and watch the crows undo his work. Scare them off.',
  'Hide in your shell next to someone. Kiyo is not fooled.',
  'Swim the river — turtles swim faster than they walk.',
  'Speed time up and watch the village go to bed, then the fireflies come out.',
  'Every third day is market day: Jinbei the peddler walks in from Sakai.',
]

export function drawHelp(screen: Screen): void {
  const ctx = screen.dctx
  const u = (n: number) => screen.u(n)
  ctx.fillStyle = 'rgba(26, 18, 32, 0.6)'
  ctx.fillRect(0, 0, screen.W, screen.H)
  const W = Math.min(screen.W - u(24), u(620))
  ctx.font = `${u(14)}px ${FONT_BODY}`
  const tryLines = TRY.flatMap((t) => wrap(ctx, `• ${t}`, W - u(40)))
  const H = u(70) + HELP.length * u(22) + u(40) + tryLines.length * u(20)
  const x = (screen.W - W) / 2
  const y = Math.max(u(10), (screen.H - H) / 2)
  panel(ctx, x, y, W, H, u, true)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.font = `${u(16)}px ${FONT_TITLE}`
  ctx.fillStyle = PALETTE.vermilion
  ctx.fillText('HOW TO BE A TURTLE', x + u(20), y + u(18))
  let yy = y + u(52)
  for (const [k, v] of HELP) {
    ctx.font = `${u(13)}px ${FONT_TITLE}`
    ctx.fillStyle = PALETTE.ink
    ctx.fillText(k, x + u(20), yy + u(2))
    ctx.font = `${u(14)}px ${FONT_BODY}`
    ctx.fillStyle = '#4a3e36'
    ctx.fillText(v, x + u(190), yy)
    yy += u(22)
  }
  yy += u(12)
  ctx.font = `${u(13)}px ${FONT_TITLE}`
  ctx.fillStyle = PALETTE.vermilion
  ctx.fillText('THINGS TO TRY', x + u(20), yy)
  yy += u(24)
  ctx.font = `${u(14)}px ${FONT_BODY}`
  ctx.fillStyle = PALETTE.ink
  for (const l of tryLines) {
    ctx.fillText(l, x + u(20), yy)
    yy += u(20)
  }
  ctx.textBaseline = 'alphabetic'
}

// ---------- map ----------

export interface MapMarker {
  x: number
  y: number
  color: string
  label?: string
  status?: string
  inside?: boolean
}

export function drawMap(
  screen: Screen,
  snapshot: HTMLCanvasElement,
  markers: MapMarker[],
  player: { x: number; y: number },
  clock: Clock,
  t: number,
): void {
  const ctx = screen.dctx
  const u = (n: number) => screen.u(n)
  ctx.fillStyle = 'rgba(26, 18, 32, 0.82)'
  ctx.fillRect(0, 0, screen.W, screen.H)
  const narrow = screen.W < screen.H * 1.1
  const listW = narrow ? 0 : Math.min(u(330), screen.W * 0.34)
  const availW = screen.W - listW - u(40)
  const availH = narrow ? screen.H * 0.55 : screen.H - u(80)
  const k = Math.min(availW / snapshot.width, availH / snapshot.height)
  const mw = snapshot.width * k
  const mh = snapshot.height * k
  const mx = u(20)
  const my = narrow ? u(56) : (screen.H - mh) / 2
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(snapshot, mx, my, mw, mh)
  ctx.imageSmoothingEnabled = false
  ctx.strokeStyle = PALETTE.gold
  ctx.lineWidth = u(2)
  ctx.strokeRect(mx, my, mw, mh)

  ctx.textBaseline = 'middle'
  ctx.font = `${u(11)}px ${FONT_BODY}`
  for (const m of markers) {
    if (m.inside) continue
    const x = mx + m.x * k
    const y = my + m.y * k
    ctx.beginPath()
    ctx.arc(x, y, u(4), 0, Math.PI * 2)
    ctx.fillStyle = m.color
    ctx.fill()
    ctx.lineWidth = u(1.5)
    ctx.strokeStyle = PALETTE.ink
    ctx.stroke()
    if (m.label) {
      ctx.lineWidth = u(3)
      ctx.strokeText(m.label, x + u(7), y)
      ctx.fillStyle = PALETTE.washi
      ctx.fillText(m.label, x + u(7), y)
    }
  }
  // The turtle, pulsing.
  const px = mx + player.x * k
  const py = my + player.y * k
  ctx.beginPath()
  ctx.arc(px, py, u(6 + Math.sin(t * 5) * 1.5), 0, Math.PI * 2)
  ctx.fillStyle = '#86a650'
  ctx.fill()
  ctx.strokeStyle = PALETTE.washi
  ctx.lineWidth = u(2)
  ctx.stroke()

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.font = `${u(16)}px ${FONT_TITLE}`
  ctx.fillStyle = PALETTE.gold
  ctx.fillText('KUMOI VILLAGE', mx, (narrow ? u(18) : my - u(30)))

  // Who's where.
  const people = markers.filter((m) => m.status)
  const lx = narrow ? u(20) : mx + mw + u(24)
  let ly = narrow ? my + mh + u(18) : my
  ctx.font = `${u(13)}px ${FONT_TITLE}`
  ctx.fillStyle = PALETTE.gold
  ctx.fillText(`WHO’S WHERE · ${clock.hhmm()}`, lx, ly)
  ly += u(24)
  const rowH = narrow ? u(18) : u(21)
  for (const m of people) {
    ctx.beginPath()
    ctx.arc(lx + u(5), ly + u(7), u(4), 0, Math.PI * 2)
    ctx.fillStyle = m.color
    ctx.fill()
    ctx.font = `${u(13)}px ${FONT_BODY}`
    ctx.fillStyle = PALETTE.washi
    ctx.fillText(m.label ?? '', lx + u(16), ly)
    const nw = u(narrow ? 90 : 96)
    ctx.fillStyle = m.inside ? '#8a7f70' : PALETTE.dim
    ctx.fillText(m.status ?? '', lx + u(16) + nw, ly)
    ly += rowH
  }
  ctx.font = `${u(11)}px ${FONT_BODY}`
  ctx.fillStyle = '#8a7f70'
  ctx.fillText(`M to close · time ×${SPEEDS[clock.speedIdx]}`, lx, ly + u(8))
  ctx.textBaseline = 'alphabetic'
}
