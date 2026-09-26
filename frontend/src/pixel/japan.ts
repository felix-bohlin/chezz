// Pixel-art map of Japan for the campaign screen. Rough coastlines in (lon, lat) are projected, tilted
// like an old Gyōki-zu map so the islands run left → right, and rasterised onto a coarse grid.

type LonLat = readonly [number, number]

const KYUSHU: LonLat[] = [
  [130.9, 33.95], [131.2, 33.6], [131.7, 33.6], [131.6, 33.2], [131.9, 32.9], [131.7, 32.4], [131.45, 31.9],
  [131.35, 31.4], [131.0, 31.3], [130.7, 31.0], [130.65, 31.5], [130.2, 31.3], [130.3, 31.9], [130.2, 32.3],
  [130.55, 32.6], [130.35, 32.75], [129.85, 32.7], [129.7, 33.1], [129.95, 33.45], [130.4, 33.6], [130.7, 33.9],
]

const SHIKOKU: LonLat[] = [
  [132.0, 33.35], [132.7, 33.85], [133.0, 34.1], [134.05, 34.35], [134.6, 34.2], [134.7, 33.8], [134.18, 33.25],
  [133.6, 33.5], [132.95, 32.75], [132.5, 33.0], [132.55, 33.2],
]

const HONSHU: LonLat[] = [
  [130.9, 34.0], [131.3, 34.0], [131.8, 34.05], [132.45, 34.35], [133.0, 34.35], [133.9, 34.55], [134.7, 34.75],
  [135.2, 34.7], [135.45, 34.65], [135.2, 34.3], [135.1, 33.9], [135.75, 33.45], [136.0, 33.7], [136.2, 34.07],
  [136.85, 34.3], [136.6, 34.7], [136.8, 35.05], [137.0, 34.6], [137.7, 34.65], [138.2, 34.6], [138.4, 35.0],
  [138.75, 35.1], [138.85, 34.6], [139.1, 35.0], [139.6, 35.25], [139.8, 35.6], [139.85, 35.3], [139.85, 34.9],
  [140.4, 35.15], [140.85, 35.7], [140.6, 36.3], [140.9, 37.0], [141.0, 37.8], [141.0, 38.25], [141.5, 38.3],
  [141.9, 39.0], [142.05, 39.55], [141.5, 40.5], [141.4, 41.4], [140.9, 41.5], [140.8, 41.0], [140.35, 41.25],
  [139.9, 40.6], [139.7, 39.9], [140.05, 39.4], [139.8, 38.9], [139.4, 38.2], [139.05, 37.95], [138.5, 37.4],
  [137.9, 37.05], [137.3, 36.75], [136.95, 37.1], [137.35, 37.5], [136.9, 37.4], [136.7, 36.9], [136.6, 36.6],
  [136.1, 36.2], [136.0, 35.7], [135.4, 35.55], [135.2, 35.75], [134.8, 35.65], [134.2, 35.55], [133.3, 35.55],
  [132.6, 35.45], [132.1, 35.0], [131.4, 34.5], [130.9, 34.35],
]

const HOKKAIDO: LonLat[] = [
  [140.7, 41.8], [140.1, 41.43], [139.85, 42.2], [140.35, 43.35], [141.3, 43.2], [141.65, 44.0], [141.7, 44.9],
  [141.95, 45.5], [142.6, 44.8], [143.9, 44.1], [144.3, 44.0], [145.3, 44.35], [145.2, 43.6], [145.8, 43.35],
  [144.4, 42.95], [143.25, 41.93], [142.2, 42.4], [141.6, 42.6], [140.95, 42.55], [140.3, 42.25], [140.75, 42.0],
  [141.15, 41.8],
]

const SADO: LonLat[] = [[138.2, 38.3], [138.55, 38.3], [138.5, 37.85], [138.2, 37.8]]
const AWAJI: LonLat[] = [[134.85, 34.6], [135.0, 34.6], [134.9, 34.2], [134.7, 34.25]]

const ISLANDS = [KYUSHU, SHIKOKU, HONSHU, HOKKAIDO, SADO, AWAJI]

/** Which side of its castle a province's label sits, so neighbours don't collide. */
export type Side = 't' | 'b' | 'r'

/** Provinces along the march, from the far south-west to the northern frontier. */
export const ROUTE = [
  { kanji: '薩摩', name: 'Satsuma', at: [130.55, 31.6] as LonLat, label: 'r' as Side },
  { kanji: '肥後', name: 'Higo', at: [130.8, 32.75] as LonLat, label: 'r' as Side },
  { kanji: '筑前', name: 'Chikuzen', at: [130.55, 33.5] as LonLat, label: 't' as Side },
  { kanji: '長門', name: 'Nagato', at: [131.3, 34.25] as LonLat, label: 't' as Side },
  { kanji: '安芸', name: 'Aki', at: [132.6, 34.55] as LonLat, label: 't' as Side },
  { kanji: '備前', name: 'Bizen', at: [134.0, 34.8] as LonLat, label: 't' as Side },
  { kanji: '山城', name: 'Yamashiro', at: [135.77, 35.05] as LonLat, label: 't' as Side },
  { kanji: '尾張', name: 'Owari', at: [136.95, 35.2] as LonLat, label: 'b' as Side },
  { kanji: '駿河', name: 'Suruga', at: [138.4, 35.15] as LonLat, label: 'b' as Side },
  { kanji: '武蔵', name: 'Musashi', at: [139.6, 35.85] as LonLat, label: 't' as Side },
  { kanji: '陸奥', name: 'Mutsu', at: [140.8, 38.3] as LonLat, label: 'r' as Side },
  { kanji: '津軽', name: 'Tsugaru', at: [140.6, 40.6] as LonLat, label: 'r' as Side },
  { kanji: '蝦夷', name: 'Ezo', at: [142.4, 43.4] as LonLat, label: 'b' as Side },
]

const TILT = (-34 * Math.PI) / 180 // rotate the map clockwise on screen
const CELL = 0.12 // map units per pixel cell
const PAD = 3 // sea cells around the land

function project([lon, lat]: LonLat): [number, number] {
  const x = (lon - 138) * Math.cos((37 * Math.PI) / 180)
  const y = 37 - lat
  return [x * Math.cos(TILT) + y * Math.sin(TILT), -x * Math.sin(TILT) + y * Math.cos(TILT)]
}

function inside(poly: [number, number][], x: number, y: number) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export interface JapanMap {
  w: number
  h: number
  /** SVG path data (grid units) for land, the coastline ring around it, and the shallows beyond. */
  land: string
  coast: string
  shallows: string
  /** Little wave dashes scattered over the open sea. */
  waves: string
  /** Grid position of a (lon, lat) point. */
  at: (p: LonLat) => { x: number; y: number }
}

let cached: JapanMap | undefined

export function japanMap(): JapanMap {
  if (cached) return cached
  const polys = ISLANDS.map((p) => p.map(project))
  const all = polys.flat()
  const minX = Math.min(...all.map((p) => p[0])) - PAD * CELL
  const minY = Math.min(...all.map((p) => p[1])) - PAD * CELL
  const w = Math.ceil((Math.max(...all.map((p) => p[0])) - minX) / CELL) + PAD
  const h = Math.ceil((Math.max(...all.map((p) => p[1])) - minY) / CELL) + PAD

  const land: boolean[][] = []
  for (let y = 0; y < h; y++) {
    land.push([])
    for (let x = 0; x < w; x++) {
      const px = minX + (x + 0.5) * CELL
      const py = minY + (y + 0.5) * CELL
      land[y].push(polys.some((p) => inside(p, px, py)))
    }
  }
  const isLand = (x: number, y: number) => land[y]?.[x] === true
  const near = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r && isLand(x + dx, y + dy)) return true
    return false
  }

  // One path per layer; horizontal runs of cells become single rectangles.
  const layer = (test: (x: number, y: number) => boolean) => {
    let d = ''
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!test(x, y)) continue
        let run = 1
        while (x + run < w && test(x + run, y)) run++
        d += `M${x} ${y}h${run}v1h${-run}z`
        x += run - 1
      }
    }
    return d
  }
  const edge = (x: number, y: number) => !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1)

  cached = {
    w,
    h,
    land: layer((x, y) => isLand(x, y) && !edge(x, y)),
    coast: layer((x, y) => isLand(x, y) && edge(x, y)),
    shallows: layer((x, y) => !isLand(x, y) && near(x, y, 2)),
    waves: layer((x, y) => (x + 3 * y) % 23 < 3 && (y * 5 + Math.floor(x / 23)) % 9 === 0 && !near(x, y, 4)),
    at: (p) => {
      const [x, y] = project(p)
      return { x: (x - minX) / CELL, y: (y - minY) / CELL }
    },
  }
  return cached
}

/** The provinces for an n-rung ladder: Satsuma first, Ezo last, the rest evenly spaced along the road. */
export function provincesFor(n: number) {
  const pts = ROUTE.map((r) => project(r.at))
  const dist = [0]
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = dist[dist.length - 1]
  const picked: number[] = []
  for (let i = 0; i < n; i++) {
    const target = n === 1 ? total : (i * total) / (n - 1)
    // Nearest waypoint to the target distance that keeps the road moving forward.
    const from = picked.length ? picked[picked.length - 1] + 1 : 0
    const left = n - i - 1
    let best = Math.min(from, ROUTE.length - 1)
    for (let j = best; j < ROUTE.length - left; j++) if (Math.abs(dist[j] - target) < Math.abs(dist[best] - target)) best = j
    picked.push(best)
  }
  return picked.map((j) => ROUTE[j])
}
