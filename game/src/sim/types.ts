// Types and small helpers for writing villagers. Times are game time ("HH:MM").
//
// Schedule entries are resolved like a timetable: the latest entry whose time has passed is what
// the villager is doing now (wrapping past midnight). `days: 'market'` entries only count on
// market days (every third day, starting with day 1).

export type Pose =
  | 'stand'
  | 'sit'
  | 'plant'
  | 'hoe'
  | 'hammer'
  | 'sweep'
  | 'fish'
  | 'chant'
  | 'conch'
  | 'nap'
  | 'feed'
  | 'call'
  | 'shop'
  | 'serve'
  | 'guard'
  | 'alms'
  | 'carry'
  | 'tend'
  | 'play'
  | 'meditate'

export type Doing =
  | { kind: 'inside'; lit: boolean }
  | { kind: 'spot'; at: string; pose: Pose }
  | { kind: 'area'; area: string; pose: Pose; style: 'work' | 'wander' | 'chase' }
  /** Walk a loop of places; `pose` is held while walking (e.g. carrying), `stop` while waiting. */
  | { kind: 'patrol'; route: string[]; pose?: Pose; stop?: Pose; wait?: number }

export interface Entry {
  at: string
  /** Shown on the map's who's-where list, e.g. "planting rice". */
  label: string
  doing: Doing
  /** Said once when this entry starts (if the turtle is near, or always when `shout`). */
  say?: string
  shout?: boolean
  days?: 'market'
}

export type Hair = 'topknot' | 'bun' | 'grayBun' | 'kidBoy' | 'kidGirl' | 'bald' | 'short'
export type Hat = 'kasa' | 'jingasa' | 'tokin' | 'hachimaki' | 'tenugui'
export type Extra =
  | 'armor'
  | 'apron'
  | 'pompoms'
  | 'backpack'
  | 'banner'
  | 'happi'
  | 'creel'
  | 'swords'
  | 'hakama'
  | 'kesa'
  | 'beard'
  | 'shades'
  | 'shell'

export interface Look {
  kid?: boolean
  hair: Hair
  hairColor?: string
  hat?: Hat
  robe: string
  robeShade: string
  sash: string
  collar?: string
  legs?: string
  extras?: Extra[]
}

export interface VillagerSpec {
  id: string
  name: string
  title: string
  /** Place they go in and out of: a door, or the edge of the map for travellers. */
  home: string
  look: Look
  /** Walking speed in px per second at 1× time. */
  speed: number
  /** Dot colour on the map. */
  color: string
  schedule: Entry[]
  talk: string[]
  /** First time the turtle walks up. */
  turtle: string[]
  /** When the turtle hides in its shell next to them. */
  shell: string[]
  night?: string[]
  barks: Partial<Record<Pose | 'walk', string[]>>
  /** An anonymous passer-by: not listed on the map. */
  extra?: boolean
}

export const inside = (lit = true): Doing => ({ kind: 'inside', lit })
export const spot = (at: string, pose: Pose = 'stand'): Doing => ({ kind: 'spot', at, pose })
export const work = (area: string, pose: Pose): Doing => ({ kind: 'area', area, pose, style: 'work' })
export const wander = (area: string, pose: Pose = 'stand'): Doing => ({ kind: 'area', area, pose, style: 'wander' })
export const chase = (area: string): Doing => ({ kind: 'area', area, pose: 'play', style: 'chase' })
export const patrol = (route: string[], pose?: Pose, stop?: Pose, wait?: number): Doing => ({ kind: 'patrol', route, pose, stop, wait })
export const asleep = (at = '00:00'): Entry => ({ at, label: 'asleep', doing: inside(false) })
export const home = (at: string, label = 'at home'): Entry => ({ at, label, doing: inside(true) })

/** Generic reactions when a villager has none of their own. */
export const GENERIC_SHELL = ['A rock?', 'That rock is breathing.']
