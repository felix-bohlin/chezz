"""Independent integrity check of every saved game in games/.

For each game it replays the moves with python-chess from startFen and checks that:
  - every move is legal, and the recorded SAN and fenAfter match the replay
  - the embedded PGN contains exactly the same moves
  - the recorded result/termination agrees with the final position (checkmate, stalemate, draws)
  - the Stockfish Elo is recorded, and our engine never exceeded the 5 s move limit (a breach is an
    error unless it is listed, with its cause, in KNOWN_TIME_BREACHES)

Usage:
    python backend/verify_games.py            # exit code 1 if any check fails
"""

from __future__ import annotations

import io
import sys

import chess
import chess.pgn

from common import GAMES, load_games

MOVE_LIMIT_MS = 5000
# Anything slower leaves less than 150 ms between us and a breach: reported, so regressions show early.
NEAR_MISS_MS = 4850

# Moves of ours over the 5 s rule that are already on record. They are disclosed, not hidden: verify prints
# them on every run, PROGRESS.md and the About page list them, and any move not in this table is an error.
KNOWN_TIME_BREACHES = {
    ("0003", 9): "engine 0.1.3 had no self-imposed cap yet and searched to ~4940 ms, leaving 60 ms for UCI "
                 "round-trips; the cap (now 4700 ms) came in 0.1.5",
}


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
            known = KNOWN_TIME_BREACHES.get((g["id"], m["ply"]))
            msg = f"ply {m['ply']}: our move took {m['timeMs']} ms, over the {MOVE_LIMIT_MS} ms rule (wall-clock)"
            if known:
                warnings.append(f"{msg}. ON RECORD: {known}")
            else:
                errors.append(msg)

    near = [m["timeMs"] for m in g["moves"] if m["by"] == "us" and NEAR_MISS_MS < m["timeMs"] <= MOVE_LIMIT_MS]
    if near:
        warnings.append(f"{len(near)} near miss(es) over {NEAR_MISS_MS} ms, slowest {max(near)} ms")

    pgn = chess.pgn.read_game(io.StringIO(g["pgn"]))
    pgn_moves = [mv.uci() for mv in pgn.mainline_moves()] if pgn else []
    if pgn_moves != [m["uci"] for m in g["moves"]]:
        errors.append("PGN moves differ from the JSON move list")

    term = g["termination"]
    outcome = board.outcome(claim_draw=True)
    if term in ("engine-error", "engine-timeout", "stockfish-error"):
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
    unanalyzed = 0
    for g in games:
        errors, warnings = verify(g)
        status = "FAIL" if errors else "ok"
        print(f"{status:4s} {g['_file']}: {len(g['moves'])} plies, all legal" if not errors else f"FAIL {g['_file']}")
        for e in errors:
            print(f"     error: {e}")
        for w in warnings:
            print(f"     warning: {w}")
        failed += bool(errors)
        # Competition rule: every game is analyzed afterwards (analyze-game skill + both sub-agents).
        analysis = GAMES / g["_file"].replace(".json", ".analysis.md")
        if not analysis.exists():
            print(f"     warning: no {analysis.name} yet: run the analyze-game skill")
            unanalyzed += 1
        elif "sensei-moves" not in analysis.read_text(encoding="utf-8"):
            print(f"     warning: {analysis.name} has no sensei-moves block: analyze.py --annotate")
    print(f"VERIFY {len(games)} games, {failed} failed, {unanalyzed} without analysis")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
