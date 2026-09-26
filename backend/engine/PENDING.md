# Paused by the user: resume from here

State when paused:
- Engine is v0.1.7 (built, selfplay 44% vs v0.1.6, timecheck max 4829 ms). `baseline/chezz.exe` is v0.1.6.
- Highest win: Elo 2700 (game 0007). Next rung: 2900.
- Game 0008 (Elo 2900) was stopped at ply 21 on purpose and never saved; nothing to clean up.

To do on resume, in order:
1. Game 0007 still needs its `.analysis.md`. The objective report is from `python backend/analyze.py
   games/0007_elo-2700_win.json`. Shogun Sensei already reported: the rook-on-7th bonus worked (29.Rd7); only
   imprecision was ply 69, mate in 7 chosen over mate in 4 in a won position. Re-run engine-smith (it was
   stopped before finishing) and write the analysis file with a Decision.
2. Continue the ladder with /ladder-cycle at Elo 2900.
3. Delete this file.
