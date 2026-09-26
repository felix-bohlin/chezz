---
name: analyze-game
description: Analyze one finished Musashi-vs-Stockfish game - full-strength Stockfish post-mortem plus the shogun-sensei and engine-smith sub-agents - and write games/<game>.analysis.md with ranked engine improvements. Use after every ladder game. Argument - a game file path; defaults to the newest game.
---

# Analyze a ladder game

Required by the competition rules after **every** game: this skill + two different sub-agents.

## Steps

1. **Pick the game.** Use the path given as the argument; otherwise the last entry in
   `games/manifest.json` (`games[-1].file`). Let `STEM` be the filename without `.json`.

2. **Objective report.** Run (≈15–30 s):
   ```
   python backend/analyze.py games/<STEM>.json
   ```
   Keep the printed markdown as `REPORT`. (Prepend Python to PATH first if `python` isn't found; see CLAUDE.md.)
   Its last line is a `<!-- sensei-moves {...} -->` block — keep it verbatim in the analysis file (it drives
   the replay's sensei commentary), but don't pass it to the sub-agents.

3. **Two sub-agents in parallel.** In a *single* message, launch both with the Agent tool:
   - `subagent_type: shogun-sensei`
   - `subagent_type: engine-smith`

   Give each the same prompt: the game path `games/<STEM>.json`, the full `REPORT` text, the engine
   version from the game JSON, and "Follow your output format; max ~250 words." Don't paste the game
   JSON; they can read it if they need to.

   If those agent types aren't available (definitions added mid-session load only after a restart),
   use `subagent_type: general-purpose` with `model: haiku` for both, and start each prompt with
   "First read your role definition at `.claude/agents/<name>.md` (everything after the frontmatter)
   and act exactly as that agent. Use only read-only tools."

4. **Synthesize.** Choose the **one** change to implement next. Prefer a suggestion that:
   both agents point at, or that is backed by the biggest centipawn loss in the report, and is
   low-risk. List at most two runners-up as backlog.

5. **Write `games/<STEM>.analysis.md`:**
   ```markdown
   # Game <id> — Musashi <version> vs Stockfish UCI_Elo <elo>: <result> (<winner>)

   <REPORT>

   <shogun-sensei output verbatim>

   <engine-smith output verbatim>

   ## Decision
   - **Implement next:** <one change, which file/function, why>
   - **Backlog:** <1–2 other suggestions>
   ```

6. **Reindex:** `python backend/runner.py --reindex` (links the analysis in manifest.json and PROGRESS.md).

7. Reply with 3–5 lines: result, biggest error, the chosen change.
