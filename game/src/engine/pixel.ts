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

/** Pull colours toward a warm grey (k = 0 untouched … 1 sepia-grey). Weathers bright procedural art. */
export function mute(c: HTMLCanvasElement, k: number): void {
  const ctx = c.getContext('2d')!
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue
    const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11
    d[i] += (l * 1.05 - d[i]) * k
    d[i + 1] += (l - d[i + 1]) * k
    d[i + 2] += (l * 0.88 - d[i + 2]) * k
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Soot and weather on a building: mottled darkening, rain streaks running down from the eaves and
 * mud splashed up the bottom few rows. Deterministic per `seed`.
 */
export function grime(c: HTMLCanvasElement, seed: number): void {
  const ctx = c.getContext('2d')!
  const W = c.width
  const H = c.height
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  const h = (x: number, y: number, s: number) => {
    let v = (x * 374761393 + y * 668265263 + (seed + s) * 2246822519) | 0
    v = Math.imul(v ^ (v >>> 13), 1274126177)
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296
  }
  for (let x = 0; x < W; x++) {
    let bottom = -1
    for (let y = H - 1; y >= 0; y--)
      if (d[(y * W + x) * 4 + 3]) {
        bottom = y
        break
      }
    if (bottom < 0) continue
    // Streaks: a few columns get a darker run somewhere down the wall.
    const streak = h(x, 0, 1) < 0.2
    const s0 = Math.floor(h(x, 1, 2) * H * 0.7)
    const s1 = s0 + 6 + Math.floor(h(x, 2, 3) * 18)
    for (let y = 0; y <= bottom; y++) {
      const o = (y * W + x) * 4
      if (!d[o + 3]) continue
      // Blotchy grime: blocks of 3×3 share a value so it reads as stains, not noise.
      let f = 0.9 + h(x >> 2, y / 3 | 0, 4) * 0.12 + (h(x, y, 5) < 0.04 ? -0.08 : 0)
      if (streak && y >= s0 && y < s1) f *= 0.84 + ((y - s0) / (s1 - s0)) * 0.1
      const up = bottom - y
      let mud = 0
      if (up < 6) {
        f *= 0.8 + up * 0.035
        mud = (6 - up) * 0.05
      }
      d[o] = (d[o] * f) * (1 - mud) + 70 * mud
      d[o + 1] = (d[o + 1] * f) * (1 - mud) + 54 * mud
      d[o + 2] = (d[o + 2] * f) * (1 - mud) + 38 * mud
    }
  }
  ctx.putImageData(img, 0, 0)
}
