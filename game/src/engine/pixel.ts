// Tiny pixel-art toolkit: offscreen canvases, rect plotting, palette grids, outlines and flips.
// Everything in the game is drawn by code into small canvases once, then blitted every frame.

export type Ctx = CanvasRenderingContext2D

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  return [c, ctx]
}

export function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export function dot(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
}

/** Filled pixel ellipse centred on (cx, cy). */
export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color
  const top = Math.round(cy - ry)
  const bottom = Math.round(cy + ry)
  for (let y = top; y <= bottom; y++) {
    const t = (y + 0.5 - cy) / ry
    if (Math.abs(t) > 1) continue
    const half = rx * Math.sqrt(1 - t * t)
    const x0 = Math.round(cx - half)
    const x1 = Math.round(cx + half)
    if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1)
  }
}

/** Sprite from rows of palette keys; '.' is transparent. */
export function fromGrid(rows: string[], palette: Record<string, string>): HTMLCanvasElement {
  const [c, ctx] = canvas(rows[0].length, rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]]
      if (col) dot(ctx, x, y, col)
    }
  })
  return c
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Blend two hex colours, t = 0 → a, 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexRgb(a)
  const [r2, g2, b2] = hexRgb(b)
  return rgbHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

/** Adds a 1px outline around every opaque shape, in place. Leave a 1px margin when drawing. */
export function outline(src: HTMLCanvasElement, color = '#1a1220', diagonals = false): HTMLCanvasElement {
  const ctx = src.getContext('2d', { willReadFrequently: true })!
  const { width: w, height: h } = src
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const out = new Uint8ClampedArray(d)
  const [r, g, b] = hexRgb(color)
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (d[i + 3] > 40) continue
      let hit = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)
      if (!hit && diagonals) hit = solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)
      if (hit) {
        out[i] = r
        out[i + 1] = g
        out[i + 2] = b
        out[i + 3] = 255
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0)
  return src
}

export function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = canvas(src.width, src.height)
  ctx.translate(src.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(src, 0, 0)
  return c
}

/** Bounding box of opaque pixels — used for occlusion fades and click targets. */
export function opaqueBounds(src: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
  const ctx = src.getContext('2d', { willReadFrequently: true })!
  const { width: w, height: h } = src
  const d = ctx.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x
        if (y < y0) y0 = y
        if (x > x1) x1 = x
        if (y > y1) y1 = y
      }
  return x1 < 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
