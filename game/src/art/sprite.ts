import { canvas, ellipse, mute, outline, type Ctx } from '../engine/pixel'

/** A pre-rendered image plus the pixel inside it that sits on the world anchor point. */
export interface Sprite {
  img: HTMLCanvasElement
  ax: number
  ay: number
}

export interface BuildOpts {
  /** Outline colour (1px, drawn around every opaque shape). */
  outline?: string
  /** Soft ground shadow slipped underneath after outlining. */
  shadow?: { cx: number; cy: number; rx: number; ry: number; alpha?: number }
}

/** Draw `body` into a fresh canvas, outline it, then slip a soft ground shadow underneath. */
export function build(w: number, h: number, body: (ctx: Ctx) => void, opts: BuildOpts = {}): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h)
  body(ctx)
  mute(c, 0.22)
  if (opts.outline) outline(c, opts.outline)
  if (opts.shadow) {
    const s = opts.shadow
    ctx.globalCompositeOperation = 'destination-over'
    ctx.globalAlpha = s.alpha ?? 0.28
    ellipse(ctx, s.cx, s.cy, s.rx, s.ry, '#10140c')
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  return c
}
