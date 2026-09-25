"""Proves our engine respects the 5 s/move rule: plays it on positions from saved games with the exact
competition limit and reports wall-clock move times (including UCI round-trip).

Usage:
    python backend/timecheck.py [--positions 20] [--limit 5.0]

Exit code 1 if any move exceeds the limit.
"""

from __future__ import annotations

import argparse
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
    ap.add_argument("--limit", type=float, default=5.0)
    args = ap.parse_args()

    engine = chess.engine.SimpleEngine.popen_uci(str(ENGINE))
    times = []
    try:
        for i, fen in enumerate(sample_positions(args.positions)):
            board = chess.Board(fen)
            t0 = time.perf_counter()
            engine.play(board, chess.engine.Limit(time=args.limit))
            ms = (time.perf_counter() - t0) * 1000
            times.append(ms)
            flag = "  <-- OVER LIMIT" if ms > args.limit * 1000 else ""
            print(f"{i + 1:3d}. {ms:7.1f} ms{flag}", flush=True)
    finally:
        engine.quit()

    worst = max(times)
    over = sum(t > args.limit * 1000 for t in times)
    print(f"TIMECHECK {engine.id.get('name', 'engine')}: {len(times)} moves, avg {sum(times) / len(times):.0f} ms, "
          f"max {worst:.0f} ms, over limit: {over}")
    sys.exit(1 if over else 0)


if __name__ == "__main__":
    main()
