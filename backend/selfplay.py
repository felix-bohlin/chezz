"""Fast regression check: candidate engine vs baseline engine at a short time control.

Usage:
    python backend/selfplay.py --baseline backend/engine/baseline/musashi.exe [--games 16] [--time 0.1]

Plays each opening from both sides. Prints the candidate's score; exit code 1 if it scores
below --min (default 0.40), which the ladder-cycle skill treats as "revert the change".
"""

from __future__ import annotations

import argparse
import pathlib
import sys

import chess
import chess.engine

from common import ENGINE, ROOT

OPENINGS = [
    "e2e4 e7e5 g1f3 b8c6 f1b5",
    "e2e4 c7c5 g1f3 d7d6 d2d4",
    "d2d4 d7d5 c2c4 e7e6 b1c3",
    "d2d4 g8f6 c2c4 g7g6 b1c3",
    "e2e4 e7e6 d2d4 d7d5 b1c3",
    "c2c4 e7e5 b1c3 g8f6 g2g3",
    "e2e4 c7c6 d2d4 d7d5 e4e5",
    "g1f3 d7d5 g2g3 g8f6 f1g2",
]


def play(white: chess.engine.SimpleEngine, black: chess.engine.SimpleEngine, opening: str, t: float,
         game_key: int) -> str:
    board = chess.Board()
    for u in opening.split():
        board.push_uci(u)
    while not board.is_game_over(claim_draw=True) and board.ply() < 300:
        eng = white if board.turn == chess.WHITE else black
        # A new `game` value makes python-chess send ucinewgame.
        board.push(eng.play(board, chess.engine.Limit(time=t), game=game_key).move)
    return board.result(claim_draw=True) if board.is_game_over(claim_draw=True) else "1/2-1/2"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", required=True)
    ap.add_argument("--candidate", default=str(ENGINE))
    ap.add_argument("--games", type=int, default=16)
    ap.add_argument("--time", type=float, default=0.1)
    ap.add_argument("--min", type=float, default=0.40)
    args = ap.parse_args()

    baseline = pathlib.Path(args.baseline)
    base = chess.engine.SimpleEngine.popen_uci(str(baseline if baseline.is_absolute() else ROOT / baseline))
    cand = chess.engine.SimpleEngine.popen_uci(args.candidate)
    score = 0.0
    played = 0
    try:
        for i in range(args.games):
            opening = OPENINGS[(i // 2) % len(OPENINGS)]
            cand_white = i % 2 == 0
            res = play(cand, base, opening, args.time, i) if cand_white else play(base, cand, opening, args.time, i)
            pts = {"1-0": 1.0, "0-1": 0.0}.get(res, 0.5)
            score += pts if cand_white else 1.0 - pts
            played += 1
            print(f"game {i + 1}: candidate {'white' if cand_white else 'black'} {res}  running {score}/{played}",
                  flush=True)
    finally:
        base.quit()
        cand.quit()
    frac = score / max(1, played)
    print(f"SELFPLAY candidate scored {score}/{played} = {frac:.0%} (min {args.min:.0%})")
    sys.exit(0 if frac >= args.min else 1)


if __name__ == "__main__":
    main()
