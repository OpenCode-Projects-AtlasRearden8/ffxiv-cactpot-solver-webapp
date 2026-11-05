# STATUS - Mini Cactpot Solver

Built 2026-11-05 by Asdale Dynamics, LLC.

## What was built

A static, no-build webapp for FFXIV Mini Cactpot, entirely client-side:

- **Solver tab:** enter a partially revealed 3x3 ticket (click squares to
  cycle `? -> 1..9 -> ?`, or type digits with a square focused). The app
  computes the expected-value (EV) of all 8 lines over every consistent
  completion of the ticket, highlights the best line inline, and recommends
  the single best square to scratch next (EV-maximizing "next scratch").
  Duplicates and invalid input are caught with inline errors, never silently.
- **Practice drill tab:** fresh random ticket, all face-down. Scratch up to
  3 squares, pick one of the 8 lines; the true ticket is revealed with every
  line's actual payout, and picks that pay the ticket maximum count as
  *optimal*. Streak, best streak, and hit rate are persisted to
  `localStorage` (key `cactpot_streak_log_v1`), with an in-memory fallback
  and a reset button. Full history (last 10 shown, 50 kept).
- **Scratch sirloin odds note:** brute-force reference odds on a fair
  random ticket (sirloin = 7-8-9 line, 10,800 MGP): 1/84 per blind line,
  9.52% that some line hits it, 27.1% of tickets contain a premium line,
  ~3,665 MGP average best-line payout vs ~813 MGP blind pick, and the full
  pay table with ways-per-blind-row.
- **Logic module** (`js/solver.js`) is DOM-free and testable directly;
  the UI (`js/app.js`, `js/drill.js`) is browser-global script tags, no
  build step, no external assets, works offline and over `file://`.

## How to run it

- Open `index.html` in any modern browser (double-click works, `file://` OK).
- Or serve: `python3 -m http.server 8080` then visit http://localhost:8080.
- No install, no network access, no accounts, no cookies beyond localStorage.

## Verification results (all passing)

Run with Node 20.19.2 / Python 3.13.5:

```
node tests/tests.js          -> 17/17 tests passed
node tests/ui_smoke.js       -> SMOKE OK (real app+drill code on a DOM shim)
python3 tools/harness.py     -> ALL CHECKS PASSED
```

Harness contents (exits non-zero on any failure):

- plain-assert Node test suite: paytable coverage and spot values, 8 lines,
  line sum/payout checks, hand-computed single- and two-hidden-cell EVs,
  all-hidden symmetry (EV 812.5714285714 over all 362,880 boards),
  guaranteed-jackpot recommendation, duplicate/range/shape input rejection,
  scratch-recommender behavior, 25 random 8-revealed boards against an
  independent recomputation, and a 4-hidden enumeration case.
- browserless UI smoke test: real `app.js` + `drill.js` run against a minimal
  DOM shim; covers cell cycling, example load, EV table population, duplicate
  errors, drill reveal limits (max 3), line picking, payout table, streak
  logging, and reset.
- Python harness: `node --check` syntax gate on all 4 JS files; an
  independent Python reimplementation of the EV math cross-checked against
  the JS solver over **300 seeded random boards (1-3 hidden cells)** with
  1e-9 tolerance, plus scratch-recommendation agreement over 40 boards, plus
  a hand case.
- HTTP smoke: all 5 assets served with status 200 via `python3 -m http.server`.

Fixed during verification: duplicate-value detection bug (first index stored
falsy), harness EV ordering mismatch (JS output is sorted; compare sorted),
and several initially wrong hand-computed expectations (caught by the
independent cross-check, which is exactly what it is for).

## Known gaps

- No autocomplete for legal digit pools; you can enter duplicates or use a
  digit already impossible (e.g. re-entering a scratched number a second
  time in a wrong square), which the solver flags as an error rather than
  guessing intent.
- "Optimal" drill scoring is ex-post (your pick paid the true ticket's
  maximum). A luck stage-discounted metric could be added.
- All-hidden boards are handled but the next-scratch hint is skipped there
  (every square is symmetric; tells you so instead).
- No mobile-specific layout testing beyond reasonable viewport CSS.
- No visual regression or real-browser automation; the smoke test uses a
  minimal DOM shim, not a browser engine.
- Trademark note: FFXIV/Mini Cactpot are Square Enix trademarks; unaffiliated
  fan tool (noted in README).
