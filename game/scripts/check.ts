// Layout sanity check, run in node: `pnpm check`. Prints the map as ASCII and fails on
// unreachable doors/places/areas, buildings on roads or water, and overlapping solid props.

import { areaTiles, findPath, makeGrid } from '../src/world/grid'
import { buildWorld, idx, propColumns, T } from '../src/world/layout'
import { CAST } from '../src/sim/cast'

const world = buildWorld()
const grid = makeGrid(world)
const errors: string[] = []

// ASCII dump.
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
}
const rows: string[][] = []
for (let y = 0; y < world.h; y++) {
  rows.push([])
  for (let x = 0; x < world.w; x++) rows[y].push(CH[world.tiles[idx(x, y)]] ?? '?')
}
for (const p of world.props) {
  const c = p.kind === 'tree' ? 'T' : p.kind === 'bamboo' ? 'b' : p.kind === 'fence' ? '#' : p.solid ? 'o' : ','
  for (let x = p.x; x < p.x + (p.w ?? 1); x++) if (world.tiles[idx(x, p.y)] !== T.Forest) rows[p.y][x] = c
}
for (const b of world.buildings) {
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) rows[y][x] = 'B'
  rows[b.door.y][b.door.x] = 'D'
}
console.log(rows.map((r) => r.join('')).join('\n'))

// Buildings must sit on grass/gravel only.
for (const b of world.buildings)
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const t = world.tiles[idx(x, y)]
      if (t !== T.Grass && t !== T.Gravel) errors.push(`${b.id} covers tile ${x},${y} of type ${t}`)
    }

// Solid props must not sit on roads, water or buildings, nor overlap each other.
const seen = new Map<number, string>()
for (const p of world.props) {
  for (const x of propColumns(p)) {
    const i = idx(x, p.y)
    const t = world.tiles[i]
    if (p.solid && p.kind !== 'boat' && (t === T.Road || t === T.Water || t === T.Bridge)) errors.push(`${p.kind} at ${x},${p.y} on tile ${t}`)
    if (p.kind === 'boat' && t !== T.Water) errors.push(`boat at ${x},${p.y} not on water`)
    if (grid.buildingAt[i]) errors.push(`${p.kind} at ${x},${p.y} inside a building`)
    if (p.solid && seen.has(i)) errors.push(`${p.kind} at ${x},${p.y} overlaps ${seen.get(i)}`)
    if (p.solid) seen.set(i, p.kind)
  }
}

// Every door and place walkable, and reachable from the teahouse door.
const hub = world.places['door:teahouse']
for (const [name, p] of Object.entries(world.places)) {
  if (grid.solidNpc[idx(p.x, p.y)]) errors.push(`place ${name} (${p.x},${p.y}) is solid`)
  else if (!findPath(world, grid, hub, p)) errors.push(`place ${name} (${p.x},${p.y}) unreachable`)
}
for (const [name, a] of Object.entries(world.areas)) {
  const tiles = areaTiles(world, grid, a)
  if (!tiles.length) errors.push(`area ${name} has no tiles`)
  if (name !== 'pond' && tiles.length && !findPath(world, grid, hub, tiles[0])) errors.push(`area ${name} unreachable`)
}

// Every schedule target exists.
for (const v of CAST) {
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
  console.error(`\n${errors.length} problem(s):\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log('layout ok')
