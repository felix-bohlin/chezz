// Town sanity check, run in node: `pnpm check`. Prints the map as ASCII and fails on unreachable
// doors/places/areas, buildings on roads or water, overlapping solid props and bad schedules.

import { CAST } from '../src/sim/cast'
import { makeExtras } from '../src/sim/extras'
import { areaTiles, findPath, makeGrid } from '../src/world/grid'
import { idx, propTiles, T } from '../src/world/layout'
import { buildWorld } from '../src/world/town'

const world = buildWorld()
const grid = makeGrid(world)
const errors: string[] = []
const quiet = process.argv.includes('--quiet')

const CH: Record<number, string> = {
  [T.Grass]: '.',
  [T.Road]: '=',
  [T.Plaza]: '_',
  [T.Gravel]: ':',
  [T.Water]: '~',
  [T.Paddy]: 'p',
  [T.Field]: 'f',
  [T.Bridge]: 'H',
  [T.Forest]: '^',
  [T.Pier]: 'h',
  [T.Sea]: '≈',
  [T.Sand]: ',',
  [T.Cliff]: '#',
  [T.Stairs]: 'E',
  [T.Stone]: '+',
  [T.Moat]: 'm',
}
const rows: string[][] = []
for (let y = 0; y < world.h; y++) {
  rows.push([])
  for (let x = 0; x < world.w; x++) rows[y].push(CH[world.tiles[idx(x, y)]] ?? '?')
}
for (const p of world.props) {
  const c = p.kind === 'tree' ? 'T' : p.kind === 'bamboo' ? 'b' : p.kind === 'fence' ? '|' : p.kind === 'wall' ? 'W' : p.solid ? 'o' : rows[p.y][p.x]
  for (const t of propTiles(p)) if (world.tiles[idx(t.x, t.y)] !== T.Forest) rows[t.y][t.x] = c
}
for (const b of world.buildings) {
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) rows[y][x] = 'B'
  for (const o of b.open ?? []) rows[o.y][o.x] = 'O'
  rows[b.door.y][b.door.x] = 'D'
}
if (!quiet) console.log(rows.map((r) => r.join('')).join('\n'))

const GATES = new Set(['gate', 'gateSide', 'sanmon'])
const WET = new Set<number>([T.Water, T.Sea, T.Moat])
// Buildings stay off roads, water and cliffs (gates straddle roads by design).
for (const b of world.buildings) {
  if (GATES.has(b.kind)) continue
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const t = world.tiles[idx(x, y)]
      if (t === T.Road || WET.has(t) || t === T.Bridge || t === T.Cliff || t === T.Stairs || t === T.Pier)
        errors.push(`${b.id} covers tile ${x},${y} of type ${t}`)
    }
}
// Solid props off roads/bridges (boats and ships on water only), not inside buildings, no overlaps.
const seen = new Map<number, string>()
for (const p of world.props) {
  for (const t of propTiles(p)) {
    const i = idx(t.x, t.y)
    const tile = world.tiles[i]
    const floats = p.kind === 'boat' || p.kind === 'ship'
    if (p.solid && !floats && (tile === T.Road || WET.has(tile) || tile === T.Bridge || tile === T.Pier || tile === T.Stairs))
      errors.push(`${p.kind} at ${t.x},${t.y} on tile ${tile}`)
    if (floats && tile !== T.Sea && tile !== T.Water) errors.push(`${p.kind} at ${t.x},${t.y} not on water`)
    if (grid.buildingAt[i]) errors.push(`${p.kind} at ${t.x},${t.y} inside a building`)
    if (p.solid && seen.has(i)) errors.push(`${p.kind} at ${t.x},${t.y} overlaps ${seen.get(i)}`)
    if (p.solid) seen.set(i, p.kind)
  }
}

// Every door and place walkable and reachable from the town square.
const hub = world.places.teaCounter
const unreachable = (p: { x: number; y: number }) => !findPath(world, grid, hub, p)
for (const [name, p] of Object.entries(world.places)) {
  if (name.startsWith('door:tower')) continue
  if (grid.solidNpc[idx(p.x, p.y)]) errors.push(`place ${name} (${p.x},${p.y}) is solid`)
  else if (!name.startsWith('roshi') && name !== 'door:kamehouse' && unreachable(p)) errors.push(`place ${name} (${p.x},${p.y}) unreachable`)
}
for (const [name, a] of Object.entries(world.areas)) {
  const tiles = areaTiles(world, grid, a)
  if (!tiles.length) errors.push(`area ${name} has no tiles`)
  const wet = a.only?.some((t) => WET.has(t))
  if (!wet && name !== 'island' && tiles.length && unreachable(tiles[Math.floor(tiles.length / 2)])) errors.push(`area ${name} unreachable`)
}

// Every schedule target exists.
for (const v of [...CAST, ...makeExtras()]) {
  if (!world.places[v.home]) errors.push(`${v.id}: home ${v.home} is not a place`)
  for (const e of v.schedule) {
    const d = e.doing
    if (d.kind === 'spot' && !world.places[d.at]) errors.push(`${v.id} ${e.at}: unknown place ${d.at}`)
    if (d.kind === 'area' && !world.areas[d.area]) errors.push(`${v.id} ${e.at}: unknown area ${d.area}`)
    if (d.kind === 'patrol') for (const s of d.route) if (!world.places[s]) errors.push(`${v.id} ${e.at}: unknown place ${s}`)
  }
}

console.log(`\n${world.props.length} props, ${world.buildings.length} buildings, ${CAST.length} villagers`)
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n  ${errors.slice(0, 60).join('\n  ')}`)
  process.exit(1)
}
console.log('town ok')
