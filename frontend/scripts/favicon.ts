// Generates the favicon set from one 16x16 pixel grid: a black knight against the rising sun, on washi.
// Run: node scripts/favicon.ts   → public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const PALETTE: Record<string, string> = {
  w: '#f1e6cc', // washi
  r: '#d23c2a', // vermilion sun, knight's eye
  o: '#1a1220', // ink knight
}

const ICON = [
  '..wwwwwwwwwwww..',
  '.wwwwwwwrrrrrww.',
  'wwwwwwwrrrrrrrww',
  'wwwwwororrrrrrrw',
  'wwwwooooorrrrrrw',
  'wwwooroooorrrrrw',
  'wwooooooooorrrrw',
  'woooooooooorrrrw',
  'wooowwooooorrrww',
  'wwwwwooooorrrwww',
  'wwwwoooooowwwwww',
  'wwwwoooooowwwwww',
  'wwwoooooooowwwww',
  'wwoooooooooowwww',
  '.woooooooooowww.',
  '..wwwwwwwwwwww..',
]
const N = ICON.length

const pub = join(dirname(fileURLToPath(import.meta.url)), '../public')
const rgb = (hex: string) => [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16))

// SVG: one rect per horizontal run of a colour, crisp edges so it stays pixel art at any size.
const rects: string[] = []
ICON.forEach((row, y) => {
  for (let x = 0; x < N; ) {
    let end = x + 1
    while (end < N && row[end] === row[x]) end++
    if (row[x] !== '.') rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${PALETTE[row[x]]}"/>`)
    x = end
  }
})
writeFileSync(
  join(pub, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`,
)

// PNG at an integer scale; `opaque` fills the rounded corners (iOS rounds them itself) and adds a washi border.
function png(scale: number, pad = 0, opaque = false): Buffer {
  const W = N * scale + pad * 2
  const px = Buffer.alloc(W * W * 4)
  const [wr, wg, wb] = rgb(PALETTE.w)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.floor((x - pad) / scale)
      const sy = Math.floor((y - pad) / scale)
      const key = ICON[sy]?.[sx] ?? '.'
      const i = (y * W + x) * 4
      if (key === '.') {
        if (opaque) { px[i] = wr; px[i + 1] = wg; px[i + 2] = wb; px[i + 3] = 255 }
        continue
      }
      const [r, g, b] = rgb(PALETTE[key])
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
    }
  }
  const raw = Buffer.alloc((W * 4 + 1) * W)
  for (let y = 0; y < W; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
function crc32(buf: Buffer): number {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

// ICO holding PNG images at 16, 32 and 48 px (nearest-neighbour, so every size stays sharp).
const images = [1, 2, 3].map((s) => ({ size: N * s, data: png(s) }))
const header = Buffer.alloc(6 + 16 * images.length)
header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4)
let offset = header.length
images.forEach(({ size, data }, k) => {
  const e = 6 + 16 * k
  header[e] = size; header[e + 1] = size
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6)
  header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12)
  offset += data.length
})
writeFileSync(join(pub, 'favicon.ico'), Buffer.concat([header, ...images.map((i) => i.data)]))

writeFileSync(join(pub, 'apple-touch-icon.png'), png(11, 2, true)) // 16*11 + 2*2 = 180 px
console.log('wrote public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png')
