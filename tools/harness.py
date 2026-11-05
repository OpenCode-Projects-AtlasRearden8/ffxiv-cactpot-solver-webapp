#!/usr/bin/env python3
"""Verification harness for the Mini Cactpot solver.

1. Runs the plain-assert Node test suite (tests/tests.js).
2. Re-implements the expected-value math independently in Python and
   cross-checks the JavaScript solver over a batch of random boards.
3. Sanity-checks each JS source file parses (node --check).

Exits 0 only when everything passes. No third-party dependencies.
"""

import itertools
import json
import math
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PAYOUT = {
    6: 10080, 7: 360, 8: 720, 9: 360, 10: 252,
    11: 108, 12: 72, 13: 360, 14: 180, 15: 1080,
    16: 180, 17: 360, 18: 720, 19: 1620, 20: 36,
    21: 360, 22: 720, 23: 10080, 24: 10800,
}

LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]

failures = []


def check(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}" + (f" - {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


def run_cmd(args, cwd=ROOT, input_text=None):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True,
                          input=input_text, timeout=120)


# --- independent Python model of the game -----------------------------------

def py_pool(cells):
    return [v for v in range(1, 10) if v not in cells]


def py_evs(cells):
    pool = py_pool(cells)
    hidden = [i for i, v in enumerate(cells) if v is None]
    totals = [0] * len(LINES)
    n = 0
    for combo in itertools.permutations(pool, len(hidden)):
        board = list(cells)
        for h, v in zip(hidden, combo):
            board[h] = v
        for li, (a, b, c) in enumerate(LINES):
            totals[li] += PAYOUT[board[a] + board[b] + board[c]]
        n += 1
    return n, [t / n for t in totals]


def py_best_scratch(cells):
    pool = py_pool(cells)
    hidden = [i for i, v in enumerate(cells) if v is None]
    result = {}
    for h in hidden:
        total = 0.0
        for v in pool:
            test = list(cells)
            test[h] = v
            total += max(py_evs(test)[1])
        result[h] = total / len(pool)
    return result


# --- steps ----------------------------------------------------------------

def step_tests():
    if run_cmd(["node", "--version"]).returncode != 0:
        check("node is available", False, "node not found on PATH")
        return False
    proc = run_cmd(["node", "tests/tests.js"])
    out = proc.stdout.strip() or proc.stderr.strip()
    check("tests/tests.js (plain assert suite)", proc.returncode == 0, out)
    return proc.returncode == 0


def step_syntax():
    for rel in ["js/solver.js", "js/app.js", "js/drill.js", "tests/tests.js"]:
        check(f"syntax check {rel}", run_cmd(["node", "--check", rel]).returncode == 0)


def step_cross_check(count=300):
    js_batch = r"""
const C = require('./js/solver.js');
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => raw += d);
process.stdin.on('end', () => {
  const boards = JSON.parse(raw);
  const out = boards.map((cells) => {
    const s = C.solveBoard(cells);
    const recs = C.recommendScratch(cells);
    return { evs: s.lines.map((l) => l.ev),
             scratch: recs.map((r) => [r.index, r.ev]) };
  });
  process.stdout.write(JSON.stringify(out));
});
"""
    rng = random.Random(20260114)
    boards = []
    for _ in range(count):
        perm = list(range(1, 10))
        rng.shuffle(perm)
        revealed_n = rng.choice([6, 7, 8])
        hidden_positions = rng.sample(range(9), 9 - revealed_n)
        cells = [perm[i] if i not in hidden_positions else None for i in range(9)]
        boards.append(cells)

    proc = run_cmd(["node", "-e", js_batch], input_text=json.dumps(boards))
    check("js batch solver run", proc.returncode == 0, proc.stderr)
    if proc.returncode != 0:
        return
    js_out = json.loads(proc.stdout)

    for i, cells in enumerate(boards):
        n, evs = py_evs(cells)
        js_evs = js_out[i]["evs"]
        py_sorted = sorted(evs, reverse=True)
        ok = len(evs) == len(js_evs) and all(
            abs(a - b) < 1e-9 for a, b in zip(py_sorted, js_evs))
        if not ok:
            board_str = ",".join("?" if v is None else str(v) for v in cells)
            check(f"board {i} EV agreement ({board_str})", False,
                  f"python={py_sorted} js={js_evs}")
    check(f"EV agreement over {count} random boards", not any(f.startswith("board ") for f in failures))

    subset = boards[:40]
    proc2 = run_cmd(["node", "-e", js_batch], input_text=json.dumps(subset))
    js_out2 = json.loads(proc2.stdout)
    for i, cells in enumerate(subset):
        expected = py_best_scratch(cells)
        got = {idx: ev for idx, ev in js_out2[i]["scratch"]}
        ok = set(expected) == set(got) and all(
            abs(expected[k] - got[k]) < 1e-9 for k in expected)
        if not ok:
            check(f"board {i} scratch recommendation ({cells})", False,
                  f"python={expected} js={got}")
    check("scratch recommendation agreement over 40 random boards",
          not any("scratch recommendation" in f for f in failures))


def step_known_values():
    cells = [9, 3, 8, 4, None, 2, 7, 6, 1]
    _, evs = py_evs(cells)
    check("hand case: center 5 gives diag1 (9+5+1=15) unique best",
          evs[6] == PAYOUT[15] and evs[6] == max(evs))


def step_ui_smoke():
    proc = run_cmd(["node", "tests/ui_smoke.js"])
    out = proc.stdout.strip() or proc.stderr.strip()
    check("tests/ui_smoke.js (browserless DOM smoke test)", proc.returncode == 0, out)


def main():
    print("Mini Cactpot solver verification harness")
    print("=" * 46)
    if step_tests():
        step_syntax()
        step_known_values()
        step_ui_smoke()
        step_cross_check()
    print("-" * 46)
    if failures:
        print(f"FAILED ({len(failures)}): {', '.join(failures)}")
        sys.exit(1)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
