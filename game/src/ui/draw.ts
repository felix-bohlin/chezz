// Shared UI drawing bits: palette (matches the chess replay), fonts, text wrapping, rounded boxes.

import type { Ctx } from '../engine/pixel'

export const PALETTE = {
  ink: '#1a1220',
  washi: '#f1e6cc',
  vermilion: '#d23c2a',
  gold: '#e0b13c',
  moss: '#5c7654',
  panel: 'rgba(26, 18, 32, 0.86)',
  dim: '#b8ad94',
}

export const FONT_BODY = "'DotGothic16', monospace"
export const FONT_TITLE = "'Silkscreen', 'DotGothic16', monospace"
export const FONT_NUM = "'VT323', 'DotGothic16', monospace"

export function loadFonts(): Promise<unknown> {
  return Promise.all(['16px DotGothic16', '16px Silkscreen', '16px VT323'].map((f) => document.fonts.load(f).catch(() => null)))
}

export function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** A panel in the house style: ink fill, gold hairline, square-ish corners. */
export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, u: (n: number) => number, light = false): void {
  ctx.fillStyle = light ? PALETTE.washi : PALETTE.panel
  roundRect(ctx, x, y, w, h, u(4))
  ctx.fill()
  ctx.strokeStyle = light ? PALETTE.ink : PALETTE.gold
  ctx.lineWidth = u(light ? 2 : 1.5)
  ctx.stroke()
}
