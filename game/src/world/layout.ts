// World data model and the builder the town plan (world/town.ts) uses. Pure data, no DOM, so
// scripts/check.ts can validate the town in node.

export const TILE = 16
export const MAP_W = 144
export const MAP_H = 112

export const T = {
  Grass: 0,
  Road: 1,
  Plaza: 2,
  Gravel: 3,
  Water: 4,
  Paddy: 5,
  Field: 6,
  Bridge: 7,
  Forest: 8,
  Pier: 9,
  Sea: 10,
  Sand: 11,
  Cliff: 12,
  Stairs: 13,
  Stone: 14,
  Moat: 15,
} as const
export type Tile = (typeof T)[keyof typeof T]

/** Tiles the turtle swims in (and villagers can't enter). */
export const isWet = (t: number) => t === T.Water || t === T.Sea || t === T.Moat

export const CROP = { none: 0, daikon: 1, cabbage: 2, eggplant: 3, cucumber: 4 } as const

export type Dir = 'down' | 'up' | 'left' | 'right'
export interface Pt {
  x: number
  y: number
}
export interface Place extends Pt {
  face?: Dir
}
export interface Area {
  x: number
  y: number
  w: number
  h: number
  /** Only these tile types count as inside the area. */
  only?: Tile[]
}

export type BuildingKind =
  | 'minka'
  | 'minkaOld'
  | 'cottage'
  | 'machiya'
  | 'shop'
  | 'teahouse'
  | 'tavern'
  | 'inn'
  | 'bathhouse'
  | 'brewery'
  | 'kura'
  | 'shrine'
  | 'hut'
  | 'guardpost'
  | 'fishhut'
  | 'coop'
  | 'samurai'
  | 'nagaya'
  | 'smithy'
  | 'workshop'
  | 'fishmarket'
  | 'shipwright'
  | 'watchtower'
  | 'castle'
  | 'tower'
  | 'gate'
  | 'gateSide'
  | 'sanmon'
  | 'hondo'
  | 'pagoda'
  | 'belltower'
  | 'kamehouse'
  | 'tent'
  | 'ruin'

export interface Building {
  id: string
  kind: BuildingKind
  /** Art variant (shop goods, noren colour, …). */
  variant?: string
  name: string
  x: number
  y: number
  w: number
  h: number
  door: Pt
  /** Footprint tiles that stay walkable (the passage through a gate). */
  open?: Pt[]
  /** Text when the turtle inspects the door. */
  text: string | string[]
  /** For houses nobody simulated lives in: [from, to) minutes when the windows glow. */
  litHours?: [number, number][]
}

export type TreeKind = 'pine' | 'blackpine' | 'cedar' | 'broad' | 'maple' | 'willow' | 'persimmon' | 'sacred' | 'ginkgo'

export type PropKind =
  | 'tree'
  | 'bamboo'
  | 'bush'
  | 'hydrangea'
  | 'iris'
  | 'reeds'
  | 'rock'
  | 'lantern'
  | 'well'
  | 'board'
  | 'jizo'
  | 'sign'
  | 'bench'
  | 'nobori'
  | 'casks'
  | 'hay'
  | 'firewood'
  | 'scarecrow'
  | 'fence'
  | 'laundry'
  | 'brazier'
  | 'boat'
  | 'nets'
  | 'trough'
  | 'torii'
  | 'wall'
  | 'ship'
  | 'lighthouse'
  | 'grave'
  | 'incense'
  | 'stall'
  | 'bales'
  | 'crates'
  | 'anchor'
  | 'redbridge'
  | 'komainu'
  | 'table'
  | 'cart'
  | 'kago'
  | 'campfire'
  | 'bedroll'

export interface Prop {
  kind: PropKind
  /** Bottom-left tile of the footprint. */
  x: number
  y: number
  /** Footprint width / height in tiles (default 1); the footprint grows up from y. */
  w?: number
  h?: number
  variant?: string
  /** Blocks the turtle. */
  solid: boolean
  /** Blocks villagers and animals (default: same as solid). Benches block only the turtle. */
  npcSolid?: boolean
  name?: string
  text?: string | string[]
}

export interface District {
  name: string
  x: number
  y: number
  w: number
  h: number
}

export interface World {
  w: number
  h: number
  tiles: Uint8Array
  crops: Uint8Array
  /** Rice seedlings in a paddy tile: 1 planted, 0 bare water. Changes during play. */
  planted: Uint8Array
  buildings: Building[]
  props: Prop[]
  places: Record<string, Place>
  areas: Record<string, Area>
  /** Named parts of the map, announced when the turtle walks in. Earlier entries win. */
  districts: District[]
  /** Where the turtle starts. */
  start: Pt
}

export const idx = (x: number, y: number) => y * MAP_W + x

/** Tiles a prop occupies for collision. A torii only blocks at its two pillars. */
export function propTiles(p: Prop): Pt[] {
  const w = p.w ?? 1
  const h = p.h ?? 1
  if (p.kind === 'torii') return [
    { x: p.x, y: p.y },
    { x: p.x + w - 1, y: p.y },
  ]
  const out: Pt[] = []
  for (let y = p.y - h + 1; y <= p.y; y++) for (let x = p.x; x < p.x + w; x++) out.push({ x, y })
  return out
}

/** Helpers for writing the town plan. */
export class Builder {
  readonly w = MAP_W
  readonly h = MAP_H
  readonly tiles = new Uint8Array(MAP_W * MAP_H)
  readonly crops = new Uint8Array(MAP_W * MAP_H)
  readonly planted = new Uint8Array(MAP_W * MAP_H)
  readonly buildings: Building[] = []
  readonly props: Prop[] = []
  readonly places: Record<string, Place> = {}
  readonly areas: Record<string, Area> = {}
  readonly districts: District[] = []
  /** Tiles taken by buildings or solid props (so scattered nature stays out of the way). */
  readonly taken = new Uint8Array(MAP_W * MAP_H)

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }
  get(x: number, y: number): number {
    return this.inside(x, y) ? this.tiles[idx(x, y)] : T.Forest
  }
  set(x: number, y: number, t: Tile): void {
    if (this.inside(x, y)) this.tiles[idx(x, y)] = t
  }
  fill(x: number, y: number, w: number, h: number, t: Tile): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t)
  }
  /** Fill only where the current tile is one of `over`. */
  fillOver(x: number, y: number, w: number, h: number, t: Tile, over: number[]): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (over.includes(this.get(i, j))) this.set(i, j, t)
  }
  take(x: number, y: number, w = 1, h = 1): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inside(i, j)) this.taken[idx(i, j)] = 1
  }
  isTaken(x: number, y: number): boolean {
    return !this.inside(x, y) || !!this.taken[idx(x, y)]
  }

  building(b: Omit<Building, 'door'> & { door?: Pt; doorX?: number }): Building {
    const door = b.door ?? { x: b.doorX ?? b.x + Math.floor(b.w / 2), y: b.y + b.h }
    const full: Building = { ...b, door }
    delete (full as { doorX?: number }).doorX
    this.buildings.push(full)
    this.take(b.x, b.y, b.w, b.h)
    this.places[`door:${b.id}`] = { x: door.x, y: door.y, face: 'down' }
    return full
  }

  prop(p: Prop): Prop {
    this.props.push(p)
    if (p.solid) for (const t of propTiles(p)) this.take(t.x, t.y)
    return p
  }

  place(name: string, x: number, y: number, face?: Dir): void {
    this.places[name] = { x, y, face }
  }

  area(name: string, x: number, y: number, w: number, h: number, only?: Tile[]): void {
    this.areas[name] = { x, y, w, h, only }
  }

  district(name: string, x: number, y: number, w: number, h: number): void {
    this.districts.push({ name, x, y, w, h })
  }
}
