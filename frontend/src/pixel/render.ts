import { HERMIT, HERMIT_NOSEBLEED, HERMIT_PALETTE } from './hermit'
import { SPRITES, SPRITE_SIZE, colorFor, type Army, type PieceType } from './sprites'

const cache = new Map<string, string>()

function gridToUrl(rows: string[], color: (key: string) => string | null, scale = 1): string {
  const h = rows.length
  const w = rows[0].length
  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const c = color(row[x])
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  })
  return canvas.toDataURL()
}

export function spriteUrl(type: PieceType, army: Army): string {
  const key = `${type}${army}`
  let url = cache.get(key)
  if (!url) {
    url = gridToUrl(SPRITES[type], (k) => colorFor(k, army))
    cache.set(key, url)
  }
  return url
}

export { SPRITE_SIZE }

/** Same size as the hermit, transparent except the nosebleed, so it can sit on top and drip in. */
export function hermitNosebleedUrl(): string {
  let url = cache.get('hermit-bleed')
  if (!url) {
    const rows = HERMIT.map((r) => [...'.'.repeat(r.length)])
    for (const [x, y, light] of HERMIT_NOSEBLEED) rows[y][x] = light ? 'B' : 'b'
    url = gridToUrl(
      rows.map((r) => r.join('')),
      (k) => (k === 'B' ? '#e8283c' : k === 'b' ? '#9a1020' : null),
    )
    cache.set('hermit-bleed', url)
  }
  return url
}

export function hermitUrl(): string {
  let url = cache.get('hermit')
  if (!url) {
    url = gridToUrl(HERMIT, (k) => HERMIT_PALETTE[k] ?? null)
    cache.set('hermit', url)
  }
  return url
}

// Board tiles: raked sand (light) and moss stone (dark), 20x20 like the sprites.
// Texture kept faint (ripples/specks close to the base colour) so the pieces are the busiest thing
// on the board; the sand is a shade deeper so ivory pieces don't vanish into it.
const TILE_COLORS: Record<string, string> = {
  '1': '#dccaa0', '2': '#d3c095', '3': '#e3d2ab',
  '4': '#6f8a64', '5': '#68825d', '6': '#779170', '7': '#637c59',
}

function tileRows(light: boolean): string[] {
  const rows: string[] = []
  for (let y = 0; y < 20; y++) {
    let row = ''
    for (let x = 0; x < 20; x++) {
      if (light) {
        const wave = Math.round(Math.sin((x / 20) * Math.PI * 2) * 1.2)
        const line = (y + wave + 40) % 5
        row += line === 0 ? '2' : line === 1 && (x * 7 + y) % 9 === 0 ? '3' : '1'
      } else {
        const n = (x * 13 + y * 7 + ((x * y) % 5)) % 17
        row += n === 0 ? '6' : n === 5 || n === 11 ? '5' : (x + y * 3) % 23 === 0 ? '7' : '4'
      }
    }
    rows.push(row)
  }
  return rows
}

export function tileUrl(light: boolean): string {
  const key = light ? 'tile-light' : 'tile-dark'
  let url = cache.get(key)
  if (!url) {
    url = gridToUrl(tileRows(light), (k) => TILE_COLORS[k] ?? null)
    cache.set(key, url)
  }
  return url
}

// Katana slash effect shown on captures.
const SLASH = [
  '..................ee',
  '................eem.',
  '..............eem...',
  '............eem.....',
  '..........eem.......',
  '........eem.........',
  '......eem...........',
  '....eem.............',
  '..eem...............',
  'eem.................',
]

export function slashUrl(): string {
  let url = cache.get('slash')
  if (!url) {
    url = gridToUrl(SLASH, (k) => (k === 'e' ? '#ffffff' : k === 'm' ? '#ffd9a0' : null))
    cache.set('slash', url)
  }
  return url
}
