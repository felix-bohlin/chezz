use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use shakmaty::zobrist::Zobrist64;
use shakmaty::{CastlingMode, Chess, Color, EnPassantMode, Move, Position, Role};

use crate::eval::{SEE_VAL, evaluate, ri, see};
use crate::tt::{BOUND_EXACT, BOUND_LOWER, BOUND_UPPER, TT};

pub const INF: i32 = 32000;
pub const MATE: i32 = 30000;
pub const MATE_BOUND: i32 = MATE - 1000;
pub const MAX_PLY: usize = 128;

const SKIP: i32 = i32::MIN;
/// Losing captures (by SEE) are skipped at shallow depth when they lose more than this per ply.
const SEE_PRUNE_MARGIN: i32 = 100;

pub fn hash_of(pos: &Chess) -> u64 {
    pos.zobrist_hash::<Zobrist64>(EnPassantMode::Legal).0
}

#[inline]
fn child_hash(pos: &Chess, h: u64, m: Move, child: &Chess) -> u64 {
    match pos.update_zobrist_hash::<Zobrist64>(Zobrist64(h), m, EnPassantMode::Legal) {
        Some(z) => z.0,
        None => hash_of(child),
    }
}

#[inline]
pub fn enc(m: &Move) -> u16 {
    let from = m.from().map_or(0, |s| s.to_usize()) as u16;
    let to = m.to().to_usize() as u16;
    let promo = m.promotion().map_or(0, |r| ri(r) as u16 + 1);
    from | (to << 6) | (promo << 12)
}

pub fn uci(m: &Move) -> String {
    m.to_uci(CastlingMode::Standard).to_string()
}

fn score_to_tt(score: i32, ply: usize) -> i32 {
    if score >= MATE_BOUND {
        score + ply as i32
    } else if score <= -MATE_BOUND {
        score - ply as i32
    } else {
        score
    }
}

fn score_from_tt(score: i32, ply: usize) -> i32 {
    if score >= MATE_BOUND {
        score - ply as i32
    } else if score <= -MATE_BOUND {
        score + ply as i32
    } else {
        score
    }
}

pub fn format_score(score: i32) -> String {
    if score >= MATE_BOUND {
        format!("mate {}", (MATE - score + 1) / 2)
    } else if score <= -MATE_BOUND {
        format!("mate -{}", (MATE + score + 1) / 2)
    } else {
        format!("cp {score}")
    }
}

#[derive(Clone, Copy)]
pub struct Limits {
    pub soft: Duration,
    pub hard: Duration,
    pub max_depth: i32,
}

/// Lazy SMP: every thread runs the same iterative deepening on a shared transposition table.
/// Only the main thread watches the clock, reports, and decides the move.
pub struct Engine {
    pub tt: Arc<TT>,
    stop: Arc<AtomicBool>,
    searchers: Vec<Searcher>,
}

impl Engine {
    pub fn new(hash_mb: usize, threads: usize) -> Engine {
        let tt = Arc::new(TT::new(hash_mb));
        let stop = Arc::new(AtomicBool::new(false));
        let searchers = (0..threads.max(1)).map(|id| Searcher::new(tt.clone(), stop.clone(), id)).collect();
        Engine { tt, stop, searchers }
    }

    pub fn set_threads(&mut self, threads: usize) {
        let contempt = self.searchers[0].contempt;
        self.searchers = (0..threads.max(1))
            .map(|id| Searcher::new(self.tt.clone(), self.stop.clone(), id))
            .collect();
        self.set_contempt(contempt);
    }

    pub fn set_hash(&mut self, mb: usize) {
        self.tt = Arc::new(TT::new(mb));
        let threads = self.searchers.len();
        self.set_threads(threads);
    }

    pub fn set_contempt(&mut self, contempt: i32) {
        self.searchers.iter_mut().for_each(|s| s.contempt = contempt);
    }

    pub fn new_game(&mut self) {
        self.tt.clear();
        self.searchers.iter_mut().for_each(|s| s.new_game());
    }

    pub fn think(&mut self, pos: &Chess, history: &[u64], limits: Limits, verbose: bool) -> (Option<Move>, i32, i32) {
        self.stop.store(false, Ordering::Relaxed);
        self.tt.new_search();
        let stop = self.stop.clone();
        let (main, helpers) = self.searchers.split_first_mut().expect("at least one searcher");
        std::thread::scope(|scope| {
            for helper in helpers.iter_mut() {
                std::thread::Builder::new()
                    .stack_size(128 << 20)
                    .spawn_scoped(scope, move || {
                        helper.think(pos, history, limits, false);
                    })
                    .expect("spawn helper thread");
            }
            let result = main.think(pos, history, limits, verbose);
            stop.store(true, Ordering::Relaxed);
            result
        })
    }
}

pub struct Searcher {
    tt: Arc<TT>,
    stop: Arc<AtomicBool>,
    id: usize,
    pub contempt: i32,
    killers: [[u16; 2]; MAX_PLY],
    history: Vec<[[i32; 64]; 64]>,
    hist: Vec<u64>,
    pv: Vec<[Option<Move>; MAX_PLY]>,
    pv_len: [usize; MAX_PLY],
    nodes: u64,
    start: Instant,
    hard: Duration,
    stopped: bool,
    root_color: Color,
    lmr: [[i32; 64]; 64],
}

impl Searcher {
    fn new(tt: Arc<TT>, stop: Arc<AtomicBool>, id: usize) -> Searcher {
        let mut lmr = [[0i32; 64]; 64];
        for (d, row) in lmr.iter_mut().enumerate().skip(1) {
            for (n, v) in row.iter_mut().enumerate().skip(1) {
                *v = (0.75 + (d as f64).ln() * (n as f64).ln() / 2.25) as i32;
            }
        }
        Searcher {
            tt,
            stop,
            id,
            contempt: 25,
            killers: [[0; 2]; MAX_PLY],
            history: vec![[[0; 64]; 64]; 2],
            hist: Vec::with_capacity(1024),
            pv: vec![[None; MAX_PLY]; MAX_PLY],
            pv_len: [0; MAX_PLY],
            nodes: 0,
            start: Instant::now(),
            hard: Duration::from_secs(1),
            stopped: false,
            root_color: Color::White,
            lmr,
        }
    }

    fn new_game(&mut self) {
        self.history = vec![[[0; 64]; 64]; 2];
        self.killers = [[0; 2]; MAX_PLY];
    }

    #[inline]
    fn check_time(&mut self) {
        if self.id == 0 && self.start.elapsed() >= self.hard {
            self.stop.store(true, Ordering::Relaxed);
        }
        if self.stop.load(Ordering::Relaxed) {
            self.stopped = true;
        }
    }

    #[inline]
    fn draw_score(&self, stm: Color) -> i32 {
        if stm == self.root_color { -self.contempt } else { self.contempt }
    }

    fn is_repetition(&self, hash: u64, halfmoves: u32) -> bool {
        let n = self.hist.len();
        let lookback = (halfmoves as usize).min(n);
        let mut i = 2;
        while i <= lookback {
            if self.hist[n - i] == hash {
                return true;
            }
            i += 2;
        }
        false
    }

    fn update_pv(&mut self, ply: usize, m: Move) {
        self.pv[ply][ply] = Some(m);
        let next_len = if ply + 1 < MAX_PLY { self.pv_len[ply + 1] } else { ply + 1 };
        for i in (ply + 1)..next_len {
            self.pv[ply][i] = self.pv[ply + 1][i];
        }
        self.pv_len[ply] = next_len.max(ply + 1);
    }

    fn pv_string(&self) -> String {
        (0..self.pv_len[0])
            .filter_map(|i| self.pv[0][i])
            .map(|m| uci(&m))
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// Iterative deepening driver. `history` holds hashes of positions before `pos` (game history).
    fn think(&mut self, pos: &Chess, history: &[u64], limits: Limits, verbose: bool) -> (Option<Move>, i32, i32) {
        self.start = Instant::now();
        self.hard = limits.hard;
        self.stopped = false;
        self.nodes = 0;
        self.root_color = pos.turn();
        self.hist.clear();
        self.hist.extend_from_slice(history);
        self.killers = [[0; 2]; MAX_PLY];
        for side in self.history.iter_mut() {
            for row in side.iter_mut() {
                for v in row.iter_mut() {
                    *v /= 8;
                }
            }
        }

        let root_hash = hash_of(pos);
        let legal = pos.legal_moves();
        if legal.is_empty() {
            return (None, 0, 0);
        }
        let mut root_moves: Vec<Move> = legal.iter().copied().collect();
        if let Some(e) = self.tt.probe(root_hash) {
            if let Some(i) = root_moves.iter().position(|m| enc(m) == e.mv) {
                root_moves.swap(0, i);
            }
        }
        let mut best_move = root_moves[0];
        let mut best_score = evaluate(pos);
        let mut completed = 0;
        if root_moves.len() == 1 {
            return (Some(best_move), best_score, 0);
        }

        let first_depth = if self.id % 2 == 1 { 2 } else { 1 };
        for depth in first_depth..=limits.max_depth {
            let mut window = 30;
            let (mut alpha, mut beta) = if depth >= 5 {
                ((best_score - window).max(-INF), (best_score + window).min(INF))
            } else {
                (-INF, INF)
            };
            loop {
                let (score, mv, raised) = self.search_root(pos, root_hash, depth, alpha, beta, &mut root_moves);
                if self.stopped {
                    if let Some(m) = raised {
                        best_move = m;
                        best_score = score.max(best_score);
                    }
                    break;
                }
                if score <= alpha {
                    beta = (alpha + beta) / 2;
                    alpha = (score - window).max(-INF);
                } else if score >= beta {
                    beta = (score + window).min(INF);
                    if let Some(m) = mv {
                        best_move = m;
                    }
                } else {
                    best_score = score;
                    if let Some(m) = mv {
                        best_move = m;
                    }
                    break;
                }
                window *= 2;
                if window > 800 {
                    alpha = -INF;
                    beta = INF;
                }
            }
            if self.stopped {
                break;
            }
            completed = depth;
            if verbose {
                let ms = self.start.elapsed().as_millis().max(1) as u64;
                println!(
                    "info depth {} score {} nodes {} nps {} time {} pv {}",
                    depth,
                    format_score(best_score),
                    self.nodes,
                    self.nodes * 1000 / ms,
                    ms,
                    self.pv_string()
                );
            }
            if self.id == 0 {
                if self.start.elapsed() >= limits.soft {
                    break;
                }
                if best_score.abs() >= MATE_BOUND && depth >= 2 * (MATE - best_score.abs()) + 2 {
                    break;
                }
            }
        }
        (Some(best_move), best_score, completed)
    }

    fn search_root(
        &mut self,
        pos: &Chess,
        hash: u64,
        depth: i32,
        mut alpha: i32,
        beta: i32,
        root_moves: &mut Vec<Move>,
    ) -> (i32, Option<Move>, Option<Move>) {
        let orig_alpha = alpha;
        let mut best = -INF;
        let mut best_mv = None;
        let mut raised = None;
        self.pv_len[0] = 0;
        for i in 0..root_moves.len() {
            let m = root_moves[i];
            let mut child = pos.clone();
            child.play_unchecked(m);
            let ch = child_hash(pos, hash, m, &child);
            self.hist.push(hash);
            let score = if i == 0 {
                -self.negamax(&child, ch, depth - 1, 1, -beta, -alpha, true)
            } else {
                let mut s = -self.negamax(&child, ch, depth - 1, 1, -alpha - 1, -alpha, true);
                if s > alpha && s < beta && !self.stopped {
                    s = -self.negamax(&child, ch, depth - 1, 1, -beta, -alpha, true);
                }
                s
            };
            self.hist.pop();
            if self.stopped {
                break;
            }
            if score > best {
                best = score;
                best_mv = Some(m);
            }
            if score > alpha {
                alpha = score;
                raised = Some(m);
                self.update_pv(0, m);
                if score >= beta {
                    break;
                }
            }
        }
        if let Some(m) = best_mv {
            if let Some(i) = root_moves.iter().position(|x| *x == m) {
                let mv = root_moves.remove(i);
                root_moves.insert(0, mv);
            }
            if !self.stopped {
                let bound = if best >= beta {
                    BOUND_LOWER
                } else if best > orig_alpha {
                    BOUND_EXACT
                } else {
                    BOUND_UPPER
                };
                self.tt.store(hash, enc(&m), score_to_tt(best, 0), depth, bound);
            }
        }
        (best, best_mv, raised)
    }

    fn score_move(&self, pos: &Chess, m: &Move, tt_mv: u16, ply: usize) -> i32 {
        let e = enc(m);
        if e == tt_mv {
            return 30_000_000;
        }
        if let Some(victim) = m.capture() {
            let mvv = SEE_VAL[ri(victim)] * 10 - SEE_VAL[ri(m.role())] / 10;
            let good = SEE_VAL[ri(m.role())] <= SEE_VAL[ri(victim)] || see(pos.board(), m) >= 0;
            return if good { 20_000_000 + mvv } else { 5_000_000 + mvv };
        }
        if m.promotion() == Some(Role::Queen) {
            return 19_000_000;
        }
        if m.is_promotion() {
            return -1_000_000;
        }
        if self.killers[ply][0] == e {
            return 9_000_000;
        }
        if self.killers[ply][1] == e {
            return 8_000_000;
        }
        let side = if pos.turn() == Color::White { 0 } else { 1 };
        self.history[side][e as usize & 63][(e as usize >> 6) & 63]
    }

    fn update_history(&mut self, side: usize, m: &Move, bonus: i32) {
        let e = enc(m) as usize;
        let h = &mut self.history[side][e & 63][(e >> 6) & 63];
        *h += bonus - *h * bonus.abs() / 16384;
    }

    fn negamax(
        &mut self,
        pos: &Chess,
        hash: u64,
        mut depth: i32,
        ply: usize,
        mut alpha: i32,
        mut beta: i32,
        can_null: bool,
    ) -> i32 {
        if self.nodes & 2047 == 0 {
            self.check_time();
        }
        if self.stopped {
            return 0;
        }
        self.pv_len[ply] = ply;
        if ply >= MAX_PLY - 2 {
            return evaluate(pos);
        }
        if pos.halfmoves() >= 100 || self.is_repetition(hash, pos.halfmoves()) || pos.is_insufficient_material() {
            return self.draw_score(pos.turn());
        }
        alpha = alpha.max(-MATE + ply as i32);
        beta = beta.min(MATE - ply as i32 - 1);
        if alpha >= beta {
            return alpha;
        }

        let in_check = pos.is_check();
        if in_check {
            depth += 1;
        }
        if depth <= 0 {
            return self.qsearch(pos, ply, alpha, beta);
        }
        self.nodes += 1;

        let pv_node = beta - alpha > 1;
        let orig_alpha = alpha;
        let mut tt_mv = 0u16;
        if let Some(e) = self.tt.probe(hash) {
            tt_mv = e.mv;
            if !pv_node && e.depth as i32 >= depth {
                let s = score_from_tt(e.score as i32, ply);
                match e.bound {
                    BOUND_EXACT => return s,
                    BOUND_LOWER if s >= beta => return s,
                    BOUND_UPPER if s <= alpha => return s,
                    _ => {}
                }
            }
        }

        let static_eval = if in_check { -INF } else { evaluate(pos) };

        if !pv_node && !in_check {
            if depth <= 6 && static_eval - 80 * depth >= beta && beta.abs() < MATE_BOUND {
                return static_eval;
            }
            if can_null && depth >= 3 && static_eval >= beta && has_non_pawn(pos) {
                let r = 3 + depth / 6;
                if let Ok(null_pos) = pos.clone().swap_turn() {
                    let nh = hash_of(&null_pos);
                    self.hist.push(hash);
                    let s = -self.negamax(&null_pos, nh, depth - 1 - r, ply + 1, -beta, -beta + 1, false);
                    self.hist.pop();
                    if self.stopped {
                        return 0;
                    }
                    if s >= beta {
                        return if s >= MATE_BOUND { beta } else { s };
                    }
                }
            }
        }

        let moves = pos.legal_moves();
        if moves.is_empty() {
            return if in_check { -MATE + ply as i32 } else { self.draw_score(pos.turn()) };
        }
        let mut scores = [0i32; 256];
        for (i, m) in moves.iter().enumerate() {
            scores[i] = self.score_move(pos, m, tt_mv, ply);
        }

        let side = if pos.turn() == Color::White { 0 } else { 1 };
        let mut best = -INF;
        let mut best_mv: Option<Move> = None;
        let mut searched = 0usize;
        let mut quiets_tried: [Option<Move>; 64] = [None; 64];
        let mut n_quiets = 0usize;

        for _ in 0..moves.len() {
            let mut bi = 0;
            let mut bs = SKIP;
            for (i, &s) in scores[..moves.len()].iter().enumerate() {
                if s > bs {
                    bs = s;
                    bi = i;
                }
            }
            if bs == SKIP {
                break;
            }
            scores[bi] = SKIP;
            let m = moves[bi];
            let quiet = !m.is_capture() && !m.is_promotion();
            let is_killer = self.killers[ply][0] == enc(&m) || self.killers[ply][1] == enc(&m);

            if !pv_node && !in_check && quiet && searched > 0 && best > -MATE_BOUND {
                if depth <= 4 && searched >= 4 + (depth * depth) as usize * 2 {
                    continue;
                }
            }

            if !pv_node && !in_check && m.is_capture() && !m.is_promotion() && searched > 0
                && best > -MATE_BOUND && depth <= 6 && see(pos.board(), &m) < -SEE_PRUNE_MARGIN * depth
            {
                continue;
            }

            let mut child = pos.clone();
            child.play_unchecked(m);
            let gives_check = child.is_check();

            if !pv_node && !in_check && quiet && !gives_check && searched > 0 && best > -MATE_BOUND
                && depth <= 3 && static_eval + 100 + 90 * depth <= alpha
            {
                continue;
            }

            let ch = child_hash(pos, hash, m, &child);
            self.hist.push(hash);
            let score = if searched == 0 {
                -self.negamax(&child, ch, depth - 1, ply + 1, -beta, -alpha, true)
            } else {
                let mut r = 0;
                if depth >= 3 && searched >= 3 && quiet && !in_check && !gives_check {
                    r = self.lmr[(depth as usize).min(63)][searched.min(63)];
                    if pv_node {
                        r -= 1;
                    }
                    if is_killer {
                        r -= 1;
                    }
                    r = r.clamp(0, depth - 2);
                }
                let mut s = -self.negamax(&child, ch, depth - 1 - r, ply + 1, -alpha - 1, -alpha, true);
                if s > alpha && r > 0 && !self.stopped {
                    s = -self.negamax(&child, ch, depth - 1, ply + 1, -alpha - 1, -alpha, true);
                }
                if s > alpha && s < beta && !self.stopped {
                    s = -self.negamax(&child, ch, depth - 1, ply + 1, -beta, -alpha, true);
                }
                s
            };
            self.hist.pop();
            if self.stopped {
                return 0;
            }
            searched += 1;

            if score > best {
                best = score;
                best_mv = Some(m);
                if score > alpha {
                    alpha = score;
                    self.update_pv(ply, m);
                    if score >= beta {
                        if quiet {
                            let e = enc(&m);
                            if self.killers[ply][0] != e {
                                self.killers[ply][1] = self.killers[ply][0];
                                self.killers[ply][0] = e;
                            }
                            let bonus = (depth * depth).min(1200);
                            self.update_history(side, &m, bonus);
                            for q in quiets_tried[..n_quiets].iter().flatten() {
                                self.update_history(side, q, -bonus);
                            }
                        }
                        break;
                    }
                }
            }
            if quiet && n_quiets < 64 {
                quiets_tried[n_quiets] = Some(m);
                n_quiets += 1;
            }
        }

        if searched == 0 {
            return alpha;
        }

        let bound = if best >= beta {
            BOUND_LOWER
        } else if best > orig_alpha {
            BOUND_EXACT
        } else {
            BOUND_UPPER
        };
        self.tt.store(hash, best_mv.map_or(0, |m| enc(&m)), score_to_tt(best, ply), depth, bound);
        best
    }

    fn qsearch(&mut self, pos: &Chess, ply: usize, mut alpha: i32, beta: i32) -> i32 {
        self.nodes += 1;
        if self.nodes & 2047 == 0 {
            self.check_time();
        }
        if self.stopped {
            return 0;
        }
        self.pv_len[ply] = ply;
        if ply >= MAX_PLY - 2 {
            return evaluate(pos);
        }
        let in_check = pos.is_check();
        let stand;
        let mut best;
        if in_check {
            stand = -INF;
            best = -MATE + ply as i32;
        } else {
            stand = evaluate(pos);
            if stand >= beta {
                return stand;
            }
            if stand > alpha {
                alpha = stand;
            }
            best = stand;
        }

        let moves = pos.legal_moves();
        if in_check && moves.is_empty() {
            return -MATE + ply as i32;
        }
        let mut scores = [SKIP; 256];
        for (i, m) in moves.iter().enumerate() {
            let victim = m.capture().map_or(0, |r| SEE_VAL[ri(r)]);
            if in_check {
                scores[i] = victim * 10 - SEE_VAL[ri(m.role())] / 10;
            } else if m.is_capture() || m.promotion() == Some(Role::Queen) {
                let promo = if m.promotion() == Some(Role::Queen) { 9000 } else { 0 };
                scores[i] = victim * 10 - SEE_VAL[ri(m.role())] / 10 + promo;
            }
        }

        loop {
            let mut bi = 0;
            let mut bs = SKIP;
            for (i, &s) in scores[..moves.len()].iter().enumerate() {
                if s > bs {
                    bs = s;
                    bi = i;
                }
            }
            if bs == SKIP {
                break;
            }
            scores[bi] = SKIP;
            let m = moves[bi];
            if !in_check {
                let gain = m.capture().map_or(0, |r| SEE_VAL[ri(r)]) + if m.is_promotion() { 800 } else { 0 };
                if stand + gain + 200 <= alpha {
                    continue;
                }
                if !m.is_promotion() && see(pos.board(), &m) < 0 {
                    continue;
                }
            }
            let mut child = pos.clone();
            child.play_unchecked(m);
            let score = -self.qsearch(&child, ply + 1, -beta, -alpha);
            if self.stopped {
                return 0;
            }
            if score > best {
                best = score;
                if score > alpha {
                    alpha = score;
                    if score >= beta {
                        break;
                    }
                }
            }
        }
        best
    }
}

fn has_non_pawn(pos: &Chess) -> bool {
    let b = pos.board();
    (b.by_color(pos.turn()) & !(b.pawns() | b.kings())).any()
}
