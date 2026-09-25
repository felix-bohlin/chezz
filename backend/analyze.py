"""Objective post-game report: full-strength Stockfish re-evaluates every position of a saved game.

Usage:
    python backend/analyze.py games/0001_elo-1320_win.json [--time 0.15] [--top 8]

Prints a compact markdown report (stats + our worst moves with FENs) to stdout. This is the
evidence the analyze-game skill and the two analysis agents work from.
"""

from __future__ import annotations

import argparse
import json
import pathlib

import chess
import chess.engine

from common import ROOT, STOCKFISH

MATE_CP = 3000


def cp_white(info: dict) -> int:
    return info["score"].white().score(mate_score=MATE_CP)


def classify(loss: int) -> str | None:
    if loss >= 300:
        return "blunder"
    if loss >= 120:
        return "mistake"
    if loss >= 60:
        return "inaccuracy"
    return None


def phase_of(board: chess.Board, ply: int) -> str:
    if ply <= 20:
        return "opening"
    minor_major = sum(len(board.pieces(pt, c)) for pt in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
                      for c in (chess.WHITE, chess.BLACK))
    return "endgame" if minor_major <= 6 else "middlegame"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("game")
    ap.add_argument("--time", type=float, default=0.15, help="Stockfish seconds per position")
    ap.add_argument("--top", type=int, default=8)
    args = ap.parse_args()

    path = pathlib.Path(args.game)
    if not path.is_absolute() and not path.exists():
        path = ROOT / args.game
    rec = json.loads(path.read_text(encoding="utf-8"))
    our_white = rec["ourColor"] == "white"
    sign = 1 if our_white else -1

    sf = chess.engine.SimpleEngine.popen_uci(str(STOCKFISH))
    sf.configure({"Threads": 4, "Hash": 256})
    board = chess.Board(rec.get("startFen", chess.STARTING_FEN))
    limit = chess.engine.Limit(time=args.time)

    evals = []  # white-POV eval before each ply, plus final
    bests = []
    try:
        for m in rec["moves"]:
            info = sf.analyse(board, limit)
            evals.append(cp_white(info))
            pv = info.get("pv") or []
            bests.append(board.san(pv[0]) if pv else "?")
            board.push_uci(m["uci"])
        if board.is_checkmate():
            evals.append(-MATE_CP if board.turn == chess.WHITE else MATE_CP)
        elif board.is_game_over(claim_draw=True):
            evals.append(0)
        else:
            evals.append(cp_white(sf.analyse(board, limit)))
    finally:
        sf.quit()

    board = chess.Board(rec.get("startFen", chess.STARTING_FEN))
    rows = []
    stats = {"us": [], "stockfish": []}
    counts = {"us": {}, "stockfish": {}}
    phase_loss = {"opening": [], "middlegame": [], "endgame": []}
    max_adv = -10**9
    for i, m in enumerate(rec["moves"]):
        mover_sign = 1 if board.turn == chess.WHITE else -1
        before = evals[i] * mover_sign
        after = evals[i + 1] * mover_sign
        loss = max(0, min(before, MATE_CP) - min(after, MATE_CP))
        if bests[i] == board.san(chess.Move.from_uci(m["uci"])):
            loss = 0  # we played the engine's best move; any eval drop is depth resolution, not an error
        stats[m["by"]].append(min(loss, 1000))
        kind = classify(loss)
        if kind:
            counts[m["by"]][kind] = counts[m["by"]].get(kind, 0) + 1
        if m["by"] == "us":
            ph = phase_of(board, i + 1)
            phase_loss[ph].append(min(loss, 1000))
            own = m.get("evalCp")
            own_pov = None if own is None else own * sign
            rows.append({
                "ply": i + 1,
                "move_no": f"{board.fullmove_number}{'.' if board.turn == chess.WHITE else '...'}",
                "san": m["san"],
                "best": bests[i],
                "before": before,
                "after": after,
                "loss": loss,
                "kind": kind,
                "phase": ph,
                "fen": board.fen(),
                "own": own_pov,
                "depth": m.get("depth"),
            })
        max_adv = max(max_adv, evals[i + 1] * sign)
        board.push_uci(m["uci"])

    def acpl(xs: list[int]) -> str:
        return f"{sum(xs) / len(xs):.0f}" if xs else "—"

    us_moves = [m for m in rec["moves"] if m["by"] == "us"]
    times = [m["timeMs"] for m in us_moves]
    depths = [m["depth"] for m in us_moves if m.get("depth")]

    out = []
    out.append(f"## Objective report — game {rec['id']} (Stockfish UCI_Elo {rec['stockfishElo']})")
    out.append("")
    out.append(f"- Result: **{rec['result']}** ({rec['termination']}), we played **{rec['ourColor']}**, "
               f"{len(rec['moves'])} plies, winner: **{rec['winner']}**")
    out.append(f"- Avg centipawn loss — us: **{acpl(stats['us'])}**, Stockfish: **{acpl(stats['stockfish'])}**")
    out.append(f"- Our errors: {counts['us'] or 'none'} | Stockfish errors: {counts['stockfish'] or 'none'}")
    out.append(f"- Our ACPL by phase: opening {acpl(phase_loss['opening'])}, "
               f"middlegame {acpl(phase_loss['middlegame'])}, endgame {acpl(phase_loss['endgame'])}")
    out.append(f"- Our time/move: avg {sum(times) / max(1, len(times)):.0f} ms, max {max(times, default=0)} ms; "
               f"search depth avg {sum(depths) / max(1, len(depths)):.1f}, min {min(depths, default=0)}")
    out.append(f"- Peak objective advantage for us: {max_adv:+d} cp"
               + (" — **advantage not converted**" if max_adv >= 300 and rec["winner"] != "us" else ""))
    swing = [(i, evals[i] * sign) for i in range(0, len(evals), max(1, len(evals) // 16))]
    out.append("- Eval curve (our POV, sampled by ply): " + ", ".join(f"{p}:{v:+d}" for p, v in swing))
    out.append("")
    worst = sorted(rows, key=lambda r: -r["loss"])[: args.top]
    worst = [r for r in worst if r["loss"] >= 40]
    if worst:
        out.append("### Our worst moves (full-strength Stockfish)")
        out.append("")
        out.append("| Ply | Move | Played | SF best | Eval before → after (our POV) | Loss | Phase | Our engine said | Depth | FEN before |")
        out.append("|---|---|---|---|---|---|---|---|---|---|")
        for r in worst:
            own = "?" if r["own"] is None else f"{r['own']:+d}"
            out.append(f"| {r['ply']} | {r['move_no']} | {r['san']} | {r['best']} | {r['before']:+d} → {r['after']:+d} | "
                       f"{r['loss']} {r['kind'] or ''} | {r['phase']} | {own} | {r['depth']} | `{r['fen']}` |")
    else:
        out.append("### No significant errors by us (all moves within 40 cp of Stockfish's best).")
    print("\n".join(out))


if __name__ == "__main__":
    main()
