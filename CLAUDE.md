# Chezz: Total War — beat Stockfish

Competition entry: our own chess engine beats Stockfish at the highest possible `UCI_Elo`, and every
game is replayable in a 2D pixel-art "Shogun: Total War meets zen" frontend.

## Layout

| Path | What | Owner |
|---|---|---|
| `backend/engine/` | Rust UCI engine `musashi` (shakmaty movegen; search + eval are ours) | backend |
| `backend/runner.py` | Plays Musashi vs Stockfish (`UCI_LimitStrength` + `UCI_Elo`, 5 s/move each), saves games | backend |
| `backend/analyze.py` | Full-strength Stockfish post-mortem of a saved game → markdown report | backend |
| `backend/selfplay.py` | Fast regression check: candidate vs baseline engine | backend |
| `backend/common.py` | Paths, ladder rungs, `manifest.json` / `PROGRESS.md` regeneration | backend |
| `games/` | **The FE↔BE contract** (see below) | backend writes, frontend reads |
| `frontend/` | Vite + React + TS pixel-art replay app | frontend |
| `.claude/skills/` | `analyze-game` (post-game analysis), `ladder-cycle` (play → analyze → improve) | shared |
| `.claude/agents/` | `shogun-sensei` (chess analyst), `engine-smith` (engine dev) | shared |

## The games/ contract

One JSON file per game — `games/NNNN_elo-XXXX_{win|loss|draw}.json` — plus an optional sibling
`NNNN_elo-XXXX_*.analysis.md`. `games/manifest.json` and `PROGRESS.md` are **regenerated** by
`python backend/runner.py --reindex`; never edit them by hand (merge conflict? just reindex).

```jsonc
{
  "id": "0007", "date": "2026-09-25T14:03:00Z",
  "stockfishElo": 1600, "stockfishVersion": "Stockfish 19", "moveTimeSec": 5.0,
  "ourColor": "white", "result": "1-0", "winner": "us",        // us | stockfish | draw
  "termination": "checkmate",                                  // python-chess Termination name, or engine-error
  "engine": { "name": "musashi", "version": "0.1.0", "commit": "92ec583-dirty" },
  "startFen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "moves": [
    { "ply": 1, "san": "e4", "uci": "e2e4", "by": "us",
      "fenAfter": "…", "evalCp": 23, "mate": null, "depth": 17, "timeMs": 3740 }
  ],
  "pgn": "[Event \"Musashi vs Stockfish ladder\"] …"
}
```

- `evalCp` is **White's point of view**, clamped to ±2000 (mate → ±2000 and `mate` = moves to mate, signed).
  It is the evaluation reported by whichever engine made the move.
- The frontend needs no chess logic to render a position: every move carries `fenAfter`.
- The engine was called `chezz` up to 0.1.8 and `musashi` from 0.1.9; older games keep `"name": "chezz"`.
- The TypeScript mirror of this type lives in `frontend/src/types/game.ts` — keep them in sync.

## Commands

The tools are on the user PATH; in an old shell prepend them first:
PowerShell `$env:Path = "$env:LOCALAPPDATA\Programs\Python\Python312;$env:USERPROFILE\.cargo\bin;$env:Path"`.

```bash
cd backend/engine && cargo build --release          # engine → target/release/musashi.exe
echo bench | backend/engine/target/release/musashi.exe  # speed/depth sanity check
python backend/runner.py --elo auto --quiet         # one ladder game at the next rung
python backend/runner.py --elo 1600 --games 3       # fixed Elo
python backend/analyze.py games/0001_elo-1320_win.json
python backend/selfplay.py --baseline backend/engine/baseline/musashi.exe
python backend/verify_games.py                      # every saved move legal, FEN/PGN/result consistent
python backend/legalcheck.py                        # fuzz: every engine bestmove legal per python-chess
python backend/timecheck.py                         # proves ≤ 5 s/move on real positions
cd frontend && pnpm dev                             # replay app on http://localhost:5173
```

Stockfish: **Stockfish 19** (`backend/tools/stockfish/`, gitignored). Setup:
`gh release download sf_19 --repo official-stockfish/Stockfish --pattern "stockfish-windows-x86-64-universal.zip"`
then unzip into `backend/tools/stockfish/`. Minimum `UCI_Elo` is 1320.

## Competition rules we must keep satisfying

- ≤ 5 s thinking per move for **both** players (`Limit(time=5.0)`). Our engine enforces it itself: hard
  ceiling `MaxThinkMs` = 4750 ms whatever the GUI sends, plus a 150 ms margin under `movetime`. The runner
  records `ourMaxMoveMs` and any `timeViolations` per game; `python backend/timecheck.py` proves it on
  positions from real games. Run timecheck after any change to search, threading or time management.
- Stockfish strength set only via `UCI_LimitStrength: True` + `UCI_Elo`.
- Every move is legal, checked in four layers: the engine only plays moves from shakmaty's legal move
  generator (the root move list; TT/killer moves only reorder it); python-chess rejects any illegal
  `bestmove` (`push_uci` raises → engine-error loss) and the runner re-checks `move in board.legal_moves`
  (catches a null move); the runner replays every game it saves with `verify_games.verify` and prints
  `verify … ok|FAIL`; and `python backend/legalcheck.py` fuzzes the engine over edge cases, all saved-game
  positions and random playouts. Run legalcheck after any change to move generation, UCI parsing or search.
- A draw is not a win; the ladder only advances on `winner: "us"` (our engine uses contempt to avoid draws).
- Every game saved with its Elo (runner does this) and replayable on a graphical board (frontend).
- After **every** game: run the `analyze-game` skill, which runs **both** analysis sub-agents.

## Conventions

- Engine version lives in `backend/engine/Cargo.toml`; bump the patch version for every engine change so
  games are traceable to the engine that played them (the version shows up in the game JSON and PROGRESS.md).
- Token discipline: analysis agents run on haiku; pass them file paths and the compact
  `analyze.py` report rather than pasting whole games; no fan-out workflows.
- Games take 5–15 minutes of wall clock: run the runner in the background and wait for the completion
  notification; don't poll.
