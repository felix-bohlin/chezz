"""Shared paths and the games/ index writers (manifest.json, PROGRESS.md)."""

from __future__ import annotations

import json
import os
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
GAMES = ROOT / "games"
STOCKFISH = ROOT / "backend" / "tools" / "stockfish" / "stockfish" / "stockfish-windows-x86-64-universal.exe"
ENGINE = ROOT / "backend" / "engine" / "target" / "release" / "musashi.exe"
PROGRESS = ROOT / "PROGRESS.md"

# 1320-1500 were the warm-up; after that the ladder jumps to 2500 and climbs in 200-Elo steps
# (the prize is the highest win, and 3190 is Stockfish's maximum UCI_Elo).
LADDER = [1320, 1400, 1500, 2500, 2700, 2900, 3100, 3190]

# Draw adjudication: a game Stockfish itself scores as dead level for a long stretch is stopped as a draw
# instead of being shuffled out to a 50-move or repetition draw (game 15 ran 366 plies that way). Stockfish's
# eval is the referee: it searches at full strength and only then weakens its move choice, while our own eval
# was badly optimistic in exactly these endings (+2 to +5 for 150 plies of game 15). Backtested on games
# 1-15: fires only in the dead draws 12 and 15, never in a decisive game.
ADJUDICATE_MIN_PLY = 80      # not before move 40
ADJUDICATE_SF_MOVES = 10     # this many consecutive Stockfish moves (20 plies)...
ADJUDICATE_MAX_CP = 15       # ...each reporting |eval| <= 15 cp and no mate score
ADJUDICATION_RULE = (f"Stockfish's reported eval within ±{ADJUDICATE_MAX_CP} cp (no mate score) on "
                     f"{ADJUDICATE_SF_MOVES} consecutive Stockfish moves, from ply {ADJUDICATE_MIN_PLY} on, and its "
                     f"latest move was its own best move")


def draw_adjudication_due(moves: list[dict]) -> bool:
    """True when the draw-adjudication rule holds at the end of `moves` (the game's move records).

    Stockfish's eval on a move describes the position before that move. Its latest move must therefore be the
    best move of that search (`sfBest`): if UCI_LimitStrength picked a weaker move, it may be a real error that
    no eval covers yet, and adjudicating then would throw away a win. Games recorded before `sfBest` existed
    never qualify.
    """
    if len(moves) < ADJUDICATE_MIN_PLY:
        return False
    sf = [m for m in moves if m["by"] == "stockfish"][-ADJUDICATE_SF_MOVES:]
    return len(sf) == ADJUDICATE_SF_MOVES and sf[-1].get("sfBest") is True and all(
        m.get("evalCp") is not None and m.get("mate") is None and abs(m["evalCp"]) <= ADJUDICATE_MAX_CP
        for m in sf
    )


def git_commit() -> str:
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "backend/engine/src"], cwd=ROOT,
                               capture_output=True, text=True).stdout.strip()
        return sha + ("-dirty" if dirty else "")
    except Exception:
        return "unknown"


def load_games() -> list[dict]:
    games = []
    for p in sorted(GAMES.glob("[0-9][0-9][0-9][0-9]_*.json")):
        rec = json.loads(p.read_text(encoding="utf-8"))
        rec["_file"] = p.name
        games.append(rec)
    return games


def next_game_id() -> str:
    """Each machine owns a 1000-id window via CHEZZ_ID_BASE (0 = machine A, 1000 = machine B, ...),
    so two machines playing in parallel can never collide on filenames."""
    base = int(os.environ.get("CHEZZ_ID_BASE", "0"))
    ids = [int(p.name[:4]) for p in GAMES.glob("[0-9][0-9][0-9][0-9]_*.json")]
    mine = [i for i in ids if base < i <= base + 999]
    return f"{max(mine, default=base) + 1:04d}"


def highest_win(games: list[dict]) -> int | None:
    wins = [g["stockfishElo"] for g in games if g["winner"] == "us"]
    return max(wins) if wins else None


def next_ladder_elo(games: list[dict]) -> int:
    best = highest_win(games)
    if best is None:
        return LADDER[0]
    higher = [e for e in LADDER if e > best]
    return higher[0] if higher else LADDER[-1]


def our_max_ms(game: dict) -> int:
    return max((m["timeMs"] for m in game["moves"] if m["by"] == "us"), default=0)


# First engine version with the self-imposed MaxThinkMs cap (now 4700 ms); earlier versions had thinner margins.
CAPPED_SINCE = (0, 1, 5)


def _version(v: str) -> tuple[int, ...]:
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)


def time_record(games: list[dict]) -> list[str]:
    """PROGRESS.md lines for the 5 s rule: every breach by name, then the slowest move since the cap."""
    breaches = [(g["id"], m["ply"], m["timeMs"], g["engine"]["version"])
                for g in games for m in g["moves"] if m["by"] == "us" and m["timeMs"] > 5000]
    capped = [our_max_ms(g) for g in games if _version(g["engine"]["version"]) >= CAPPED_SINCE]
    lines = [f"- **5 s rule, moves of ours over the limit:** {len(breaches) or 'none'}"]
    lines += [f"  - game {i} ply {p}: {ms} ms (engine {v}, before the self-imposed cap)" for i, p, ms, v in breaches]
    lines.append(f"- **Slowest move since the cap (engine ≥ {'.'.join(map(str, CAPPED_SINCE))}):** "
                 f"{max(capped, default=0)} ms, wall-clock incl. UCI round-trip (engine searches ≤ 4700 ms)")
    return lines


def write_indexes() -> None:
    """Regenerate manifest.json and PROGRESS.md from the per-game files (single writer, never hand-edit)."""
    games = load_games()
    entries = []
    for g in games:
        analysis = g["_file"].replace(".json", ".analysis.md")
        entries.append({
            "id": g["id"],
            "file": g["_file"],
            "analysis": analysis if (GAMES / analysis).exists() else None,
            "date": g["date"],
            "stockfishElo": g["stockfishElo"],
            "ourColor": g["ourColor"],
            "result": g["result"],
            "winner": g["winner"],
            "termination": g["termination"],
            "plies": len(g["moves"]),
            "engineVersion": g["engine"]["version"],
            "ourMaxMoveMs": our_max_ms(g),
        })
    manifest = {
        "highestWin": highest_win(games),
        "nextElo": next_ladder_elo(games),
        "ladder": LADDER,
        "games": entries,
    }
    GAMES.mkdir(exist_ok=True)
    (GAMES / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Ladder progress",
        "",
        "Auto-generated by `backend/runner.py` from `games/` — do not edit by hand.",
        "",
        f"- **Highest Stockfish Elo beaten:** {manifest['highestWin'] or '—'}",
        f"- **Next ladder Elo:** {manifest['nextElo']}",
        f"- **Games played:** {len(games)} "
        f"(W {sum(g['winner'] == 'us' for g in games)} / "
        f"D {sum(g['winner'] == 'draw' for g in games)} / "
        f"L {sum(g['winner'] == 'stockfish' for g in games)})",
        *time_record(games),
        "",
        "| # | Date (UTC) | Stockfish Elo | Our color | Result | Outcome | Termination | Plies | Our max think | Engine | Game | Analysis |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for e, g in zip(entries, games):
        outcome = {"us": "**WIN**", "draw": "draw", "stockfish": "loss"}[e["winner"]]
        analysis = f"[md](games/{e['analysis']})" if e["analysis"] else "—"
        lines.append(
            f"| {e['id']} | {e['date'][:16].replace('T', ' ')} | {e['stockfishElo']} | {e['ourColor']} | "
            f"{e['result']} | {outcome} | {e['termination']} | {e['plies']} | {e['ourMaxMoveMs']} ms | "
            f"{g['engine']['version']} ({g['engine'].get('commit', '?')}) | [json](games/{e['file']}) | {analysis} |"
        )
    PROGRESS.write_text("\n".join(lines) + "\n", encoding="utf-8")
