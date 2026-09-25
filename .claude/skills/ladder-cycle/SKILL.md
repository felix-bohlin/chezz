---
name: ladder-cycle
description: One full improvement cycle for the chezz engine - play a game vs Stockfish at the next ladder Elo, analyze it (analyze-game skill + both sub-agents), implement and regression-test the top suggestion. Designed to be run repeatedly with /loop /ladder-cycle under a /goal.
---

# Ladder cycle: play → analyze → improve

All state lives on disk (`games/manifest.json`, `PROGRESS.md`), so every iteration starts fresh.
See CLAUDE.md for commands and PATH setup.

## 1. Play

0. **Don't start a second game.** If `games/live.json` has `"active": true` and its `updatedAt` is less
   than 90 s old, a game is already running: find its log (newest `backend/logs/game-*.log`), wait for its
   `RESULT` line with the Monitor tool, and continue from step 2 (Analyze) with that game.
   Also skip to step 2 if the newest game in `games/manifest.json` has no `analysis` yet.
1. If `backend/engine/PENDING.md` exists, do what it says first (staged changes to build and test, and a
   game to analyze), then delete it. Otherwise make sure the engine is built:
   `cd backend/engine && cargo build --release`.
2. Read `games/manifest.json` → `nextElo` (auto-advances only after a **win**; draws/losses retry).
3. Start the game **detached** (it takes 5–20 min, longer than the 10-min tool timeout):
   ```
   pwsh -File backend/play_detached.ps1          # prints pid=… log=backend/logs/game-….log
   ```
   Then wait with the **Monitor** tool (timeout_ms 1800000) on a command that exits when the log has a
   `RESULT` line or the `.err` file shows a Traceback, e.g. in bash:
   `until grep -q '^RESULT' LOG || grep -q Traceback LOG.err; do sleep 10; done; tail -n 2 LOG; tail -n 5 LOG.err`
   Don't poll manually. The RESULT line reads `RESULT <result> winner=<us|stockfish|draw> ... file=games/<STEM>.json`.
   Never run selfplay or builds while a ladder game is running (CPU contention and a locked exe).

## 2. Analyze

First run `python backend/verify_games.py` (a few seconds): every move legal, SAN/FEN/PGN consistent,
result matches the final position, no move of ours over 5 s. A FAIL is a bug to fix before anything else.

Then invoke the `analyze-game` skill with `games/<STEM>.json`. It runs full-strength Stockfish post-mortem
+ both sub-agents in parallel and writes `games/<STEM>.analysis.md` with a **Decision** section.

## 3. Improve (one change per cycle)

1. Save a baseline: copy `backend/engine/target/release/chezz.exe` to `backend/engine/baseline/chezz.exe`.
2. Implement the **Decision → Implement next** change in `backend/engine/src/`. Keep it small.
3. Bump the patch version in `backend/engine/Cargo.toml`.
4. `cargo build --release`, then `echo bench | target/release/chezz.exe`: must run cleanly and nps must
   not drop by more than ~20% unless the change is eval knowledge that is worth it.
5. Regression check (≈3 min):
   ```
   python backend/selfplay.py --baseline backend/engine/baseline/chezz.exe --games 16 --time 0.1
   ```
   - Exit code 0 (≥ 40%): keep the change — but if it touched search, threading or time management,
     also run `python backend/timecheck.py --positions 10` (≈1 min) and revert on any move over 5000 ms.
   - Exit code 1: revert the source change (restore the baseline exe too, keep the version bump out),
     and append "reverted: <change> — selfplay <score>" to the Decision section of the analysis file.

## 4. Report

Finish with 3–4 lines: game result at which Elo, change made (or reverted), selfplay score, next Elo.
Stop the loop (don't start another cycle) if the /goal condition is met.
