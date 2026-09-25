# Staged engine changes: handle before the next ladder game

The source contains untested changes on top of v0.1.4 (`baseline/chezz.exe` is v0.1.4):

1. **`MaxThinkMs` hard cap of 4750 ms** (`main.rs`). This is a competition-rule safeguard; always keep it.
2. **SEE pruning of losing captures** in `search.rs::negamax` (`SEE_PRUNE_MARGIN`), the Decision from
   `games/0004_elo-2500_win.analysis.md`.

To do, in order:
- Set version 0.1.5 in `Cargo.toml`, `cargo build --release`, `echo bench | target/release/chezz.exe`.
- `python backend/selfplay.py --baseline backend/engine/baseline/chezz.exe --games 16 --time 0.1`
  - If it fails (< 40%): remove only the SEE-pruning block and its constant, rebuild. Keep the cap.
- `python backend/timecheck.py --positions 10`: must report 0 moves over the limit.
- Record the outcome in the Decision section of `games/0004_elo-2500_win.analysis.md`, then delete this file.

Game `0005_elo-2700_loss` still needs its analysis (analyze-game skill). Its Stockfish report shows
the game was decided in the middlegame: ply 31 b4?? (Rd3 was best, +140 → −171), then a slow slide to −700
by ply 100. The late "blunders" at plies 137/145 came in positions that were already lost.
