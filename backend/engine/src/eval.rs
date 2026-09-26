use std::sync::OnceLock;

use shakmaty::{Bitboard, Board, Chess, Color, Move, Piece, Position, Role, Square, attacks};

pub const SEE_VAL: [i32; 6] = [100, 320, 330, 500, 950, 20000];
const MG_VAL: [i32; 6] = [82, 337, 365, 477, 1025, 0];
const EG_VAL: [i32; 6] = [94, 281, 297, 512, 936, 0];
const PHASE_INC: [i32; 6] = [0, 1, 1, 2, 4, 0];
const ROLES: [Role; 6] = [Role::Pawn, Role::Knight, Role::Bishop, Role::Rook, Role::Queen, Role::King];

const TEMPO: i32 = 10;
const PASSED_MG: [i32; 8] = [0, 0, 5, 10, 20, 35, 60, 0];
const PASSED_EG: [i32; 8] = [0, 5, 10, 20, 40, 70, 110, 0];
// Endgame bonus per square of king distance to a passed pawn's stop square, scaled by how advanced it is.
const PASSED_KING_THEM: i32 = 4;
const PASSED_KING_US: i32 = 2;
const PASSED_KING_W: [i32; 8] = [0, 0, 0, 1, 2, 3, 4, 0];
const DOUBLED: (i32, i32) = (10, 20);
const ISOLATED: (i32, i32) = (8, 12);
const BISHOP_PAIR: (i32, i32) = (25, 45);
const ROOK_OPEN: (i32, i32) = (20, 10);
const ROOK_SEMI: (i32, i32) = (10, 5);
const ROOK_SEVENTH: (i32, i32) = (35, 15);
const ROOK_CENTRAL: (i32, i32) = (10, 5);
const KING_ATTACK_WEIGHT: [i32; 6] = [0, 3, 3, 4, 7, 0];
const KING_ATTACK_CAP: i32 = 700;
// Shelter of a castled (wing) king, middlegame only.
const SHIELD_PAWN: i32 = 12;
const SHIELD_MISSING: i32 = 20;
const KING_OPEN_FILE: i32 = 25;
const KING_SEMI_FILE: i32 = 12;

#[inline]
pub fn ri(r: Role) -> usize {
    match r {
        Role::Pawn => 0,
        Role::Knight => 1,
        Role::Bishop => 2,
        Role::Rook => 3,
        Role::Queen => 4,
        Role::King => 5,
    }
}

#[inline]
fn ci(c: Color) -> usize {
    match c {
        Color::White => 0,
        Color::Black => 1,
    }
}

// PeSTO tables, laid out a8..h8 first (white's view); white index = sq ^ 56, black index = sq.
#[rustfmt::skip]
const MG_PST: [[i32; 64]; 6] = [
    [
      0,   0,   0,   0,   0,   0,  0,   0,
     98, 134,  61,  95,  68, 126, 34, -11,
     -6,   7,  26,  31,  65,  56, 25, -20,
    -14,  13,   6,  21,  23,  12, 17, -23,
    -27,  -2,  -5,  12,  17,   6, 10, -25,
    -26,  -4,  -4, -10,   3,   3, 33, -12,
    -35,  -1, -20, -23, -15,  24, 38, -22,
      0,   0,   0,   0,   0,   0,  0,   0,
    ],
    [
    -167, -89, -34, -49,  61, -97, -15, -107,
     -73, -41,  72,  36,  23,  62,   7,  -17,
     -47,  60,  37,  65,  84, 129,  73,   44,
      -9,  17,  19,  53,  37,  69,  18,   22,
     -13,   4,  16,  13,  28,  19,  21,   -8,
     -23,  -9,  12,  10,  19,  17,  25,  -16,
     -29, -53, -12,  -3,  -1,  18, -14,  -19,
    -105, -21, -58, -33, -17, -28, -19,  -23,
    ],
    [
    -29,   4, -82, -37, -25, -42,   7,  -8,
    -26,  16, -18, -13,  30,  59,  18, -47,
    -16,  37,  43,  40,  35,  50,  37,  -2,
     -4,   5,  19,  50,  37,  37,   7,  -2,
     -6,  13,  13,  26,  34,  12,  10,   4,
      0,  15,  15,  15,  14,  27,  18,  10,
      4,  15,  16,   0,   7,  21,  33,   1,
    -33,  -3, -14, -21, -13, -12, -39, -21,
    ],
    [
     32,  42,  32,  51, 63,  9,  31,  43,
     27,  32,  58,  62, 80, 67,  26,  44,
     -5,  19,  26,  36, 17, 45,  61,  16,
    -24, -11,   7,  26, 24, 35,  -8, -20,
    -36, -26, -12,  -1,  9, -7,   6, -23,
    -45, -25, -16, -17,  3,  0,  -5, -33,
    -44, -16, -20,  -9, -1, 11,  -6, -71,
    -19, -13,   1,  17, 16,  7, -37, -26,
    ],
    [
    -28,   0,  29,  12,  59,  44,  43,  45,
    -24, -39,  -5,   1, -16,  57,  28,  54,
    -13, -17,   7,   8,  29,  56,  47,  57,
    -27, -27, -16, -16,  -1,  17,  -2,   1,
     -9, -26,  -9, -10,  -2,  -4,   3,  -3,
    -14,   2, -11,  -2,  -5,   2,  14,   5,
    -35,  -8,  11,   2,   8,  15,  -3,   1,
     -1, -18,  -9,  10, -15, -25, -31, -50,
    ],
    [
    -65,  23,  16, -15, -56, -34,   2,  13,
     29,  -1, -20,  -7,  -8,  -4, -38, -29,
     -9,  24,   2, -16, -20,   6,  22, -22,
    -17, -20, -12, -27, -30, -25, -14, -36,
    -49,  -1, -27, -39, -46, -44, -33, -51,
    -14, -14, -22, -46, -44, -30, -15, -27,
      1,   7,  -8, -64, -43, -16,   9,   8,
    -15,  36,  12, -54,   8, -28,  24,  14,
    ],
];

#[rustfmt::skip]
const EG_PST: [[i32; 64]; 6] = [
    [
      0,   0,   0,   0,   0,   0,   0,   0,
    178, 173, 158, 134, 147, 132, 165, 187,
     94, 100,  85,  67,  56,  53,  82,  84,
     32,  24,  13,   5,  -2,   4,  17,  17,
     13,   9,  -3,  -7,  -7,  -8,   3,  -1,
      4,   7,  -6,   1,   0,  -5,  -1,  -8,
     13,   8,   8,  10,  13,   0,   2,  -7,
      0,   0,   0,   0,   0,   0,   0,   0,
    ],
    [
    -58, -38, -13, -28, -31, -27, -63, -99,
    -25,  -8, -25,  -2,  -9, -25, -24, -52,
    -24, -20,  10,   9,  -1,  -9, -19, -41,
    -17,   3,  22,  22,  22,  11,   8, -18,
    -18,  -6,  16,  25,  16,  17,   4, -18,
    -23,  -3,  -1,  15,  10,  -3, -20, -22,
    -42, -20, -10,  -5,  -2, -20, -23, -44,
    -29, -51, -23, -15, -22, -18, -50, -64,
    ],
    [
    -14, -21, -11,  -8, -7,  -9, -17, -24,
     -8,  -4,   7, -12, -3, -13,  -4, -14,
      2,  -8,   0,  -1, -2,   6,   0,   4,
     -3,   9,  12,   9, 14,  10,   3,   2,
     -6,   3,  13,  19,  7,  10,  -3,  -9,
    -12,  -3,   8,  10, 13,   3,  -7, -15,
    -14, -18,  -7,  -1,  4,  -9, -15, -27,
    -23,  -9, -23,  -5, -9, -16,  -5, -17,
    ],
    [
    13, 10, 18, 15, 12,  12,   8,   5,
    11, 13, 13, 11, -3,   3,   8,   3,
     7,  7,  7,  5,  4,  -3,  -5,  -3,
     4,  3, 13,  1,  2,   1,  -1,   2,
     3,  5,  8,  4, -5,  -6,  -8, -11,
    -4,  0, -5, -1, -7, -12,  -8, -16,
    -6, -6,  0,  2, -9,  -9, -11,  -3,
    -9,  2,  3, -1, -5, -13,   4, -20,
    ],
    [
     -9,  22,  22,  27,  27,  19,  10,  20,
    -17,  20,  32,  41,  58,  25,  30,   0,
    -20,   6,   9,  49,  47,  35,  19,   9,
      3,  22,  24,  45,  57,  40,  57,  36,
    -18,  28,  19,  47,  31,  34,  39,  23,
    -16, -27,  15,   6,   9,  17,  10,   5,
    -22, -23, -30, -16, -16, -23, -36, -32,
    -33, -28, -22, -43,  -5, -32, -20, -41,
    ],
    [
    -74, -35, -18, -18, -11,  15,   4, -17,
    -12,  17,  14,  17,  17,  38,  23,  11,
     10,  17,  23,  15,  20,  45,  44,  13,
     -8,  22,  24,  27,  26,  33,  26,   3,
    -18,  -4,  21,  24,  27,  23,   9, -11,
    -19,  -3,  11,  21,  23,  16,   7,  -9,
    -27, -11,   4,  13,  14,   4,  -5, -17,
    -53, -34, -21, -11, -28, -14, -24, -43,
    ],
];

struct Masks {
    passed: [[u64; 64]; 2],
    file: [u64; 8],
    adjacent: [u64; 8],
    shield: [[u64; 64]; 2],
}

fn masks() -> &'static Masks {
    static M: OnceLock<Masks> = OnceLock::new();
    M.get_or_init(|| {
        let mut m = Masks {
            passed: [[0; 64]; 2],
            file: [0; 8],
            adjacent: [0; 8],
            shield: [[0; 64]; 2],
        };
        for f in 0..8 {
            for r in 0..8 {
                m.file[f] |= 1u64 << (r * 8 + f);
            }
        }
        for f in 0..8 {
            if f > 0 {
                m.adjacent[f] |= m.file[f - 1];
            }
            if f < 7 {
                m.adjacent[f] |= m.file[f + 1];
            }
        }
        for sq in 0..64usize {
            let (f, r) = ((sq % 8) as i32, (sq / 8) as i32);
            for df in -1..=1 {
                let ff = f + df;
                if !(0..8).contains(&ff) {
                    continue;
                }
                for rr in 0..8 {
                    let bit = 1u64 << (rr * 8 + ff);
                    if rr > r {
                        m.passed[0][sq] |= bit;
                    }
                    if rr < r {
                        m.passed[1][sq] |= bit;
                    }
                    if rr == r + 1 || rr == r + 2 {
                        m.shield[0][sq] |= bit;
                    }
                    if rr == r - 1 || rr == r - 2 {
                        m.shield[1][sq] |= bit;
                    }
                }
            }
        }
        m
    })
}

const FILE_A: u64 = 0x0101_0101_0101_0101;
const FILE_H: u64 = FILE_A << 7;

#[inline]
fn pawn_attacks_bb(pawns: u64, color: Color) -> u64 {
    match color {
        Color::White => ((pawns << 7) & !FILE_H) | ((pawns << 9) & !FILE_A),
        Color::Black => ((pawns >> 7) & !FILE_A) | ((pawns >> 9) & !FILE_H),
    }
}

#[inline]
fn center_distance(sq: Square) -> i32 {
    let f = sq.file().to_usize() as i32;
    let r = sq.rank().to_usize() as i32;
    (3 - f).max(f - 4) + (3 - r).max(r - 4)
}

/// Static evaluation from the side to move's point of view, in centipawns.
pub fn evaluate(pos: &Chess) -> i32 {
    let b = pos.board();
    let m = masks();
    let occ = b.occupied();
    let pawns = [
        (b.pawns() & b.white()).0,
        (b.pawns() & b.black()).0,
    ];
    let pawn_att = [pawn_attacks_bb(pawns[0], Color::White), pawn_attacks_bb(pawns[1], Color::Black)];
    let king_sq = [b.king_of(Color::White), b.king_of(Color::Black)];
    let king_zone = [
        king_sq[0].map_or(0, |k| attacks::king_attacks(k).0 | (1u64 << k.to_usize())),
        king_sq[1].map_or(0, |k| attacks::king_attacks(k).0 | (1u64 << k.to_usize())),
    ];

    let mut mg = [0i32; 2];
    let mut eg = [0i32; 2];
    let mut phase = 0;
    let mut attack_units = [0i32; 2];
    let mut attackers = [0i32; 2];
    let mut npm = [0i32; 2];

    for color in [Color::White, Color::Black] {
        let us = ci(color);
        let them = 1 - us;
        let own = b.by_color(color).0;
        for role in ROLES {
            let r = ri(role);
            for sq in b.by_piece(Piece { color, role }) {
                let s = sq.to_usize();
                let idx = if us == 0 { s ^ 56 } else { s };
                mg[us] += MG_VAL[r] + MG_PST[r][idx];
                eg[us] += EG_VAL[r] + EG_PST[r][idx];
                phase += PHASE_INC[r];
                let f = s % 8;
                let att = match role {
                    Role::Pawn => {
                        if m.passed[us][s] & pawns[them] == 0 {
                            let rel = if us == 0 { s / 8 } else { 7 - s / 8 };
                            mg[us] += PASSED_MG[rel];
                            eg[us] += PASSED_EG[rel];
                            // Kings racing to the pawn's stop square decide passed-pawn endgames.
                            let stop = if us == 0 { s + 8 } else { s.wrapping_sub(8) };
                            if rel >= 3 && stop < 64 {
                                let stop_sq = Square::new(stop as u32);
                                let d_them = king_sq[them].map_or(7, |k| k.distance(stop_sq) as i32);
                                let d_us = king_sq[us].map_or(7, |k| k.distance(stop_sq) as i32);
                                eg[us] += (PASSED_KING_THEM * d_them - PASSED_KING_US * d_us) * PASSED_KING_W[rel];
                            }
                        }
                        if m.adjacent[f] & pawns[us] == 0 {
                            mg[us] -= ISOLATED.0;
                            eg[us] -= ISOLATED.1;
                        }
                        continue;
                    }
                    Role::Knight => {
                        npm[us] += 3;
                        let a = attacks::knight_attacks(sq).0;
                        let mob = (a & !own & !pawn_att[them]).count_ones() as i32;
                        mg[us] += 4 * (mob - 4);
                        eg[us] += 4 * (mob - 4);
                        a
                    }
                    Role::Bishop => {
                        npm[us] += 3;
                        let a = attacks::bishop_attacks(sq, occ).0;
                        let mob = (a & !own & !pawn_att[them]).count_ones() as i32;
                        mg[us] += 4 * (mob - 7);
                        eg[us] += 5 * (mob - 7);
                        a
                    }
                    Role::Rook => {
                        npm[us] += 5;
                        let rel_rank = if us == 0 { s / 8 } else { 7 - s / 8 };
                        if rel_rank == 6 {
                            mg[us] += ROOK_SEVENTH.0;
                            eg[us] += ROOK_SEVENTH.1;
                        }
                        if f == 3 || f == 4 {
                            mg[us] += ROOK_CENTRAL.0;
                            eg[us] += ROOK_CENTRAL.1;
                        }
                        if m.file[f] & (pawns[0] | pawns[1]) == 0 {
                            mg[us] += ROOK_OPEN.0;
                            eg[us] += ROOK_OPEN.1;
                        } else if m.file[f] & pawns[us] == 0 {
                            mg[us] += ROOK_SEMI.0;
                            eg[us] += ROOK_SEMI.1;
                        }
                        let a = attacks::rook_attacks(sq, occ).0;
                        let mob = (a & !own & !pawn_att[them]).count_ones() as i32;
                        mg[us] += 2 * (mob - 7);
                        eg[us] += 4 * (mob - 7);
                        a
                    }
                    Role::Queen => {
                        npm[us] += 9;
                        let a = attacks::queen_attacks(sq, occ).0;
                        let mob = (a & !own & !pawn_att[them]).count_ones() as i32;
                        mg[us] += mob - 14;
                        eg[us] += 2 * (mob - 14);
                        a
                    }
                    Role::King => {
                        let rel_rank = if us == 0 { s / 8 } else { 7 - s / 8 };
                        if rel_rank <= 1 && f != 3 && f != 4 {
                            let shield = ((m.shield[us][s] & pawns[us]).count_ones() as i32).min(3);
                            mg[us] += SHIELD_PAWN * shield - SHIELD_MISSING * (3 - shield);
                            for ff in f.saturating_sub(1)..=(f + 1).min(7) {
                                if m.file[ff] & pawns[us] == 0 {
                                    mg[us] -= if m.file[ff] & pawns[them] == 0 { KING_OPEN_FILE } else { KING_SEMI_FILE };
                                }
                            }
                        }
                        continue;
                    }
                };
                let hits = (att & king_zone[them]).count_ones() as i32;
                if hits > 0 {
                    attack_units[them] += KING_ATTACK_WEIGHT[r] * hits;
                    attackers[them] += 1;
                }
            }
        }
        if b.by_piece(Piece { color, role: Role::Bishop }).more_than_one() {
            mg[us] += BISHOP_PAIR.0;
            eg[us] += BISHOP_PAIR.1;
        }
        for f in 0..8 {
            let n = (m.file[f] & pawns[us]).count_ones() as i32;
            if n > 1 {
                mg[us] -= DOUBLED.0 * (n - 1);
                eg[us] -= DOUBLED.1 * (n - 1);
            }
        }
    }

    for side in 0..2 {
        if attackers[side] >= 2 {
            let u = attack_units[side];
            mg[side] -= (u * u / 2).min(KING_ATTACK_CAP);
        }
    }

    let phase = phase.min(24);
    let mut score = ((mg[0] - mg[1]) * phase + (eg[0] - eg[1]) * (24 - phase)) / 24;

    let strong = if score > 0 { 0 } else { 1 };
    let weak = 1 - strong;
    if pawns[strong] == 0 && npm[strong] - npm[weak] <= 3 {
        score /= 4;
    }
    if phase <= 10 && score.abs() > 300 {
        if let (Some(ks), Some(kw)) = (king_sq[strong], king_sq[weak]) {
            let mop = 10 * center_distance(kw) + 4 * (14 - manhattan(ks, kw));
            score += if strong == 0 { mop } else { -mop };
        }
    }

    let stm = if pos.turn() == Color::White { score } else { -score };
    stm + TEMPO
}

#[inline]
fn manhattan(a: Square, b: Square) -> i32 {
    let fa = a.file().to_usize() as i32;
    let fb = b.file().to_usize() as i32;
    let ra = a.rank().to_usize() as i32;
    let rb = b.rank().to_usize() as i32;
    (fa - fb).abs() + (ra - rb).abs()
}

/// Static exchange evaluation of a capture, from the mover's point of view.
pub fn see(board: &Board, m: &Move) -> i32 {
    if m.is_castle() {
        return 0;
    }
    let Some(from) = m.from() else { return 0 };
    let to = m.to();
    let mut occ = board.occupied().0 & !(1u64 << from.to_usize());
    if m.is_en_passant() {
        let cap = Square::from_coords(to.file(), from.rank());
        occ &= !(1u64 << cap.to_usize());
    }
    let mut gain = [0i32; 32];
    gain[0] = m.capture().map_or(0, |r| SEE_VAL[ri(r)]);
    let mut attacker_val = SEE_VAL[ri(m.role())];
    let Some(color) = board.color_at(from) else { return 0 };
    let mut side = !color;
    let mut d = 0;
    loop {
        d += 1;
        gain[d] = attacker_val - gain[d - 1];
        if (-gain[d - 1]).max(gain[d]) < 0 || d >= 31 {
            break;
        }
        let atk = board.attacks_to(to, side, Bitboard(occ)).0 & occ;
        if atk == 0 {
            break;
        }
        let mut next = None;
        for role in ROLES {
            let bb = atk & board.by_role(role).0;
            if bb != 0 {
                next = Some((role, bb.trailing_zeros()));
                break;
            }
        }
        let (role, sq) = next.expect("attacker exists");
        occ &= !(1u64 << sq);
        attacker_val = SEE_VAL[ri(role)];
        side = !side;
    }
    while d > 1 {
        d -= 1;
        gain[d - 1] = -((-gain[d - 1]).max(gain[d]));
    }
    gain[0]
}
