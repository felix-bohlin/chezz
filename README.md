# CHEZZ 戦国 — beat Stockfish

Our own chess engine (Rust) climbs a ladder of strength-limited Stockfish opponents, and every battle
is replayable in a pixel-art *Shogun: Total War meets zen garden* frontend.

- **Ladder progress:** [PROGRESS.md](PROGRESS.md), the highest Stockfish `UCI_Elo` we have beaten, with links to every game
- **Games:** [games/](games/), one JSON per game (moves, FENs, evals, PGN) plus an `.analysis.md` post-mortem

## How it works

```
backend/engine   Rust UCI engine "chezz": PVS alpha-beta, iterative deepening, TT, null move,
                 LMR, futility/SEE pruning, quiescence; PeSTO tapered eval + pawn structure,
                 mobility, king safety, mop-up; contempt against draws (draws don't count)
backend/runner   python-chess drives chezz vs Stockfish 19 (UCI_LimitStrength + UCI_Elo),
                 5 s/move for both, saves games/NNNN_elo-XXXX_result.json
backend/analyze  full-strength Stockfish post-mortem → our worst moves with FENs
frontend         Vite + React pixel-art replay: animated board, move scroll, eval chart,
                 campaign map of Elo "provinces"
```

**Improvement loop** (Claude Code): `/goal` + `/loop /ladder-cycle`. Each cycle plays a game at the next
Elo, runs the `analyze-game` skill (Stockfish post-mortem + two sub-agents, `shogun-sensei` and
`engine-smith`), implements the top suggestion, and keeps it only if it passes a self-play regression check.

## Run it

Prerequisites: Rust (stable), Python 3.12 + `pip install python-chess`, Node 22+ with pnpm,
and Stockfish 19 unzipped into `backend/tools/stockfish/` (see [CLAUDE.md](CLAUDE.md)).

```bash
cd backend/engine && cargo build --release && cd ../..
python backend/runner.py --elo auto          # play the next ladder game
cd frontend && pnpm install && pnpm dev      # replay at http://localhost:5173
```
