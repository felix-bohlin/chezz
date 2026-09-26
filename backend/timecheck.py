"""Proves our engine respects the 5 s/move rule: plays it on positions from saved games with the exact
competition limit and reports wall-clock move times (including UCI round-trip).

Every sample is timed like the runner times a game's first move (the worst case): python-chess sends
`ucinewgame` + `isready` before `go`, and the clock runs from before that until `bestmove` arrives.

Usage:
    python backend/timecheck.py [--positions 20] [--limit 5.0] [--budget 4850] [--engine path]

Exit code 1 if any move exceeds the budget. The budget sits 150 ms under the 5 s rule on purpose: a move
at 4.99 s is a pass under the rule but one hiccup away from a breach, so it must fail this check.
"""

from __future__ import annotations

import argparse
import pathlib
import sys
import time

import chess
import chess.engine

from common import ENGINE, load_games


def sample_positions(n: int) -> list[str]:
    fens = []
    for g in load_games():
        board = chess.Board(g.get("startFen", chess.STARTING_FEN))
        for m in g["moves"]:
            if m["by"] == "us":
                fens.append(board.fen())
            board.push_uci(m["uci"])
    if not fens:
        return [chess.STARTING_FEN]
    step = max(1, len(fens) // n)
    return fens[::step][:n]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--positions", type=int, default=20)
    ap.add_argument("--limit", type=float, default=5.0, help="seconds per move sent to the engine (the rule)")
    ap.add_argument("--budget", type=float, default=4850, help="ms; any move slower than this fails")
    ap.add_argument("--engine", default=str(ENGINE))
    args = ap.parse_args()
    if not pathlib.Path(args.engine).exists():
        sys.exit(f"engine not built: {args.engine}")

    engine = chess.engine.SimpleEngine.popen_uci(args.engine)
    name = engine.id.get("name", "engine")
    times = []
    try:
        for i, fen in enumerate(sample_positions(args.positions)):
            board = chess.Board(fen)
            t0 = time.perf_counter()
            # A fresh `game` token makes python-chess send ucinewgame + isready first, as on move 1 of a game.
            engine.play(board, chess.engine.Limit(time=args.limit), game=object())
            ms = (time.perf_counter() - t0) * 1000
            times.append(ms)
            flag = "  <-- OVER 5 s RULE" if ms > args.limit * 1000 else "  <-- over budget" if ms > args.budget else ""
            print(f"{i + 1:3d}. {ms:7.1f} ms{flag}", flush=True)
    finally:
        engine.quit()

    worst = max(times)
    over_rule = sum(t > args.limit * 1000 for t in times)
    over_budget = sum(t > args.budget for t in times)
    print(f"TIMECHECK {name}: {len(times)} moves, avg {sum(times) / len(times):.0f} ms, max {worst:.0f} ms, "
          f"over budget ({args.budget:.0f} ms): {over_budget}, over the 5 s rule: {over_rule}")
    sys.exit(1 if over_budget else 0)


if __name__ == "__main__":
    main()
