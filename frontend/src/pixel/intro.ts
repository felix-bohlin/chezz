// Pixel-art paintings for the intro scroll (docs/story/01-intro-story.md). Each panel is drawn at
// 160x90 and upscaled with image-rendering: pixelated, reusing the army sprites as the cast.
// Tokugawa wear the white clan's colors here, Akechi the red clan's.

import type { PanelArt } from '../story/intro'
import { SPRITES, SPRITE_SIZE, colorFor, type Army, type PieceType } from './sprites'

export const PANEL_W = 160
export const PANEL_H = 90

type Ctx = CanvasRenderingContext2D

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function painter(ctx: Ctx) {
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }
  const bands = (colors: string[], height: number) => {
    const h = height / colors.length
    colors.forEach((c, i) => px(0, i * h, PANEL_W, h + 1, c))
    // dithered edges, as in the backdrop
    for (let i = 1; i < colors.length; i++) {
      const y = Math.round(i * h)
      for (let x = 0; x < PANEL_W; x += 2) px(x + (i % 2), y - 1, 1, 1, colors[i])
    }
  }
  /** Draw an army sprite; `silhouette` paints every pixel one color, `flip` mirrors it. */
  const sprite = (type: PieceType, army: Army, x: number, y: number, opts: { flip?: boolean; silhouette?: string } = {}) => {
    SPRITES[type].forEach((row, sy) => {
      for (let sx = 0; sx < SPRITE_SIZE; sx++) {
        const c = colorFor(row[sx], army)
        if (!c) continue
        px(x + (opts.flip ? SPRITE_SIZE - 1 - sx : sx), y + sy, 1, 1, opts.silhouette ?? c)
      }
    })
  }
  const disc = (cx: number, cy: number, r: number, c: string) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) px(cx + x, cy + y, 1, 1, c)
  }
  const ridge = (base: number, amp: number, freq: number, phase: number, c: string) => {
    for (let x = 0; x < PANEL_W; x++) {
      const h = amp + Math.sin(x * freq + phase) * amp * 0.5 + Math.sin(x * freq * 2.7) * amp * 0.2
      px(x, base - h, 1, h + PANEL_H, c)
    }
  }
  const banner = (x: number, y: number, cloth: string, mon: string) => {
    px(x, y, 1, 22, '#1c1428')
    px(x + 1, y + 1, 5, 9, cloth)
    px(x + 3, y + 4, 1, 3, mon)
    px(x + 2, y + 5, 3, 1, mon)
  }
  return { px, bands, sprite, disc, ridge, banner }
}

const PAINT: Record<PanelArt, (ctx: Ctx) => void> = {
  // 1. Sakai at dawn: port town, merchant ships, Ieyasu with a small retinue.
  sakai(ctx) {
    const { px, bands, sprite, disc } = painter(ctx)
    bands(['#f7e0b0', '#f4c996', '#eeae84', '#e0937a'], 50)
    for (let y = 0; y <= 12; y++) for (let x = -14; x <= 14; x++) if (x * x + y * y <= 196) px(118 + x, 50 - y, 1, 1, '#f26a4f')
    px(0, 50, PANEL_W, 18, '#5d7fa6')
    for (let x = 0; x < PANEL_W; x += 7) px(x + ((x / 7) % 3), 54 + ((x / 7) % 4) * 3, 4, 1, '#9fb8d0')
    const ship = (x: number, s: number) => {
      px(x, 48, 14 * s, 3, '#3a2b4a')
      px(x + 5 * s, 36, 1, 12, '#3a2b4a')
      px(x + 2 * s, 37, 7 * s, 8, '#efe3cc')
    }
    ship(84, 1)
    ship(140, 0.8)
    px(0, 68, PANEL_W, 22, '#c9a878')
    for (let x = 0; x < PANEL_W; x += 3) px(x, 68 + (x % 2), 2, 1, '#b3915f')
    // tea house
    px(4, 40, 38, 4, '#3a2b4a')
    px(2, 42, 3, 2, '#3a2b4a')
    px(41, 42, 3, 2, '#3a2b4a')
    px(8, 44, 30, 24, '#e9dcc0')
    px(8, 44, 30, 2, '#b8a07a')
    px(14, 52, 8, 16, '#5a3a22')
    px(26, 50, 8, 7, '#f7e9c8')
    disc(146, 12, 1, '#fff4d6')
    sprite('p', 'w', 52, 50)
    sprite('k', 'w', 74, 49)
    sprite('p', 'w', 96, 50, { flip: true })
  },

  // 2. Honnō-ji burning: temple in flames under a red night sky.
  honnoji(ctx) {
    const { px, bands, sprite } = painter(ctx)
    const rand = rng(11)
    bands(['#140d1f', '#221432', '#3a1a35', '#5a2030', '#7a2a2a'], 70)
    px(0, 70, PANEL_W, 20, '#120c18')
    // smoke
    for (let i = 0; i < 160; i++) {
      const x = 60 + rand() * 50 + Math.sin(i) * 10
      const y = rand() * 40
      px(x, y, 2, 2, rand() > 0.5 ? '#4a3848' : '#5d4a5a')
    }
    // temple: two flared roofs on a hall
    const c = '#120c18'
    const roof = (cx: number, y: number, w: number) => {
      px(cx - w / 2, y, w, 3, c)
      px(cx - w / 2 - 3, y - 1, 3, 2, c)
      px(cx + w / 2, y - 1, 3, 2, c)
    }
    roof(80, 40, 56)
    px(60, 43, 40, 10, c)
    roof(80, 53, 76)
    px(50, 56, 60, 14, c)
    // flames licking up the walls and roofs
    const flame = ['#ffd45a', '#ff9b3a', '#f2542d', '#c7302a']
    for (let i = 0; i < 420; i++) {
      const x = 44 + rand() * 72
      const h = 1 - Math.abs(x - 80) / 40
      const y = 70 - rand() * rand() * 44 * (0.5 + h)
      px(x, y, 1, 1 + Math.floor(rand() * 3), flame[Math.floor(rand() * flame.length)])
    }
    // embers
    for (let i = 0; i < 40; i++) px(rand() * PANEL_W, rand() * 60, 1, 1, rand() > 0.5 ? '#ffd45a' : '#ff9b3a')
    // a lone figure in the smoke
    sprite('k', 'w', 128, 50, { silhouette: '#0a0710', flip: true })
  },

  // 3. The betrayal: Akechi marches out of Kyoto under bellflower banners.
  betrayal(ctx) {
    const { px, bands, sprite, banner, ridge } = painter(ctx)
    bands(['#2a1020', '#4a1626', '#6e1e2a', '#8a2a2a'], 60)
    ridge(60, 10, 0.05, 1, '#3a1422')
    px(0, 66, PANEL_W, 24, '#2a1c24')
    for (let x = 0; x < PANEL_W; x += 4) px(x, 66, 2, 1, '#3d2a34')
    // the army behind, in silhouette
    for (let i = 0; i < 9; i++) sprite('p', 'b', i * 18 - 4, 40, { silhouette: '#4a1626' })
    for (let i = 0; i < 6; i++) banner(8 + i * 28, 30, '#e9dcc0', '#3b5bb5')
    // the front rank
    sprite('p', 'b', 22, 50)
    sprite('b', 'b', 44, 50)
    sprite('k', 'b', 70, 48)
    sprite('n', 'b', 96, 50)
    sprite('p', 'b', 118, 50)
  },

  // 4. Cornered: Ieyasu's few men on a mountain road; hunters' torches in the valleys.
  cornered(ctx) {
    const { px, bands, sprite, disc, ridge } = painter(ctx)
    const rand = rng(23)
    bands(['#0f1424', '#18203a', '#22304f'], 50)
    for (let i = 0; i < 30; i++) px(rand() * PANEL_W, rand() * 30, 1, 1, '#c9d2e8')
    disc(28, 14, 7, '#e9e4cf')
    disc(31, 12, 6, '#0f1424')
    ridge(52, 16, 0.04, 0, '#1b2238')
    ridge(66, 12, 0.06, 2, '#141a2c')
    // winding road
    for (let y = 60; y < PANEL_H; y++) px(70 + Math.sin(y * 0.15) * 14 - (y - 60) * 0.6, y, 10 + (y - 60) * 0.8, 1, '#3a3346')
    // torches in the valleys
    const torch = (x: number, y: number) => {
      disc(x, y, 3, '#5a2a2a')
      px(x, y, 1, 1, '#ffcf6b')
      px(x, y - 1, 1, 1, '#ff9b3a')
    }
    for (const [x, y] of [[12, 72], [22, 80], [30, 70], [130, 74], [142, 82], [150, 70], [118, 84]]) torch(x, y)
    sprite('p', 'w', 54, 62)
    sprite('k', 'w', 70, 60)
    sprite('p', 'w', 86, 62, { flip: true })
  },

  // 5. Hanzō's oath: Hanzō kneels before Ieyasu; the Iga ninja watch from the trees.
  oath(ctx) {
    const { px, bands, sprite, disc } = painter(ctx)
    const rand = rng(5)
    bands(['#101826', '#172236', '#1f2d45'], 70)
    disc(106, 16, 10, '#e9e4cf')
    disc(102, 13, 2, '#d6d0b8')
    px(0, 70, PANEL_W, 20, '#1a2230')
    // trees
    for (const x of [6, 30, 132, 152]) {
      px(x, 0, 5, 72, '#0b1019')
      for (let i = 0; i < 70; i++) px(x - 10 + rand() * 25, rand() * 34, 3, 2, rand() > 0.5 ? '#16241f' : '#1c2e27')
    }
    // ninja in the branches, eyes catching the moon
    for (const [x, y] of [[20, 8], [140, 20], [2, 30]]) {
      sprite('n', 'w', x, y, { silhouette: '#05080d', flip: x > 80 })
      px(x + (x > 80 ? 7 : 11), y + 5, 1, 1, '#e9e4cf')
    }
    // Hanzō kneeling (set lower), Ieyasu facing him
    sprite('q', 'w', 58, 54)
    sprite('k', 'w', 88, 50, { flip: true })
  },

  // 6. The board: the scroll becomes the battlefield.
  board(ctx) {
    const { px, sprite } = painter(ctx)
    for (let r = 0; r < 5; r++) {
      for (let f = 0; f < 8; f++) px(f * 20, r * 20 - 5, 20, 20, (r + f) % 2 ? '#5c7654' : '#eadcbc')
    }
    const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
    back.forEach((t, f) => sprite(t, 'b', f * 20, -7))
    for (let f = 0; f < 8; f++) sprite('p', 'b', f * 20, 13)
    for (let f = 0; f < 8; f++) sprite('p', 'w', f * 20, 53)
    back.forEach((t, f) => sprite(t, 'w', f * 20, 73))
  },
}

export function paintPanel(canvas: HTMLCanvasElement, art: PanelArt): void {
  canvas.width = PANEL_W
  canvas.height = PANEL_H
  const ctx = canvas.getContext('2d')
  if (ctx) PAINT[art](ctx)
}
