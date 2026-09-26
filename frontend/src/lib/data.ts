import type { GameRecord, Manifest } from '../types/game'

async function get(path: string): Promise<Response> {
  const res = await fetch(`${import.meta.env.BASE_URL}games/${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res
}

export async function loadManifest(): Promise<Manifest> {
  return (await get('manifest.json')).json()
}

export async function loadGame(file: string): Promise<GameRecord> {
  return (await get(file)).json()
}

export async function loadAnalysis(file: string): Promise<string> {
  return (await get(file)).text()
}

export interface LiveState {
  active: boolean
  updatedAt?: number
  /** Epoch seconds when the side to move was asked for its move (set by the runner). */
  turnStartedAt?: number
  lastGameId?: string
  id: string
  date: string
  stockfishElo: number
  stockfishVersion: string
  ourColor: 'white' | 'black'
  engine: GameRecord['engine']
  startFen: string
  moves: GameRecord['moves']
}

const LIVE_STALE_SEC = 90

/** The runner's in-progress game, or an inactive state. A stale file (crashed runner) counts as inactive. */
export async function loadLive(): Promise<LiveState> {
  const res = await fetch(`${import.meta.env.BASE_URL}games/live.json`, { cache: 'no-store' })
  if (res.status === 404) return { active: false } as LiveState
  // Other failures are transient (the runner is swapping the file): throw so callers keep the last state.
  if (!res.ok) throw new Error(`live.json: ${res.status}`)
  const s: LiveState = await res.json()
  if (s.active && s.updatedAt && Date.now() / 1000 - s.updatedAt > LIVE_STALE_SEC) return { ...s, active: false }
  return s
}
