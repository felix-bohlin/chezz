// The cast as shown on the Story page and keynote (docs/story/02-cast.md). Names, armor and the
// sample lines come from the same data the game uses, so the codex can't drift from the board.

import type { PieceType } from '../pixel/sprites'
import type { Role } from './types'

export interface CastEntry {
  role: Role
  piece: PieceType
  chess: string
  blurb: string
  moves: string
  /** Line ids from lines.json: one Tokugawa, one Akechi. */
  lines: [string, string]
}

export const CAST: CastEntry[] = [
  {
    role: 'lord',
    piece: 'k',
    chess: 'King',
    blurb: 'Ieyasu is a patient survivor who has lost before and learned from it. Mitsuhide is a proud usurper whose reign will last three days.',
    moves: 'Walks slowly, never hurries. Kneels and lays down his fan when checkmated.',
    lines: ['t.lord.checked.01', 'a.lord.game_start.01'],
  },
  {
    role: 'commander',
    piece: 'q',
    chess: 'Queen',
    blurb: 'Hattori Hanzō, the Demon: horned oni helmet, twin katanas, very few words. Hidemitsu hunts for Akechi.',
    moves: 'Hanzō vanishes in smoke and reappears where he strikes.',
    lines: ['t.commander.capture.01', 'a.commander.check.01'],
  },
  {
    role: 'ninja',
    piece: 'n',
    chess: 'Knight',
    blurb: 'Iga ninja on horseback, playful and sly. Their Kōka rivals ride for Akechi and mock them.',
    moves: 'Leaps over the lines in a mounted arc and lands in a puff of dust.',
    lines: ['t.ninja.fork.01', 'a.ninja.capture.01'],
  },
  {
    role: 'monk',
    piece: 'b',
    chess: 'Bishop',
    blurb: 'Mountain monks who speak in proverbs. Akechi’s warrior monks remember the burning of Mount Hiei.',
    moves: 'Glides along the diagonals; kneels and fades when struck down.',
    lines: ['t.monk.quiet.01', 'a.monk.capture.01'],
  },
  {
    role: 'garrison',
    piece: 'r',
    chess: 'Rook',
    blurb: 'Castle keeps and their loud samurai garrisons: walls, gates, arrows and honour.',
    moves: 'Grinds along the files; falls with a thud when taken. Guards the lord when castling.',
    lines: ['t.garrison.castle.01', 'a.garrison.capture.01'],
  },
  {
    role: 'ashigaru',
    piece: 'p',
    chess: 'Pawn',
    blurb: 'Frightened foot soldiers who dream of armour. Akechi’s are samurai hunters chasing a bounty.',
    moves: 'Trembles when attacked; flips into a new piece on reaching the last rank.',
    lines: ['t.ashigaru.pawn_near_promotion.01', 'a.ashigaru.quiet.01'],
  },
]
