# Mini Cactpot Solver

A static, no-build webapp for FFXIV's Gold Saucer lottery: enter the numbers
you have scratched off on a Mini Cactpot ticket and get the
expected-value-best line to pick, plus the best next square to scratch.
Includes a practice drill mode with a local streak log, a plain-assert test
suite, and a Python verification harness.

Built and maintained by **Asdale Dynamics, LLC** as part of its collection of
beginner-friendly, local-first tools. Free and open under the MIT license.

## Quick start

No build step, no dependencies, no network. Two options:

- **Open the file directly:** double-click `index.html` (works from `file://`
  in Chrome, Edge, Firefox, and Safari).
- **Serve the folder** (optional, if your browser restricts `file://` storage):

  ```sh
  python3 -m http.server 8080
  # then visit http://localhost:8080
  ```

Everything runs in your browser. Nothing is uploaded; the only state is the
streak log in your browser's `localStorage`.

## Using the solver

1. Click squares to cycle them through `? -> 1 -> 2 -> ... -> 9 -> ?`.
   Enter each number you have already scratched off; leave the rest as `?`.
   (With a square focused you can also type digits 1-9; press `Backspace` or
   `Escape` to clear one.)
2. The expected value (EV) of every one of the 8 lines is recomputed instantly
   (see *The math* below). The best line gets a gold outline.
3. The "best next scratch" line tells you which hidden square to reveal next
   to keep your winning chances high.

Duplicates or typos are caught with an inline error, never silently.

## Practice drill

Practice tab: a fresh random ticket, all nine squares face-down. You scratch
up to three squares (just like the real game), then pick one of the 8 lines.
The app reveals the true ticket, shows every line's actual payout, and flags
your pick as *optimal* when it pays as much as the best line on the true
ticket. Consecutive optimal picks build your streak, logged in `localStorage`
with best streak and hit rate. Use the solver hint if you want a hint (hints
are labeled in the log and never counted against you).

## Scratch sirloin odds

The "sirloin" is the big-ticket cut: a 7-8-9 line (sum 24) worth **10,800
MGP**. Reference odds on a fair random ticket, brute-forced over all 362,880
arrangements of 1-9:

- One blind line hits the sirloin **1 time in 84** (about 1.2%).
- Some line on the ticket hits it **9.52%** of the time.
- The other premium payouts (10,080 MGP from {1,2,3} or {6,8,9}) land on a
  blind line at 1-in-84 each.
- About **27.1%** of tickets contain a premium line; on those the EV-best line
  averages about 3,665 MGP versus about 813 MGP for a blind row. That gap is
  what this tool helps you claim.
- Smaller cuts: 1,080 lines (sum 15) appear on 53.5% of tickets and 1,620
  lines (sum 19) on 37.9%. The stinker is a sum-20 row paying just 36 MGP.

Full pay table (payout in MGP for the selected line's digit sum):

| Sum | Ways per blind row (of 84) | Chance | MGP |
|-----|---------------------------|------------------|------|
| 6   | 1 ({1,2,3})               | 1.2%             | 10,080 |
| 7   | 1 ({1,2,4})               | 1.2%             | 360 |
| 8   | 2                         | 2.4%             | 720 |
| 9   | 3                         | 3.6%             | 360 |
| 10  | 4                         | 4.8%             | 252 |
| 11  | 5                         | 6.0%             | 108 |
| 12  | 7                         | 8.3%             | 72 |
| 13  | 7                         | 8.3%             | 360 |
| 14  | 8                         | 9.5%             | 180 |
| 15  | 8                         | 9.5%             | 1,080 |
| 16  | 8                         | 9.5%             | 180 |
| 17  | 7                         | 8.3%             | 360 |
| 18  | 7                         | 8.3%             | 720 |
| 19  | 5                         | 6.0%             | 1,620 |
| 20  | 4                         | 4.8%             | 36 |
| 21  | 3                         | 3.6%             | 360 |
| 22  | 2                         | 2.4%             | 720 |
| 23  | 1 ({6,8,9})               | 1.2%             | 10,080 |
| 24  | 1 ({7,8,9})               | 1.2%             | 10,800 |

## The math

A Mini Cactpot ticket is a random shuffle of the digits 1-9 across a 3x3
grid. You scratch squares and finally select one of the 8 straight lines
(3 rows, 3 columns, 2 diagonals); the payout depends only on the sum of that
line.

Given what you have revealed, every completion of the ticket is treated as
equally likely (fair tickets). For each line the solver:

1. enumerates all consistent completions of the hidden squares,
2. sums the line's payout over all completions,
3. divides by the completion count.

That average is the line's expected value; the recommendation is simply the
highest EV line. "Best next scratch" scores each hidden square by the average
best-line EV after revealing it, and picks the maximum.

## Running the tests

Requires Node.js 18+ (used only as a test runner; the app itself is static).

```sh
# plain-assert test suite (no frameworks)
node tests/tests.js

# browserless UI smoke test: runs the real app.js + drill.js against a
# tiny DOM shim and exercises solver input, drill flow, and streak log
node tests/ui_smoke.js

# full verification harness: JS suite + syntax checks + UI smoke +
# independent Python re-implementation cross-checked against the JS
# solver over random boards
python3 tools/harness.py
```

Both exit non-zero on any failure and print a plain-language summary.

## Files

```
index.html         page shell (solver tab, drill tab, odds note)
css/style.css      styles
js/solver.js       pure logic module (game math, no DOM)
js/app.js          solver tab UI
js/drill.js        practice drill UI + streak log
tests/tests.js     plain assert tests for the solver math
tests/ui_smoke.js  browserless DOM smoke test for the UI code
tools/harness.py   Python verification harness
LICENSE            MIT (Copyright (c) 2026 Asdale Dynamics, LLC)
STATUS.md          build/verification status notes
```

## Credits & license

Built by **Asdale Dynamics, LLC** - practical, local-first tools explained
like a friend would. Released under the MIT license; see `LICENSE`.

FFXIV and Mini Cactpot are registered trademarks or trademarks of Square Enix
Holdings Co., Ltd. This is a fan-made calculator; it is not affiliated with
or endorsed by Square Enix.
