'use strict';

var assert = require('assert');
var C = require('../js/solver.js');

var failures = [];
var count = 0;

function test(name, fn) {
  count++;
  try {
    fn();
  } catch (e) {
    failures.push({ name: name, error: e });
  }
}

function close(actual, expected, msg) {
  assert.ok(Math.abs(actual - expected) < 1e-9, msg + ' expected ' + expected + ' got ' + actual);
}

test('paytable covers every legal line sum 6..24', function () {
  for (var s = 6; s <= 24; s++) {
    assert.ok(C.PAYOUT[s] > 0, 'missing payout for sum ' + s);
  }
  assert.strictEqual(Object.keys(C.PAYOUT).length, 19);
});

test('paytable spot values match FFXIV', function () {
  assert.strictEqual(C.PAYOUT[6], 10080);
  assert.strictEqual(C.PAYOUT[24], 10800);
  assert.strictEqual(C.PAYOUT[16], 180);
  assert.strictEqual(C.PAYOUT[19], 1620);
  assert.strictEqual(C.PAYOUT[20], 36);
  assert.strictEqual(C.PAYOUT[11], 108);
});

test('there are exactly 8 lines', function () {
  assert.strictEqual(C.LINES.length, 8);
});

test('line payouts tally for a fully revealed board', function () {
  var board = [9, 3, 8, 4, 2, 7, 5, 6, 1];
  assert.strictEqual(C.lineSum(board, C.LINES[0]), 20);
  assert.strictEqual(C.linePayout(board, C.LINES[0]), 36);
  assert.strictEqual(C.linePayout(board, C.LINES[3]), 720);
});

test('single hidden cell EV equals payout of the one possible outcome', function () {
  var cells = [9, 3, 8, 4, 2, null, 7, 6, 1];
  var pool = C.poolFor(cells);
  assert.deepStrictEqual(pool, [5]);
  var s = C.solveBoard(cells);
  assert.strictEqual(s.best.index, 7);
  close(s.best.ev, C.PAYOUT[17], 'diag2 EV: unique best 8+2+7=17');
  close(s.possibleBoards, 1, 'only 1 board');
});

test('independent one-hidden-cell EV check (center)', function () {
  var cells = [9, 3, 8, 4, null, 2, 7, 6, 5];
  var evs = {};
  C.LINES.forEach(function (line) {
    var total = 0;
    var n = 0;
    for (var v = 1; v <= 9; v++) {
      if (cells.indexOf(v) !== -1) continue;
      var b = cells.slice();
      b[4] = v;
      total += C.PAYOUT[C.lineSum(b, line)];
      n++;
    }
    evs[line.index] = total / n;
  });
  close(evs[6], C.PAYOUT[15], 'diag 1');
  close(evs[7], C.PAYOUT[16], 'diag 2');
  close(evs[3], C.PAYOUT[20], 'left col sums 9+4+7=20');
  var s = C.solveBoard(cells);
  close(s.lines.filter(function (r) { return r.index === 6; })[0].ev, evs[6], 'solver matches');
  close(s.lines.filter(function (r) { return r.index === 7; })[0].ev, evs[7], 'solver matches');
  close(s.best.ev, C.PAYOUT[15], 'best EV ties 1080');
  assert.ok(s.best.index === 5 || s.best.index === 6, 'best is col2 or diag, got ' + s.best.index);
});

test('two hidden cells: EV is plain mean over both assignments', function () {
  var cells = [9, null, 8, 4, 2, 7, 5, null, 6];
  var hidden = C.hiddenIndexes(cells);
  var pool = C.poolFor(cells);
  assert.deepStrictEqual(hidden, [1, 7]);
  assert.deepStrictEqual(pool, [1, 3]);
  var s = C.solveBoard(cells);
  assert.strictEqual(s.possibleBoards, 2);
  var handEvs = {};
  [1, 3].forEach(function (a) {
    [1, 3].forEach(function (b) {
      if (a === b) return;
      var board = [9, 0, 8, 4, 2, 7, 5, 0, 6];
      board[1] = a;
      board[7] = b;
      C.LINES.forEach(function (line) {
        handEvs[line.index] = (handEvs[line.index] || 0) + C.PAYOUT[C.lineSum(board, line)];
      });
    });
  });
  Object.keys(handEvs).forEach(function (k) {
    handEvs[k] /= 2;
  });
  C.LINES.forEach(function (line) {
    close(s.lines.filter(function (r) { return r.index === line.index; })[0].ev, handEvs[line.index], 'line ' + line.index);
  });
});

test('all-hidden board: every line has identical EV by symmetry', function () {
  var s = C.solveBoard([null, null, null, null, null, null, null, null, null]);
  assert.strictEqual(s.possibleBoards, 362880);
  for (var i = 1; i < s.lines.length; i++) {
    close(s.lines[i].ev, s.lines[0].ev, 'symmetry line ' + i);
  }
  close(s.lines[0].ev, 812.5714285714286, 'blind pick EV over 9! boards');
});

test('guaranteed jackpot line is recommended', function () {
  var cells = [7, 8, 9, 1, 2, 3, 4, 5, 6];
  var s = C.solveBoard(cells);
  assert.strictEqual(s.best.index, 0);
  close(s.best.ev, 10800, 'jackpot EV');
});

test('solver rejects duplicate revealed values', function () {
  assert.throws(function () { C.solveBoard([1, 1, null, null, null, null, null, null, null]); }, /Duplicate/);
});

test('solver rejects out-of-range values', function () {
  assert.throws(function () { C.solveBoard([0, 2, null, null, null, null, null, null, null]); }, /between 1 and 9/);
  assert.throws(function () { C.solveBoard([10, 2, null, null, null, null, null, null, null]); }, /between 1 and 9/);
});

test('solver rejects wrong-length and non-array input', function () {
  assert.throws(function () { C.solveBoard([1, 2, 3]); }, /9 cells/);
  assert.throws(function () { C.solveBoard('123456789'); }, /array/);
});

test('recommendScratch returns a hidden cell and offers real EV gain', function () {
  var cells = [9, null, 8, 4, 2, 7, 5, 6, null];
  var pool = C.poolFor(cells);
  var recs = C.recommendScratch(cells);
  assert.strictEqual(recs.length, 2);
  assert.ok(recs[0].index === 1 || recs[0].index === 8);
  assert.ok(recs[0].ev >= recs[1].ev - 1e-12);
  var revealed = cells.slice();
  revealed[recs[0].index] = pool[0];
  var after = C.solveBoard(revealed);
  assert.ok(after.best.ev > 0);
});

test('recommendScratch empty when full board', function () {
  assert.deepStrictEqual(C.recommendScratch([1, 2, 3, 4, 5, 6, 7, 8, 9]), []);
});

test('random 8-revealed boards: independent one-hidden EV recomputation agrees', function () {
  for (var t = 0; t < 25; t++) {
    var perm = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(function () { return Math.random() - 0.5; });
    var boardFull = perm.slice();
    var hiddenAt = Math.floor(Math.random() * 9);
    var cells = boardFull.slice();
    cells[hiddenAt] = null;
    var s = C.solveBoard(cells);
    C.LINES.forEach(function (line) {
      var got = s.lines.filter(function (r) { return r.index === line.index; })[0].ev;
      close(got, C.PAYOUT[C.lineSum(boardFull, line)], 'random board test t=' + t);
    });
  }
});

test('solveBoard on partially revealed (5) matches 4! enumeration', function () {
  var cells = [9, null, 8, null, 2, 7, null, 6, null];
  var pool = C.poolFor(cells);
  assert.strictEqual(pool.length, 4);
  var s = C.solveBoard(cells);
  assert.strictEqual(s.possibleBoards, 24);
  var handTotals = {};
  var perLine = {};
  C.permutations(pool, 4).forEach(function (combo) {
    var board = [9, combo[0], 8, combo[1], 2, 7, combo[2], 6, combo[3]];
    C.LINES.forEach(function (line) {
      handTotals[line.index] = (handTotals[line.index] || 0) + C.PAYOUT[C.lineSum(board, line)];
    });
  });
  C.LINES.forEach(function (line) {
    perLine[line.index] = handTotals[line.index] / 24;
    close(s.lines.filter(function (r) { return r.index === line.index; })[0].ev, perLine[line.index], 'line ' + line.index);
  });
});

test('renderBoard shows ? for hidden cells', function () {
  assert.strictEqual(C.renderBoard([9, null, 8, null, 2, 7, null, 6, null]), '9 ? 8\n? 2 7\n? 6 ?');
});

if (typeof module !== 'undefined' && require.main === module) {
  if (failures.length) {
    console.error(failures.length + '/' + count + ' test(s) FAILED');
    failures.forEach(function (f) {
      console.error('  FAIL: ' + f.name);
      console.error('    ' + (f.error && f.error.message ? f.error.message : f.error));
    });
    process.exit(1);
  }
  console.log(count + '/' + count + ' tests passed');
  process.exit(0);
}
