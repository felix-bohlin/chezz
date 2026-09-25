// Procedural pixel-art backdrop: dusk sky, red sun, Mt. Fuji, pagoda, torii and cherry trees.
// Drawn at a low resolution and upscaled with image-rendering: pixelated.

export const SCENE_W = 320
export const SCENE_H = 180

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function drawScenery(canvas: HTMLCanvasElement) {
  canvas.width = SCENE_W
  canvas.height = SCENE_H
  const ctx = canvas.getContext('2d')!
  const rand = rng(7)
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  // Banded dusk sky (hard bands = pixel-art gradient)
  const bands = ['#2b1d3a', '#3d2447', '#5a2c4f', '#7e3651', '#a8454f', '#cf6a4f', '#e8925a', '#f2b56e']
  const bandH = 118 / bands.length
  bands.forEach((c, i) => px(0, i * bandH, SCENE_W, bandH + 1, c))
  // Dithered band edges
  for (let i = 1; i < bands.length; i++) {
    const y = Math.round(i * bandH)
    for (let x = 0; x < SCENE_W; x += 2) px(x + (i % 2), y - 1, 1, 1, bands[i])
  }
  // Stars in the top bands
  for (let i = 0; i < 40; i++) px(rand() * SCENE_W, rand() * 34, 1, 1, rand() > 0.7 ? '#fff4d6' : '#c9b6d9')

  // Rising sun
  const sx = 226
  const sy = 78
  const R = 26
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = Math.sqrt(x * x + y * y)
      if (d <= R) px(sx + x, sy + y, 1, 1, d > R - 2 ? '#e2503f' : y > 8 && (y % 4 === 0) ? '#e2503f' : '#f0654a')
    }
  }

  // Distant mountain range
  const far = '#6b3b5e'
  for (let x = 0; x < SCENE_W; x++) {
    const h = 22 + Math.sin(x * 0.045) * 7 + Math.sin(x * 0.13 + 1) * 3
    px(x, 118 - h, 1, h, far)
  }
  // Mt. Fuji with snow cap
  const fx = 110
  for (let x = -90; x <= 90; x++) {
    const h = Math.max(0, 70 - Math.abs(x) * 0.78 - (Math.abs(x) > 60 ? (Math.abs(x) - 60) * 0.3 : 0))
    if (h <= 0) continue
    const top = 118 - h
    px(fx + x, top, 1, h, '#4b2a4f')
    const snow = Math.max(0, 22 - Math.abs(x) * 0.25 + Math.sin(x * 0.9) * 3)
    if (Math.abs(x) < 26) px(fx + x, top, 1, Math.min(h, snow), Math.abs(x) < 2 ? '#fff' : '#f3e9f2')
  }
  // Mist band
  for (let x = 0; x < SCENE_W; x++) if ((x + 1) % 3) px(x, 108 + ((x >> 3) % 2), 1, 1, '#c97a74')

  // Near hills
  for (let x = 0; x < SCENE_W; x++) {
    const h = 26 + Math.sin(x * 0.03 + 2) * 8 + Math.sin(x * 0.11) * 2
    px(x, 140 - h, 1, h, '#2f2240')
  }

  // Pagoda silhouette on the left hill
  const pg = (x: number, y: number) => {
    const c = '#1c1428'
    for (let t = 0; t < 4; t++) {
      const w = 24 - t * 4
      const ty = y - t * 9
      px(x - w / 2 - 2, ty, w + 4, 2, c)
      px(x - w / 2 - 3, ty + 1, 1, 1, c)
      px(x + w / 2 + 2, ty + 1, 1, 1, c)
      px(x - w / 2 + 2, ty + 2, w - 4, 7, c)
      px(x - w / 2 + 4, ty + 3, 1, 3, '#f2b56e')
      px(x + w / 2 - 5, ty + 3, 1, 3, '#f2b56e')
    }
    px(x, y - 42, 1, 8, c)
  }
  pg(40, 110)

  // Ground
  px(0, 140, SCENE_W, 40, '#1f1830')
  for (let x = 0; x < SCENE_W; x += 1) if ((x * 7) % 5 === 0) px(x, 140, 1, 1, '#3a2b4a')

  // Torii gate on the right
  const tx = 270
  const tc = '#c7302a'
  const td = '#8a1e1e'
  px(tx - 22, 104, 44, 3, '#1c1428')
  px(tx - 24, 103, 3, 2, '#1c1428')
  px(tx + 21, 103, 3, 2, '#1c1428')
  px(tx - 19, 107, 38, 3, tc)
  px(tx - 17, 114, 34, 2, tc)
  px(tx - 1, 110, 2, 4, tc)
  px(tx - 14, 110, 3, 30, tc)
  px(tx + 11, 110, 3, 30, tc)
  px(tx - 14, 110, 1, 30, td)
  px(tx + 11, 110, 1, 30, td)

  // Cherry trees in the foreground
  const tree = (x: number, y: number, s: number) => {
    const trunk = '#2a1a22'
    px(x, y - 22 * s, 3 * s, 22 * s, trunk)
    px(x - 6 * s, y - 20 * s, 7 * s, 2 * s, trunk)
    px(x + 2 * s, y - 25 * s, 8 * s, 2 * s, trunk)
    const blossoms = ['#f7b8c8', '#f39ab3', '#fcd6e0', '#e07c9a']
    for (let i = 0; i < 260 * s; i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * 16 * s
      const bx = x + Math.cos(a) * r * 1.4
      const by = y - 30 * s + Math.sin(a) * r * 0.8
      px(bx, by, 2, 2, blossoms[Math.floor(rand() * blossoms.length)])
    }
  }
  tree(18, 160, 1.2)
  tree(302, 164, 1)

  // Stone lanterns
  const lantern = (x: number, y: number) => {
    const c = '#4a4058'
    px(x - 4, y - 16, 9, 2, c)
    px(x - 2, y - 14, 5, 4, c)
    px(x - 1, y - 13, 3, 2, '#ffcf6b')
    px(x - 3, y - 10, 7, 2, c)
    px(x - 1, y - 8, 3, 6, c)
    px(x - 3, y - 2, 7, 2, c)
  }
  lantern(78, 168)
  lantern(244, 168)
}
