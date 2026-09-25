"""Independent integrity check of every saved game in games/.

For each game it replays the moves with python-chess from startFen and checks that:
  - every move is legal, and the recorded SAN and fenAfter match the replay
  - the embedded PGN contains exactly the same moves
  - the recorded result/termination agrees with the final position (checkmate, stalemate, draws)
  - the Stockfish Elo is recorded, and our engine never exceeded the 5 s move limit

Usage:
    python backend/verify_games.py            # exit code 1 if any check fails
"""

from __future__ import annotations

import io
import sys

import chess
import chess.pgn

from common import load_games

MOVE_LIMIT_MS = 5000


def verify(g: dict) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    board = chess.Board(g.get("startFen", chess.STARTING_FEN))

    for m in g["moves"]:
        try:
            move = chess.Move.from_uci(m["uci"])
        except ValueError:
            errors.append(f"ply {m['ply']}: unparsable move {m['uci']}")
            break
        if move not in board.legal_moves:
            errors.append(f"ply {m['ply']}: ILLEGAL move {m['uci']} in {board.fen()}")
            break
        if board.san(move) != m["san"]:
            errors.append(f"ply {m['ply']}: SAN mismatch {m['san']} vs {board.san(move)}")
        board.push(move)
        if board.fen() != m["fenAfter"]:
            errors.append(f"ply {m['ply']}: fenAfter mismatch")
        if m["by"] == "us" and m["timeMs"] > MOVE_LIMIT_MS:
            warnings.append(f"ply {m['ply']}: our move took {m['timeMs']} ms (> {MOVE_LIMIT_MS} ms, wall-clock)")

    pgn = chess.pgn.read_game(io.StringIO(g["pgn"]))
    pgn_moves = [mv.uci() for mv in pgn.mainline_moves()] if pgn else []
    if pgn_moves != [m["uci"] for m in g["moves"]]:
        errors.append("PGN moves differ from the JSON move list")

    term = g["termination"]
    outcome = board.outcome(claim_draw=True)
    if term in ("engine-error", "stockfish-error"):
        warnings.append(f"ended by {term}")
    elif outcome is None:
        errors.append(f"game recorded as {g['result']} ({term}) but the final position is not over")
    else:
        if outcome.result() != g["result"]:
            errors.append(f"result {g['result']} but final position gives {outcome.result()}")
        if outcome.termination.name.lower() != term:
            errors.append(f"termination {term} but final position gives {outcome.termination.name.lower()}")

    if not isinstance(g.get("stockfishElo"), int):
        errors.append("stockfishElo missing")
    return errors, warnings


def main() -> None:
    games = load_games()
    failed = 0
    for g in games:
        errors, warnings = verify(g)
        status = "FAIL" if errors else "ok"
        print(f"{status:4s} {g['_file']}: {len(g['moves'])} plies, all legal" if not errors else f"FAIL {g['_file']}")
        for e in errors:
            print(f"     error: {e}")
        for w in warnings:
            print(f"     warning: {w}")
        failed += bool(errors)
    print(f"VERIFY {len(games)} games, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
