mod eval;
mod search;
mod tt;

use std::io::{self, BufRead, Write};
use std::time::{Duration, Instant};

use shakmaty::fen::Fen;
use shakmaty::uci::UciMove;
use shakmaty::{CastlingMode, Chess, Color, Position};

use search::{Engine, Limits, hash_of, uci};

const NAME: &str = "chezz";
const VERSION: &str = env!("CARGO_PKG_VERSION");
// Margin for thread joins and UCI round-trips so the wall-clock move time stays under the 5 s rule.
const MOVE_OVERHEAD_MS: u64 = 150;
const DEFAULT_HASH_MB: usize = 256;
const DEFAULT_THREADS: usize = 4;
/// Absolute ceiling on thinking time per move, whatever the GUI sends (competition rule: 5 s).
const DEFAULT_MAX_THINK_MS: u64 = 4750;

fn main() {
    // Deep recursion with per-frame move lists needs more than the default Windows 1MB stack.
    let handle = std::thread::Builder::new()
        .stack_size(256 << 20)
        .spawn(uci_loop)
        .expect("spawn uci thread");
    handle.join().ok();
}

fn uci_loop() {
    let stdin = io::stdin();
    let mut searcher = Engine::new(DEFAULT_HASH_MB, DEFAULT_THREADS);
    let mut pos = Chess::default();
    let mut history: Vec<u64> = Vec::new();
    let mut max_think_ms = DEFAULT_MAX_THINK_MS;

    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let tokens: Vec<&str> = line.split_whitespace().collect();
        let Some(&cmd) = tokens.first() else { continue };
        match cmd {
            "uci" => {
                println!("id name {NAME} {VERSION}");
                println!("id author chezz team");
                println!("option name Hash type spin default {DEFAULT_HASH_MB} min 1 max 2048");
                println!("option name Threads type spin default {DEFAULT_THREADS} min 1 max 64");
                println!("option name Contempt type spin default 25 min -200 max 200");
                println!("option name MaxThinkMs type spin default {DEFAULT_MAX_THINK_MS} min 10 max 4900");
                println!("uciok");
            }
            "isready" => println!("readyok"),
            "ucinewgame" => searcher.new_game(),
            "setoption" => set_option(&tokens, &mut searcher, &mut max_think_ms),
            "position" => {
                if let Some((p, h)) = parse_position(&tokens) {
                    pos = p;
                    history = h;
                }
            }
            "go" => {
                let limits = parse_go(&tokens, pos.turn(), max_think_ms);
                let (best, _, _) = searcher.think(&pos, &history, limits, true);
                match best {
                    Some(m) => println!("bestmove {}", uci(&m)),
                    None => println!("bestmove 0000"),
                }
            }
            "eval" => println!("eval {}", eval::evaluate(&pos)),
            "bench" => bench(&mut searcher),
            "quit" => break,
            _ => {}
        }
        io::stdout().flush().ok();
    }
}

fn set_option(tokens: &[&str], searcher: &mut Engine, max_think_ms: &mut u64) {
    let name_i = tokens.iter().position(|t| *t == "name");
    let value_i = tokens.iter().position(|t| *t == "value");
    let (Some(n), Some(v)) = (name_i, value_i) else { return };
    let name = tokens[n + 1..v].join(" ").to_lowercase();
    let Some(value) = tokens.get(v + 1).and_then(|s| s.parse::<i64>().ok()) else { return };
    match name.as_str() {
        "hash" => searcher.set_hash(value.clamp(1, 2048) as usize),
        "threads" => searcher.set_threads(value.clamp(1, 64) as usize),
        "contempt" => searcher.set_contempt(value.clamp(-200, 200) as i32),
        "maxthinkms" => *max_think_ms = value.clamp(10, 4900) as u64,
        _ => {}
    }
}

fn parse_position(tokens: &[&str]) -> Option<(Chess, Vec<u64>)> {
    let mut i = 1;
    let mut pos = match tokens.get(i)? {
        &"startpos" => {
            i += 1;
            Chess::default()
        }
        &"fen" => {
            let start = i + 1;
            let end = tokens.iter().position(|t| *t == "moves").unwrap_or(tokens.len());
            i = end;
            let fen = Fen::from_ascii(tokens[start..end].join(" ").as_bytes()).ok()?;
            fen.into_position::<Chess>(CastlingMode::Standard).ok()?
        }
        _ => return None,
    };
    let mut history = Vec::new();
    if tokens.get(i) == Some(&"moves") {
        for t in &tokens[i + 1..] {
            let m = UciMove::from_ascii(t.as_bytes()).ok()?.to_move(&pos).ok()?;
            history.push(hash_of(&pos));
            pos.play_unchecked(m);
        }
    }
    Some((pos, history))
}

fn parse_go(tokens: &[&str], turn: Color, max_think_ms: u64) -> Limits {
    let get = |key: &str| -> Option<u64> {
        tokens
            .iter()
            .position(|t| *t == key)
            .and_then(|i| tokens.get(i + 1))
            .and_then(|v| v.parse::<i64>().ok())
            .map(|v| v.max(0) as u64)
    };
    let limits = requested_limits(&get, turn);
    let cap = Duration::from_millis(max_think_ms);
    let hard = limits.hard.min(cap);
    Limits { soft: limits.soft.min(hard), hard, max_depth: limits.max_depth }
}

fn requested_limits(get: &dyn Fn(&str) -> Option<u64>, turn: Color) -> Limits {
    let day = Duration::from_secs(86_400);
    if let Some(mt) = get("movetime") {
        // Fixed per-move time can't be banked, so search right up to the deadline.
        let hard = mt.saturating_sub(MOVE_OVERHEAD_MS).max(10);
        return Limits {
            soft: Duration::from_millis(hard),
            hard: Duration::from_millis(hard),
            max_depth: 100,
        };
    }
    let (time, inc) = match turn {
        Color::White => (get("wtime"), get("winc").unwrap_or(0)),
        Color::Black => (get("btime"), get("binc").unwrap_or(0)),
    };
    if let Some(t) = time {
        let mtg = get("movestogo").unwrap_or(30).max(1);
        let base = t / mtg + inc * 3 / 4;
        let hard = (base * 2).min(t.saturating_sub(MOVE_OVERHEAD_MS)).max(10);
        return Limits {
            soft: Duration::from_millis((base * 6 / 10).min(hard)),
            hard: Duration::from_millis(hard),
            max_depth: 100,
        };
    }
    if let Some(d) = get("depth") {
        return Limits { soft: day, hard: day, max_depth: d as i32 };
    }
    Limits { soft: day, hard: day, max_depth: 100 }
}

fn bench(searcher: &mut Engine) {
    const FENS: [&str; 4] = [
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
        "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    ];
    let start = Instant::now();
    for fen in FENS {
        let pos: Chess = Fen::from_ascii(fen.as_bytes())
            .unwrap()
            .into_position(CastlingMode::Standard)
            .unwrap();
        searcher.new_game();
        let limits = Limits {
            soft: Duration::from_millis(1500),
            hard: Duration::from_millis(1500),
            max_depth: 100,
        };
        let (best, score, depth) = searcher.think(&pos, &[], limits, true);
        println!(
            "bench: {} -> {} score {} depth {}",
            fen,
            best.map(|m| uci(&m)).unwrap_or_default(),
            score,
            depth
        );
    }
    println!("bench: total {} ms", start.elapsed().as_millis());
}
