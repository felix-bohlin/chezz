// Renders every pose of the hermit sensei side by side into a PNG for visual review.
// Run: node scripts/preview-hermit.ts [out.png]
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { HERMIT_FRAMES, HERMIT_PALETTE, hermitProblems } from '../src/pixel/hermit.ts'

const problems = hermitProblems()
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const SCALE = 6
const PAD = 6
const frames = Object.entries(HERMIT_FRAMES)
const fw = frames[0][1][0].length
const fh = frames[0][1].length
const cellW = fw * SCALE + PAD * 2
const cellH = fh * SCALE + PAD * 2
const W = cellW * frames.length
const H = cellH
const px = Buffer.alloc(W * H * 4)

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const light = Math.floor(x / cellW) % 2 === 0
    const i = (y * W + x) * 4
    px[i] = light ? 0xe9 : 0xd0; px[i + 1] = light ? 0xdc : 0xc2; px[i + 2] = light ? 0xc0 : 0xa4; px[i + 3] = 255
  }
}
frames.forEach(([, grid], fx) => {
  grid.forEach((row, sy) => {
    for (let sx = 0; sx < row.length; sx++) {
      const c = HERMIT_PALETTE[row[sx]]
      if (!c) continue
      const [r, g, b] = [1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16))
      for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
        const x = fx * cellW + PAD + sx * SCALE + dx
        const y = PAD + sy * SCALE + dy
        const i = (y * W + x) * 4
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
      }
    }
  })
})

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
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4)
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
])
const out = process.argv[2] ?? 'hermit-preview.png'
writeFileSync(out, png)
console.log(`wrote ${out} (${W}x${H}): ${frames.map(([n]) => n).join(', ')}`)
