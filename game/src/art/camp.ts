// The grim end of town: refugee tents outside the West Gate and a burnt-out house.

import { dot, px } from '../engine/pixel'
import { hash, rng } from '../engine/rng'
import type { Building } from '../world/layout'
import { finish, frame, PAD, type BuildingArt, type Rect } from './kit'

const CLOTH = ['#6e6450', '#7c705a', '#857a62', '#5c5444']
const PATCH = ['#5a4a6a', '#7a4a3a', '#4a5a4a', '#8a7a5a', '#3e4658']

/** A ridge tent of patched hemp sacking, stakes and guy ropes; a fire's glow in the opening at night. */
export function tent(b: Building): BuildingArt {
  const { W, H, doorX, ctx, img } = frame(b, 8)
  const r = rng(b.x * 71 + b.y * 13)
  const top = 6
  const bottom = H - 3
  const x0 = PAD + 2
  const x1 = W - PAD - 3
  // Sloping cloth: narrow at the ridge pole, full width at the ground.
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / (bottom - top)
    const l = Math.round(doorX - 4 - (doorX - 4 - x0) * t)
    const rr = Math.round(doorX + 4 + (x1 - doorX - 4) * t)
    for (let x = l; x <= rr; x++) {
      const fold = Math.floor((x - doorX) / 5) % 2 === 0
      let c = CLOTH[fold ? 1 : 2]
      if (hash(x, y, 7) < 0.06) c = CLOTH[3]
      if (x === l || x === rr) c = CLOTH[3]
      dot(ctx, x, y, c)
    }
  }
  // Patches, crookedly stitched.
  for (let i = 0; i < 4; i++) {
    const pw = 4 + Math.floor(r() * 4)
    const ph = 3 + Math.floor(r() * 3)
    const t = 0.3 + r() * 0.5
    const y = Math.round(top + (bottom - top) * t)
    const half = Math.round(4 + (x1 - x0) * 0.5 * t)
    const x = Math.round(doorX - half + r() * (half * 2 - pw))
    if (Math.abs(x + pw / 2 - doorX) < 7) continue
    px(ctx, x, y, pw, ph, PATCH[Math.floor(r() * PATCH.length)])
    for (let k = x; k < x + pw; k += 2) dot(ctx, k, y, '#2a2420')
  }
  // Ridge pole sticking out at both ends.
  px(ctx, doorX - 6, top - 1, 13, 2, '#4a3422')
  dot(ctx, doorX - 7, top - 2, '#4a3422')
  dot(ctx, doorX + 7, top - 2, '#4a3422')
  // The opening: a dark triangle at the front.
  const windows: Rect[] = []
  const oh = 14
  for (let j = 0; j < oh; j++) {
    const half = Math.round((j / oh) * 6)
    px(ctx, doorX - half, bottom - oh + j + 1, half * 2 + 1, 1, '#16110e')
  }
  windows.push({ x: doorX - 3, y: bottom - 6, w: 7, h: 6 })
  // Guy ropes and stakes.
  for (const [sx, dir] of [
    [x0, -1],
    [x1, 1],
  ]) {
    for (let k = 0; k < 3; k++) dot(ctx, sx + dir * k, bottom - 3 + k, '#8a7a5a')
    px(ctx, sx + dir * 3, bottom, 1, 2, '#3a2a1c')
  }
  // A bundle and a cooking pot by the entrance.
  px(ctx, doorX + 9, bottom - 3, 5, 4, '#7a6a4a')
  px(ctx, doorX + 9, bottom - 3, 5, 1, '#9a8a62')
  px(ctx, doorX - 13, bottom - 2, 4, 3, '#2a2626')
  dot(ctx, doorX - 12, bottom - 3, '#4a4644')
  return finish(img, { windows, lamps: [] })
}

/** A burnt-out townhouse: charred posts, a collapsed black roof, ash, one plaster wall still standing. */
export function ruin(b: Building): BuildingArt {
  const { W, H, ctx, img } = frame(b, 22)
  const r = rng(b.x * 31 + b.y)
  const ground = H - 3
  // Ash and rubble floor.
  for (let y = ground - 22; y <= ground; y++)
    for (let x = PAD + 1; x < W - PAD - 1; x++) {
      const h = hash(x, y, 11)
      dot(ctx, x, y, h < 0.5 ? '#4a4540' : h < 0.8 ? '#5a554e' : h < 0.95 ? '#36302c' : '#6e6862')
    }
  // The one wall left standing (left end), soot licking up it.
  const wx = PAD + 3
  px(ctx, wx, ground - 40, 18, 40, '#a8a090')
  for (let x = wx; x < wx + 18; x++) {
    const soot = 10 + Math.floor(hash(x, 0, 12) * 26)
    px(ctx, x, ground - soot, 1, soot, hash(x, 1, 13) < 0.5 ? '#2a2420' : '#3a322c')
  }
  px(ctx, wx, ground - 41, 18, 2, '#2a201a')
  // A window hole through it.
  px(ctx, wx + 6, ground - 32, 7, 6, '#16110e')
  // Charred posts at uneven heights, some snapped.
  for (let i = 0; i < 6; i++) {
    const x = PAD + 26 + i * 12 + Math.floor(r() * 4)
    if (x > W - PAD - 6) break
    const h = 12 + Math.floor(r() * 30)
    px(ctx, x, ground - h, 3, h, '#1e1a18')
    px(ctx, x, ground - h, 1, h, '#3a302a')
    dot(ctx, x + 1, ground - h - 1, '#1e1a18')
    if (r() < 0.4) dot(ctx, x + 2, ground - h - 1, '#1e1a18')
  }
  // A beam leaning across, and the fallen roof: a heap of black tiles and thatch.
  for (let k = 0; k < 28; k++) dot(ctx, PAD + 30 + k, ground - 30 + Math.floor(k * 0.7), '#241e1a')
  for (let k = 0; k < 28; k++) dot(ctx, PAD + 30 + k, ground - 29 + Math.floor(k * 0.7), '#3a2e26')
  for (let i = 0; i < 70; i++) {
    const x = PAD + 28 + Math.floor(r() * (W - PAD * 2 - 34))
    const y = ground - 14 + Math.floor(r() * 12)
    px(ctx, x, y, 3 + Math.floor(r() * 3), 2, r() < 0.5 ? '#2a2428' : r() < 0.6 ? '#3a3236' : '#4a3a2a')
  }
  // Something that was a chest, and a tea kettle that survived everything.
  px(ctx, W - PAD - 18, ground - 6, 8, 5, '#2a1e16')
  px(ctx, W - PAD - 18, ground - 6, 8, 1, '#4a3a2a')
  px(ctx, PAD + 24, ground - 4, 4, 3, '#3a3a3e')
  dot(ctx, PAD + 25, ground - 5, '#5a5a60')
  return finish(img, { windows: [], lamps: [] })
}
