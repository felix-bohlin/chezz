// Layered screen: the world is drawn into a small low-res canvas and blown up by an integer factor
// (crisp pixels, no shimmer) onto the world canvas, which carries a CSS colour grade; UI text is
// drawn on a separate full-resolution canvas above it, ungraded.

import type { Ctx } from './pixel'

/** Roughly how many world pixels we want across the view. 440 ≈ 27 tiles. */
const TARGET_W = 440
const TARGET_H = 250

export class Screen {
  readonly el: HTMLCanvasElement
  /** World display context (graded). */
  readonly wctx: Ctx
  readonly uiEl: HTMLCanvasElement
  /** UI context, full resolution, cleared every frame. */
  readonly dctx: Ctx
  readonly low: HTMLCanvasElement
  readonly ctx: Ctx
  /** Device pixels per world pixel. */
  scale = 3
  /** Low-res (world pixel) size of the view. */
  w = TARGET_W
  h = TARGET_H
  dpr = 1

  constructor(el: HTMLCanvasElement) {
    this.el = el
    this.wctx = el.getContext('2d')!
    this.uiEl = (document.getElementById('ui') as HTMLCanvasElement | null) ?? document.createElement('canvas')
    this.dctx = this.uiEl.getContext('2d')!
    this.low = document.createElement('canvas')
    this.ctx = this.low.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  /** Full-resolution canvas size in device pixels. */
  get W(): number {
    return this.el.width
  }
  get H(): number {
    return this.el.height
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1
    const W = Math.round(window.innerWidth * this.dpr)
    const H = Math.round(window.innerHeight * this.dpr)
    this.el.width = W
    this.el.height = H
    this.uiEl.width = W
    this.uiEl.height = H
    this.scale = Math.max(1, Math.round(Math.min(W / TARGET_W, H / TARGET_H)))
    this.w = Math.ceil(W / this.scale)
    this.h = Math.ceil(H / this.scale)
    this.low.width = this.w
    this.low.height = this.h
    this.ctx.imageSmoothingEnabled = false
    this.wctx.imageSmoothingEnabled = false
    this.dctx.imageSmoothingEnabled = false
  }

  /** Colour grade for the world layer (a CSS filter; only touched when it changes). */
  private grade = ''
  setGrade(filter: string): void {
    if (filter === this.grade) return
    this.grade = filter
    this.el.style.filter = filter
  }

  present(): void {
    this.wctx.imageSmoothingEnabled = false
    this.wctx.drawImage(this.low, 0, 0, this.w * this.scale, this.h * this.scale)
    this.dctx.clearRect(0, 0, this.W, this.H)
  }

  /** CSS pixels → device pixels, for UI sizes. */
  u(cssPx: number): number {
    return Math.round(cssPx * this.dpr)
  }
}
