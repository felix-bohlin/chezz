// Collision and path costs derived from the layout. The turtle can swim (river, moat, sea),
// villagers cannot; nobody climbs cliffs; gates have walkable passages; benches stop the turtle
// but villagers sit on them.

import { astar } from '../engine/path'
import { idx, isWet, propTiles, T, TILE, type Area, type Pt, type World } from './layout'

export interface Grid {
  w: number
  h: number
  /** 1 = the turtle cannot enter. */
  solidPlayer: Uint8Array
  /** 1 = villagers and land animals cannot enter. */
  solidNpc: Uint8Array
  /** Building index + 1 per tile (0 = none). */
  buildingAt: Uint16Array
}

const ROADLIKE = new Set<number>([T.Road, T.Plaza, T.Bridge, T.Pier, T.Gravel, T.Stone, T.Stairs])

export function makeGrid(world: World): Grid {
  const { w, h, tiles } = world
  const solidPlayer = new Uint8Array(w * h)
  const solidNpc = new Uint8Array(w * h)
  const buildingAt = new Uint16Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const t = tiles[i]
    if (t === T.Forest || t === T.Cliff) {
      solidPlayer[i] = 1
      solidNpc[i] = 1
    }
    if (isWet(t)) solidNpc[i] = 1
  }
  world.buildings.forEach((b, bi) => {
    const open = new Set((b.open ?? []).map((p) => `${p.x},${p.y}`))
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        if (open.has(`${x},${y}`)) continue
        solidPlayer[idx(x, y)] = 1
        solidNpc[idx(x, y)] = 1
        buildingAt[idx(x, y)] = bi + 1
      }
  })
  for (const p of world.props)
    for (const t of propTiles(p)) {
      const i = idx(t.x, t.y)
      if (p.solid) solidPlayer[i] = 1
      if (p.npcSolid ?? p.solid) solidNpc[i] = 1
    }
  return { w, h, solidPlayer, solidNpc, buildingAt }
}

/** Step cost for villagers: roads are cheap, grass costs a bit, crops and paddies a lot. */
export function npcCost(world: World, grid: Grid): (i: number) => number {
  return (i: number) => {
    if (grid.solidNpc[i]) return Infinity
    const t = world.tiles[i]
    if (ROADLIKE.has(t)) return 1
    if (t === T.Field) return 6
    if (t === T.Paddy) return 7
    return 2.2
  }
}

export function findPath(world: World, grid: Grid, from: Pt, to: Pt): Pt[] | null {
  const path = astar(world.w, world.h, npcCost(world, grid), idx(from.x, from.y), idx(to.x, to.y), 40000)
  return path ? path.map((i) => ({ x: i % world.w, y: (i / world.w) | 0 })) : null
}

/** Walkable tiles of an area (for villagers); wet areas list their water tiles. */
export function areaTiles(world: World, grid: Grid, a: Area): Pt[] {
  const out: Pt[] = []
  const wetArea = a.only?.some((t) => isWet(t)) ?? false
  for (let y = a.y; y < a.y + a.h; y++)
    for (let x = a.x; x < a.x + a.w; x++) {
      if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue
      const i = idx(x, y)
      if (a.only && !a.only.includes(world.tiles[i] as never)) continue
      if (!wetArea && grid.solidNpc[i]) continue
      out.push({ x, y })
    }
  return out
}

/** Pixel position villagers stand at on a tile (feet a little below centre). */
export function tileFeet(p: Pt): Pt {
  return { x: p.x * TILE + 8, y: p.y * TILE + 11 }
}

export function tileOf(px: number, py: number): Pt {
  return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) }
}
