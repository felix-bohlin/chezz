// Mirror of the games/ contract documented in CLAUDE.md. Keep in sync with backend/runner.py.

export type Winner = 'us' | 'stockfish' | 'draw'

export interface GameMove {
  ply: number
  san: string
  uci: string
  by: 'us' | 'stockfish'
  fenAfter: string
  /** White's point of view, clamped to ±2000 */
  evalCp: number | null
  mate: number | null
  depth: number | null
  timeMs: number
}

export interface GameRecord {
  id: string
  date: string
  stockfishElo: number
  stockfishVersion: string
  moveTimeSec: number
  ourColor: 'white' | 'black'
  result: '1-0' | '0-1' | '1/2-1/2'
  winner: Winner
  termination: string
  engine: { name: string; version: string; commit?: string }
  startFen: string
  moves: GameMove[]
  pgn: string
}

export interface ManifestEntry {
  id: string
  file: string
  analysis: string | null
  date: string
  stockfishElo: number
  ourColor: 'white' | 'black'
  result: string
  winner: Winner
  termination: string
  plies: number
  engineVersion: string
  /** Our slowest move in the game, wall clock. */
  ourMaxMoveMs?: number
}

export interface Manifest {
  highestWin: number | null
  nextElo: number
  ladder: number[]
  games: ManifestEntry[]
}
