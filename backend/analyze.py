"""Objective post-game report: full-strength Stockfish re-evaluates every position of a saved game.

Usage:
    python backend/analyze.py games/0001_elo-1320_win.json [--time 0.15] [--top 8] [--annotate]

Prints a compact markdown report (stats + our worst moves with FENs) to stdout. This is the
evidence the analyze-game skill and the two analysis agents work from.

The report ends with a one-line `<!-- sensei-moves {...} -->` block: every notable move of both
sides (blunder / mistake / good / brilliant) as JSON. It is invisible in rendered markdown; the
replay app reads it from the .analysis.md to drive the sensei's commentary. `--annotate` writes
(or refreshes) just that block in the game's existing .analysis.md.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re

import chess
import chess.engine

from common import ROOT, STOCKFISH

MATE_CP = 3000
# Sensei verdicts use evals clamped to ±SENSEI_CLAMP, so moves in an already-decided game neither
# blunder nor shine. Praise: the played move was Stockfish's best and the second-best was GOOD_GAP worse;
# brilliant if it is also a sacrifice, or a quiet only-move BRILLIANT_GAP ahead of the rest.
GOOD_GAP = 100
BRILLIANT_GAP = 250
SENSEI_CLAMP = 800
VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
SENSEI_RE = re.compile(r"\n*<!-- sensei-moves .*? -->\n?")


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


def is_sacrifice(board: chess.Board, move: chess.Move) -> bool:
    """The moved piece (not a pawn or king) lands where it can be taken for at least 2 points net."""
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type in (chess.PAWN, chess.KING):
        return False
    captured = board.piece_at(move.to_square)
    gain = VALUE[captured.piece_type] if captured else 0
    after = board.copy(stack=False)
    after.push(move)
    attackers = after.attackers(not piece.color, move.to_square)
    if not attackers:
        return False
    cheapest = min(VALUE[after.piece_type_at(sq)] or 99 for sq in attackers)
    defended = bool(after.attackers(piece.color, move.to_square))
    lost = max(0, VALUE[piece.piece_type] - cheapest) if defended else VALUE[piece.piece_type]
    return gain - lost <= -2


def sensei_kind(board: chess.Board, move: chess.Move, played_best: bool, before: int, after: int,
                second: int | None) -> tuple[str | None, int]:
    """(verdict, clamped loss) for one move; evals from the mover's point of view, before the move is pushed."""
    def clamp(v: int) -> int:
        return max(-SENSEI_CLAMP, min(v, SENSEI_CLAMP))

    loss = 0 if played_best else max(0, clamp(before) - clamp(after))
    kind = classify(loss)
    if kind in ("blunder", "mistake"):
        return kind, loss
    if not played_best or second is None or clamp(before) - clamp(second) < GOOD_GAP:
        return None, loss
    capture = board.is_capture(move)
    if is_sacrifice(board, move) or (clamp(before) - clamp(second) >= BRILLIANT_GAP and not capture
                                     and not board.gives_check(move)):
        return "brilliant", loss
    if capture and board.move_stack and board.peek().to_square == move.to_square:
        return None, loss  # a plain recapture is no feat
    return "good", loss


def annotate(analysis: pathlib.Path, block: str) -> None:
    text = SENSEI_RE.sub("", analysis.read_text(encoding="utf-8")).rstrip("\n")
    analysis.write_text(text + "\n\n" + block + "\n", encoding="utf-8")


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
    ap.add_argument("--annotate", action="store_true", help="write the sensei-moves block into the .analysis.md")
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
    seconds = []  # white-POV eval of the second-best move (None when there is only one legal move)
    bests = []
    try:
        for m in rec["moves"]:
            infos = sf.analyse(board, limit, multipv=2)
            info = infos[0]
            evals.append(cp_white(info))
            seconds.append(cp_white(infos[1]) if len(infos) > 1 else None)
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
    sensei = []  # notable moves of both sides, for the replay's sensei commentary
    for i, m in enumerate(rec["moves"]):
        mover_sign = 1 if board.turn == chess.WHITE else -1
        before = evals[i] * mover_sign
        after = evals[i + 1] * mover_sign
        loss = max(0, min(before, MATE_CP) - min(after, MATE_CP))
        move = chess.Move.from_uci(m["uci"])
        played_best = bests[i] == board.san(move)
        if played_best:
            loss = 0  # we played the engine's best move; any eval drop is depth resolution, not an error
        stats[m["by"]].append(min(loss, 1000))
        kind = classify(loss)
        if kind:
            counts[m["by"]][kind] = counts[m["by"]].get(kind, 0) + 1
        second = None if seconds[i] is None else seconds[i] * mover_sign
        sk, sensei_loss = sensei_kind(board, move, played_best, before, after, second)
        if sk:
            # before/after from OUR point of view, like the report's eval columns
            note = {"ply": i + 1, "by": m["by"], "kind": sk, "san": m["san"], "best": bests[i],
                    "before": evals[i] * sign, "after": evals[i + 1] * sign}
            if sk in ("blunder", "mistake"):
                note["loss"] = sensei_loss
            sensei.append(note)
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
               f"{(len(rec['moves']) + 1) // 2} moves, winner: **{rec['winner']}**")
    out.append(f"- Avg centipawn loss — us: **{acpl(stats['us'])}**, Stockfish: **{acpl(stats['stockfish'])}**")
    out.append(f"- Our errors: {counts['us'] or 'none'} | Stockfish errors: {counts['stockfish'] or 'none'}")
    out.append(f"- Our ACPL by phase: opening {acpl(phase_loss['opening'])}, "
               f"middlegame {acpl(phase_loss['middlegame'])}, endgame {acpl(phase_loss['endgame'])}")
    out.append(f"- Our time/move: avg {sum(times) / max(1, len(times)):.0f} ms, max {max(times, default=0)} ms; "
               f"search depth avg {sum(depths) / max(1, len(depths)):.1f}, min {min(depths, default=0)}")
    out.append(f"- Peak objective advantage for us: {max_adv:+d} cp"
               + (" — **advantage not converted**" if max_adv >= 300 and rec["winner"] != "us" else ""))
    swing = [(i, evals[i] * sign) for i in range(0, len(evals), max(1, len(evals) // 16))]
    # Label each sample by the move just played: "12." after White's 12th, "12..." after Black's.
    label = lambda p: "start" if p == 0 else f"{(p + 1) // 2}{'.' if p % 2 else '...'}"
    out.append("- Eval curve (our POV, sampled by move): " + ", ".join(f"{label(p)}:{v:+d}" for p, v in swing))
    out.append("")
    worst = sorted(rows, key=lambda r: -r["loss"])[: args.top]
    worst = [r for r in worst if r["loss"] >= 40]
    if worst:
        out.append("### Our worst moves (full-strength Stockfish)")
        out.append("")
        out.append("| Move | Played | SF best | Eval before → after (our POV) | Loss | Phase | Our engine said | Depth | FEN before |")
        out.append("|---|---|---|---|---|---|---|---|---|")
        for r in worst:
            own = "?" if r["own"] is None else f"{r['own']:+d}"
            out.append(f"| {r['move_no']} | {r['san']} | {r['best']} | {r['before']:+d} → {r['after']:+d} | "
                       f"{r['loss']} {r['kind'] or ''} | {r['phase']} | {own} | {r['depth']} | `{r['fen']}` |")
    else:
        out.append("### No significant errors by us (all moves within 40 cp of Stockfish's best).")
    block = "<!-- sensei-moves " + json.dumps({"v": 1, "moves": sensei}, separators=(",", ":"), ensure_ascii=False) + " -->"
    out.append("")
    out.append(block)
    print("\n".join(out))
    if args.annotate:
        analysis = path.with_name(path.name.replace(".json", ".analysis.md"))
        if analysis.exists():
            annotate(analysis, block)
            print(f"annotated {analysis.name}")
        else:
            print(f"no {analysis.name} to annotate")


if __name__ == "__main__":
    main()
