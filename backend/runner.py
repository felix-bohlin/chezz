"""Play our engine against strength-limited Stockfish and save every game to games/.

Usage:
    python backend/runner.py --elo 1600 --games 1
    python backend/runner.py --elo auto          # next ladder rung above our highest win
    python backend/runner.py --reindex           # only regenerate manifest.json + PROGRESS.md
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import pathlib
import sys
import time

import chess
import chess.engine
import chess.pgn

from common import ENGINE, GAMES, STOCKFISH, git_commit, load_games, next_game_id, next_ladder_elo, write_indexes
from verify_games import verify

MOVE_TIME = 5.0  # seconds per move, both players (competition rule)
EVAL_CLAMP = 2000
LIVE = GAMES / "live.json"


def write_live(state: dict) -> None:
    """Snapshot for the frontend's live view; written atomically so readers never see half a file.

    Best effort only: on Windows the replace fails while a reader (the dev server polling for the live
    view) has live.json open. The live view is cosmetic and must never crash a ladder game.
    """
    tmp = LIVE.with_suffix(".tmp")
    try:
        tmp.write_text(json.dumps({**state, "updatedAt": time.time()}), encoding="utf-8")
    except OSError:
        return
    for _ in range(10):
        try:
            tmp.replace(LIVE)
            return
        except PermissionError:
            time.sleep(0.02)
    # Still locked after ~200 ms: skip this snapshot, the next move writes a fresh one.


def white_eval(info: dict) -> tuple[int | None, int | None]:
    score = info.get("score")
    if score is None:
        return None, None
    w = score.white()
    cp = w.score(mate_score=EVAL_CLAMP)
    return max(-EVAL_CLAMP, min(EVAL_CLAMP, cp)), w.mate()


def sf_play(sf: chess.engine.SimpleEngine, board: chess.Board) -> chess.engine.PlayResult:
    """Stockfish's move, with the eval of its last completed search iteration.

    With UCI_LimitStrength, Stockfish always prints one extra info line after the search for the move its
    weakening picked. When that isn't the search's best move it has no score, and Stockfish reports cp 0.
    play() keeps only the last info line, so we collect all of them via analysis() and drop that one.
    """
    def run() -> chess.engine.PlayResult:
        with sf.analysis(board, chess.engine.Limit(time=MOVE_TIME), info=chess.engine.INFO_ALL) as an:
            scored = [i for i in an if "score" in i and i.get("multipv", 1) == 1]
            best = an.wait()
        if len(scored) > 1:
            scored.pop()  # the post-search line; the one before it is the last completed iteration
        return chess.engine.PlayResult(best.move, best.ponder, scored[-1] if scored else {})

    # analysis() has no timeout of its own; match play()'s (move time + SimpleEngine.timeout) so a stalled
    # Stockfish still raises TimeoutError. The caller then quits the process, which unblocks the worker.
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        return pool.submit(run).result(timeout=MOVE_TIME + sf.timeout)
    finally:
        pool.shutdown(wait=False)


def play_game(elo: int, our_color: chess.Color, verbose: bool) -> pathlib.Path:
    ours = chess.engine.SimpleEngine.popen_uci(str(ENGINE))
    sf = chess.engine.SimpleEngine.popen_uci(str(STOCKFISH))
    sf.configure({"UCI_LimitStrength": True, "UCI_Elo": elo})
    sf_version = sf.id.get("name", "Stockfish")
    our_name = ours.id.get("name", "musashi")

    board = chess.Board()
    moves = []
    violations: list[int] = []
    termination = None
    started = dt.datetime.now(dt.timezone.utc)
    live = {
        "active": True,
        "id": next_game_id(),
        "date": started.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stockfishElo": elo,
        "stockfishVersion": sf_version,
        "ourColor": "white" if our_color == chess.WHITE else "black",
        "engine": {"name": "musashi", "version": our_name.split()[-1], "commit": git_commit()},
        "startFen": chess.STARTING_FEN,
        "moves": moves,
    }
    GAMES.mkdir(exist_ok=True)
    write_live(live)
    try:
        while not board.is_game_over(claim_draw=True):
            is_us = board.turn == our_color
            live["turnStartedAt"] = time.time()
            write_live(live)
            t0 = time.perf_counter()
            try:
                if is_us:
                    res = ours.play(board, chess.engine.Limit(time=MOVE_TIME), info=chess.engine.INFO_ALL)
                else:
                    res = sf_play(sf, board)
            except TimeoutError:
                if is_us:
                    termination = "engine-timeout"
                    print("our engine did not answer in time", file=sys.stderr, flush=True)
                    break
                # A stalled Stockfish (seen once as a transient system hiccup) gets a fresh process and a
                # fresh 5 s search for the same position rather than killing the whole game.
                print(f"stockfish timed out at ply {len(moves) + 1}; restarting it", file=sys.stderr, flush=True)
                try:
                    sf.quit()
                except Exception:
                    pass
                sf = chess.engine.SimpleEngine.popen_uci(str(STOCKFISH))
                sf.configure({"UCI_LimitStrength": True, "UCI_Elo": elo})
                continue
            except (chess.engine.EngineError, chess.engine.EngineTerminatedError) as exc:
                termination = "engine-error" if is_us else "stockfish-error"
                print(f"engine failure ({'us' if is_us else 'stockfish'}): {exc}", file=sys.stderr)
                break
            ms = int((time.perf_counter() - t0) * 1000)
            if is_us and ms > MOVE_TIME * 1000:
                violations.append(len(moves) + 1)
                print(f"!!! TIME VIOLATION: our move at ply {len(moves) + 1} took {ms} ms (limit {MOVE_TIME:g} s)",
                      file=sys.stderr, flush=True)
            # python-chess already rejects an illegal bestmove (push_uci raises -> EngineError above), but a
            # null move (0000) parses fine, so check legality once more before anything is recorded.
            if res.move is None or res.move not in board.legal_moves:
                termination = "engine-error" if is_us else "stockfish-error"
                print(f"engine failure ({'us' if is_us else 'stockfish'}): bestmove {res.move} is not legal in "
                      f"{board.fen()}", file=sys.stderr, flush=True)
                break
            cp, mate = white_eval(res.info)
            san = board.san(res.move)
            board.push(res.move)
            moves.append({
                "ply": len(moves) + 1,
                "san": san,
                "uci": res.move.uci(),
                "by": "us" if is_us else "stockfish",
                "fenAfter": board.fen(),
                "evalCp": cp,
                "mate": mate,
                "depth": res.info.get("depth"),
                "timeMs": ms,
            })
            write_live(live)
            if verbose:
                who = "us" if is_us else "sf"
                ev = f"{cp:+d}" if cp is not None else "  ?"
                print(f"{len(moves):3d}. {who:2s} {san:8s} eval(w) {ev:>6s}  d{res.info.get('depth', '?')}  {ms}ms",
                      flush=True)
    finally:
        ours.quit()
        sf.quit()

    if termination in ("engine-error", "engine-timeout"):
        result = "0-1" if our_color == chess.WHITE else "1-0"
    elif termination == "stockfish-error":
        result = "1-0" if our_color == chess.WHITE else "0-1"
    else:
        outcome = board.outcome(claim_draw=True)
        result = outcome.result() if outcome else "1/2-1/2"
        termination = outcome.termination.name.lower() if outcome else "unknown"

    if result == "1/2-1/2":
        winner = "draw"
    elif (result == "1-0") == (our_color == chess.WHITE):
        winner = "us"
    else:
        winner = "stockfish"

    game_id = next_game_id()
    color_name = "white" if our_color == chess.WHITE else "black"
    our_label = f"{our_name} ({git_commit()})"
    sf_label = f"{sf_version} (UCI_Elo {elo})"

    pgn_game = chess.pgn.Game()
    pgn_game.headers.update({
        "Event": "Musashi vs Stockfish ladder",
        "Site": "local",
        "Date": started.strftime("%Y.%m.%d"),
        "Round": game_id,
        "White": our_label if our_color == chess.WHITE else sf_label,
        "Black": sf_label if our_color == chess.WHITE else our_label,
        "Result": result,
        "StockfishElo": str(elo),
        "WhiteElo" if our_color == chess.BLACK else "BlackElo": str(elo),
        "TimeControl": f"{MOVE_TIME:g}s/move",
        "Termination": termination,
    })
    node = pgn_game
    for m in moves:
        node = node.add_variation(chess.Move.from_uci(m["uci"]))
        if m["mate"] is not None:
            node.comment = f"[%eval #{m['mate']}]"
        elif m["evalCp"] is not None:
            node.comment = f"[%eval {m['evalCp'] / 100:.2f}]"
    pgn_game.headers["Result"] = result

    version = our_name.split()[-1] if " " in our_name else "?"
    record = {
        "id": game_id,
        "date": started.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stockfishElo": elo,
        "stockfishVersion": sf_version,
        "moveTimeSec": MOVE_TIME,
        "ourColor": color_name,
        "result": result,
        "winner": winner,
        "termination": termination,
        "engine": {"name": "musashi", "version": version, "commit": git_commit()},
        "startFen": chess.STARTING_FEN,
        "ourMaxMoveMs": max((m["timeMs"] for m in moves if m["by"] == "us"), default=0),
        "timeViolations": violations,
        "moves": moves,
        "pgn": str(pgn_game),
    }
    outcome_word = {"us": "win", "stockfish": "loss", "draw": "draw"}[winner]
    GAMES.mkdir(exist_ok=True)
    path = GAMES / f"{game_id}_elo-{elo}_{outcome_word}.json"
    path.write_text(json.dumps(record, indent=1) + "\n", encoding="utf-8")
    # Independent replay of what was just saved (the verify_games.py check): every move legal, SAN/FEN/PGN
    # and result consistent. A failure here is a bug and must never go unnoticed.
    errors, _ = verify({**record, "_file": path.name})
    for e in errors:
        print(f"!!! VERIFY FAILED games/{path.name}: {e}", file=sys.stderr, flush=True)
    print(f"verify games/{path.name}: {'FAIL' if errors else 'ok'}", flush=True)
    write_indexes()
    write_live({"active": False, "lastGameId": game_id})
    return path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--elo", default="auto", help="Stockfish UCI_Elo (1320-3190) or 'auto'")
    ap.add_argument("--games", type=int, default=1)
    ap.add_argument("--color", choices=["white", "black", "alternate"], default="alternate")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--reindex", action="store_true")
    args = ap.parse_args()

    if args.reindex:
        write_indexes()
        print("reindexed")
        return
    if not ENGINE.exists():
        sys.exit(f"engine not built: {ENGINE}\n  cd backend/engine && cargo build --release")

    for _ in range(args.games):
        elo = next_ladder_elo(load_games()) if args.elo == "auto" else int(args.elo)
        if args.color == "alternate":
            our_color = chess.WHITE if int(next_game_id()) % 2 == 1 else chess.BLACK
        else:
            our_color = chess.WHITE if args.color == "white" else chess.BLACK
        print(f"=== game {next_game_id()}: musashi ({'white' if our_color else 'black'}) vs Stockfish UCI_Elo {elo} ===",
              flush=True)
        path = play_game(elo, our_color, verbose=not args.quiet)
        rec = json.loads(path.read_text(encoding="utf-8"))
        print(f"RESULT {rec['result']} winner={rec['winner']} termination={rec['termination']} "
              f"plies={len(rec['moves'])} ourMaxMs={rec['ourMaxMoveMs']} "
              f"violations={len(rec['timeViolations'])} file=games/{path.name}", flush=True)


if __name__ == "__main__":
    main()
