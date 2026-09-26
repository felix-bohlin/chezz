"""Independent legality fuzz of the engine: talks raw UCI to musashi.exe and checks every `bestmove` it
prints against python-chess's legal move generator (a different implementation than the engine's shakmaty).

Positions come from three sources:
  1. curated edge cases (mate/stalemate -> must answer 0000, single legal move, en passant incl. pinned,
     promotions, castling rights, check evasions, a `position startpos moves ...` history)
  2. every position (both sides to move) of every saved game in games/
  3. random playouts, which reach odd promotions/underpromotions/en passant far more often than real games

Usage:
    python backend/legalcheck.py                    # ~1-2 min at the default 100 ms/move
    python backend/legalcheck.py --movetime 50 --random-games 40 --threads 1

Exit code 1 if any bestmove is illegal, unparsable, missing, or a null move in a position with legal moves.
"""

from __future__ import annotations

import argparse
import pathlib
import random
import subprocess
import sys
import time

import chess

from common import ENGINE, load_games

# (fen, note). Positions where the side to move has no legal move must be answered with `bestmove 0000`.
EDGE_CASES: list[tuple[str, str]] = [
    ("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", "checkmated (fool's mate)"),
    ("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "stalemated"),
    ("k7/8/8/8/8/8/8/7K w - - 0 1", "bare kings (insufficient material, but moves exist)"),
    ("6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1", "back-rank threat"),
    ("k7/8/1Q6/8/8/8/8/7K b - - 0 1", "stalemated by a queen"),
    ("k7/2K5/8/8/8/8/8/1Q6 w - - 0 1", "queen mates in one"),
    ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "all four castlings available"),
    ("r3k2r/8/8/8/8/8/8/R3K2R w Kk - 0 1", "only kingside rights"),
    ("r3k2r/8/8/2b5/8/8/8/R3K2R w KQkq - 0 1", "bishop on c5 eyes f2/g1: castling legality stress"),
    ("4k3/8/8/8/8/8/8/4K2R w K - 0 1", "kingside castling only"),
    ("4k3/8/8/8/8/8/8/R3K3 w Q - 0 1", "queenside castling only"),
    ("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", "castling with full pawn rows"),
    ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "en passant available"),
    ("4k3/8/8/2KpP2r/8/8/8/8 w - d6 0 1", "en passant illegal: horizontal pin exposes king"),
    ("8/8/8/8/k2pP2R/8/8/4K3 b - e3 0 1", "black en passant with rook on the rank"),
    ("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1", "promotion available"),
    ("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1", "promotion (repeat, TT warm)"),
    ("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "promotion by capture"),
    ("4k3/8/8/8/8/8/p7/4K3 b - - 0 1", "black promotion"),
    ("4k3/8/8/8/8/8/8/R3K2r w Q - 0 1", "white king in check from rook on h1: evasions only"),
    ("rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2", "ep square set but no ep capture possible"),
    ("8/8/8/8/8/2k5/1q6/K7 w - - 0 1", "checkmated by protected queen"),
    ("7k/8/8/8/8/8/8/K5Q1 w - - 0 1", "mate in 1 available (Qg8#)"),
    ("8/8/8/8/8/1k6/8/1K5q w - - 0 1", "checkmated on the back rank"),
    ("4k3/8/8/8/8/8/4p3/3RK3 b - - 0 1", "black pawn can promote by capturing d1"),
    ("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4", "scholar's mate threat"),
    ("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", "ep/pin stress (perft position 3)"),
    ("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", "kiwipete"),
    ("n1n5/PPPk4/8/8/8/8/4Kppp/5N1N b - - 0 1", "promotion storm, black"),
    ("n1n5/PPPk4/8/8/8/8/4Kppp/5N1N w - - 0 1", "promotion storm, white"),
    ("8/k7/3p4/p2P1p2/P2P1P2/8/8/K7 w - - 0 1", "few legal moves, blocked pawns"),
]

# Game prefixes sent as `position startpos moves ...` so the engine's move parser is exercised too.
HISTORY_LINES = [
    "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8",
    "d2d4 d7d5 c2c4 d5c4 e2e4 e7e5 g1f3 e5d4 f1c4 b8c6 e1g1",
    "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 c8e6 f2f3 f8e7 d1d2 e8g8 e1c1",
]


class Uci:
    def __init__(self, path: str, threads: int, hash_mb: int) -> None:
        self.p = subprocess.Popen([path], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, bufsize=1)
        self.send("uci")
        self.wait_for("uciok")
        self.send(f"setoption name Threads value {threads}")
        self.send(f"setoption name Hash value {hash_mb}")
        self.send("isready")
        self.wait_for("readyok")

    def send(self, line: str) -> None:
        assert self.p.stdin
        self.p.stdin.write(line + "\n")
        self.p.stdin.flush()

    def wait_for(self, prefix: str, timeout: float = 30.0) -> str:
        assert self.p.stdout
        deadline = time.perf_counter() + timeout
        while time.perf_counter() < deadline:
            line = self.p.stdout.readline()
            if not line:
                err = self.p.stderr.read() if self.p.stderr else ""
                raise RuntimeError(f"engine exited (rc={self.p.poll()}): {err}")
            if line.startswith(prefix):
                return line.strip()
        raise TimeoutError(f"no '{prefix}' within {timeout}s")

    def bestmove(self, position_cmd: str, movetime_ms: int) -> str:
        self.send(position_cmd)
        self.send(f"go movetime {movetime_ms}")
        line = self.wait_for("bestmove", timeout=movetime_ms / 1000 + 10)
        parts = line.split()
        return parts[1] if len(parts) > 1 else ""

    def quit(self) -> None:
        try:
            self.send("quit")
            self.p.wait(timeout=5)
        except Exception:
            self.p.kill()


def check(board: chess.Board, token: str) -> str | None:
    """None if the engine's answer is legal for `board`, otherwise a description of the problem."""
    legal = list(board.legal_moves)
    if token == "0000":
        return None if not legal else f"null move but {len(legal)} legal moves exist"
    if not legal:
        return f"answered {token!r} in a position with no legal moves"
    try:
        move = chess.Move.from_uci(token)
    except ValueError:
        return f"unparsable bestmove {token!r}"
    if move not in board.legal_moves:
        return f"ILLEGAL {token}"
    return None


def game_positions() -> list[tuple[str, str]]:
    out = []
    for g in load_games():
        board = chess.Board(g.get("startFen", chess.STARTING_FEN))
        for m in g["moves"]:
            out.append((board.fen(), f"{g['_file']} ply {m['ply']}"))
            board.push_uci(m["uci"])
        out.append((board.fen(), f"{g['_file']} final position"))
    return out


def random_positions(games: int, seed: int) -> list[tuple[str, str]]:
    rng = random.Random(seed)
    out = []
    for gi in range(games):
        board = chess.Board()
        ply = 0
        while not board.is_game_over() and ply < 200:
            moves = list(board.legal_moves)
            # bias towards captures/promotions/castling so the odd move types appear often
            special = [m for m in moves if board.is_capture(m) or m.promotion or board.is_castling(m)
                       or board.is_en_passant(m)]
            m = rng.choice(special) if special and rng.random() < 0.6 else rng.choice(moves)
            board.push(m)
            ply += 1
            interesting = board.is_check() or any(board.is_en_passant(x) or x.promotion for x in board.legal_moves)
            if ply % 7 == 0 or interesting:
                out.append((board.fen(), f"random game {gi} ply {ply}"))
        out.append((board.fen(), f"random game {gi} end ({board.result(claim_draw=True)})"))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--movetime", type=int, default=100, help="ms per position")
    ap.add_argument("--random-games", type=int, default=20)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--hash", type=int, default=64)
    ap.add_argument("--no-games", action="store_true", help="skip positions from saved games")
    ap.add_argument("--engine", default=str(ENGINE), help="UCI engine binary (default: the release build)")
    args = ap.parse_args()
    engine_path = pathlib.Path(args.engine)
    if not engine_path.exists():
        sys.exit(f"engine not built: {engine_path}")

    cases: list[tuple[str, str, str]] = []  # (position command, fen, note)
    for fen, note in EDGE_CASES:
        cases.append((f"position fen {fen}", fen, note))
    for line in HISTORY_LINES:
        board = chess.Board()
        for u in line.split():
            board.push_uci(u)
        cases.append((f"position startpos moves {line}", board.fen(), "history via startpos moves"))
    if not args.no_games:
        for fen, note in game_positions():
            cases.append((f"position fen {fen}", fen, note))
    for fen, note in random_positions(args.random_games, args.seed):
        cases.append((f"position fen {fen}", fen, note))

    eng = Uci(str(engine_path), args.threads, args.hash)
    failures = 0
    t0 = time.perf_counter()
    try:
        for i, (cmd, fen, note) in enumerate(cases, 1):
            board = chess.Board(fen)
            try:
                token = eng.bestmove(cmd, args.movetime)
                problem = check(board, token)
            except (RuntimeError, TimeoutError) as exc:
                # A crashed or hung engine is as bad as an illegal move: report it and start a fresh process.
                problem = f"engine died or hung: {exc}"
                eng.quit()
                eng = Uci(str(engine_path), args.threads, args.hash)
            if problem:
                failures += 1
                print(f"FAIL {i}: {problem}\n     {note}\n     {fen}\n     {cmd}", flush=True)
            elif i % 100 == 0:
                print(f"  {i}/{len(cases)} ok ({time.perf_counter() - t0:.0f}s)", flush=True)
    finally:
        eng.quit()
    print(f"LEGALCHECK {len(cases)} positions, {failures} failed, {time.perf_counter() - t0:.0f}s")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
