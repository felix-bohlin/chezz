"""Play our engine against strength-limited Stockfish and save every game to games/.

Usage:
    python backend/runner.py --elo 1600 --games 1
    python backend/runner.py --elo auto          # next ladder rung above our highest win
    python backend/runner.py --reindex           # only regenerate manifest.json + PROGRESS.md
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys
import time

import chess
import chess.engine
import chess.pgn

from common import ENGINE, GAMES, STOCKFISH, git_commit, load_games, next_game_id, next_ladder_elo, write_indexes

MOVE_TIME = 5.0  # seconds per move, both players (competition rule)
EVAL_CLAMP = 2000
LIVE = GAMES / "live.json"


def write_live(state: dict) -> None:
    """Snapshot for the frontend's live view; written atomically so readers never see half a file."""
    tmp = LIVE.with_suffix(".tmp")
    tmp.write_text(json.dumps({**state, "updatedAt": time.time()}), encoding="utf-8")
    tmp.replace(LIVE)


def white_eval(info: dict) -> tuple[int | None, int | None]:
    score = info.get("score")
    if score is None:
        return None, None
    w = score.white()
    cp = w.score(mate_score=EVAL_CLAMP)
    return max(-EVAL_CLAMP, min(EVAL_CLAMP, cp)), w.mate()


def play_game(elo: int, our_color: chess.Color, verbose: bool) -> pathlib.Path:
    ours = chess.engine.SimpleEngine.popen_uci(str(ENGINE))
    sf = chess.engine.SimpleEngine.popen_uci(str(STOCKFISH))
    sf.configure({"UCI_LimitStrength": True, "UCI_Elo": elo})
    sf_version = sf.id.get("name", "Stockfish")
    our_name = ours.id.get("name", "chezz")

    board = chess.Board()
    moves = []
    termination = None
    started = dt.datetime.now(dt.timezone.utc)
    live = {
        "active": True,
        "id": next_game_id(),
        "date": started.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stockfishElo": elo,
        "stockfishVersion": sf_version,
        "ourColor": "white" if our_color == chess.WHITE else "black",
        "engine": {"name": "chezz", "version": our_name.split()[-1], "commit": git_commit()},
        "startFen": chess.STARTING_FEN,
        "moves": moves,
    }
    GAMES.mkdir(exist_ok=True)
    write_live(live)
    try:
        while not board.is_game_over(claim_draw=True):
            is_us = board.turn == our_color
            player = ours if is_us else sf
            t0 = time.perf_counter()
            try:
                res = player.play(board, chess.engine.Limit(time=MOVE_TIME), info=chess.engine.INFO_ALL)
            except (chess.engine.EngineError, chess.engine.EngineTerminatedError) as exc:
                termination = "engine-error" if is_us else "stockfish-error"
                print(f"engine failure ({'us' if is_us else 'stockfish'}): {exc}", file=sys.stderr)
                break
            ms = int((time.perf_counter() - t0) * 1000)
            if res.move is None:
                termination = "engine-error" if is_us else "stockfish-error"
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

    if termination == "engine-error":
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
        "Event": "chezz vs Stockfish ladder",
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
        "engine": {"name": "chezz", "version": version, "commit": git_commit()},
        "startFen": chess.STARTING_FEN,
        "moves": moves,
        "pgn": str(pgn_game),
    }
    outcome_word = {"us": "win", "stockfish": "loss", "draw": "draw"}[winner]
    GAMES.mkdir(exist_ok=True)
    path = GAMES / f"{game_id}_elo-{elo}_{outcome_word}.json"
    path.write_text(json.dumps(record, indent=1) + "\n", encoding="utf-8")
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
        print(f"=== game {next_game_id()}: chezz ({'white' if our_color else 'black'}) vs Stockfish UCI_Elo {elo} ===",
              flush=True)
        path = play_game(elo, our_color, verbose=not args.quiet)
        rec = json.loads(path.read_text(encoding="utf-8"))
        print(f"RESULT {rec['result']} winner={rec['winner']} termination={rec['termination']} "
              f"plies={len(rec['moves'])} file=games/{path.name}", flush=True)


if __name__ == "__main__":
    main()
