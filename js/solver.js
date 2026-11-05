(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Cactpot = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LINES = [
    { index: 0, cells: [0, 1, 2], label: 'Top row' },
    { index: 1, cells: [3, 4, 5], label: 'Middle row' },
    { index: 2, cells: [6, 7, 8], label: 'Bottom row' },
    { index: 3, cells: [0, 3, 6], label: 'Left column' },
    { index: 4, cells: [1, 4, 7], label: 'Middle column' },
    { index: 5, cells: [2, 5, 8], label: 'Right column' },
    { index: 6, cells: [0, 4, 8], label: 'Down-right diagonal' },
    { index: 7, cells: [2, 4, 6], label: 'Down-left diagonal' }
  ];

  var PAYOUT = {
    6: 10080, 7: 360, 8: 720, 9: 360, 10: 252,
    11: 108, 12: 72, 13: 360, 14: 180, 15: 1080,
    16: 180, 17: 360, 18: 720, 19: 1620, 20: 36,
    21: 360, 22: 720, 23: 10080, 24: 10800
  };

  function permutations(arr, k) {
    var results = [];
    var used = new Array(arr.length).fill(false);
    var current = [];
    function walk() {
      if (current.length === k) {
        results.push(current.slice());
        return;
      }
      for (var i = 0; i < arr.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        current.push(arr[i]);
        walk();
        current.pop();
        used[i] = false;
      }
    }
    walk();
    return results;
  }

  function validateBoard(cells) {
    if (!Array.isArray(cells) || cells.length !== 9) {
      throw new Error('Board must be an array of 9 cells');
    }
    var seen = {};
    var revealed = 0;
    for (var i = 0; i < 9; i++) {
      var v = cells[i];
      if (v === null || v === undefined || v === '') continue;
      if (typeof v !== 'number' || !isFinite(v) || v !== Math.floor(v)) {
        throw new Error('Cell ' + i + ' must be an integer or null');
      }
      if (v < 1 || v > 9) {
        throw new Error('Cell ' + i + ' must be between 1 and 9');
      }
      if (seen[v]) {
        throw new Error('Duplicate value ' + v + ' at cells ' + seen[v].index + ' and ' + i);
      }
      seen[v] = { index: i };
      revealed++;
    }
    return revealed;
  }

  function poolFor(cells) {
    var pool = [];
    for (var v = 1; v <= 9; v++) {
      if (cells.indexOf(v) === -1) pool.push(v);
    }
    return pool;
  }

  function hiddenIndexes(cells) {
    var idx = [];
    for (var i = 0; i < 9; i++) {
      if (cells[i] === null || cells[i] === undefined || cells[i] === '') idx.push(i);
    }
    return idx;
  }

  function lineAssignments(cells) {
    var revealed = validateBoard(cells);
    var pool = poolFor(cells);
    var hidden = hiddenIndexes(cells);
    var nHidden = hidden.length;
    if (nHidden !== pool.length) {
      throw new Error('Pool/hidden mismatch');
    }
    var perms = permutations(pool, nHidden);
    var boards = [];
    for (var p = 0; p < perms.length; p++) {
      var board = cells.slice();
      for (var h = 0; h < nHidden; h++) {
        board[hidden[h]] = perms[p][h];
      }
      boards.push(board);
    }
    return boards;
  }

  function lineSum(board, line) {
    return board[line.cells[0]] + board[line.cells[1]] + board[line.cells[2]];
  }

  function linePayout(board, line) {
    return PAYOUT[lineSum(board, line)];
  }

  function solveBoard(cells) {
    var revealed = validateBoard(cells);
    var boards = lineAssignments(cells);
    var n = boards.length;
    var evs = [];
    for (var li = 0; li < LINES.length; li++) {
      var total = 0;
      for (var b = 0; b < n; b++) {
        total += linePayout(boards[b], LINES[li]);
      }
      evs.push(total / n);
    }
    var results = LINES.map(function (line, i) {
      return {
        index: line.index,
        label: line.label,
        cells: line.cells.slice(),
        ev: evs[i]
      };
    });
    results.sort(function (a, b) { return b.ev - a.ev; });
    return {
      revealed: revealed,
      hidden: hiddenIndexes(cells).length,
      possibleBoards: n,
      lines: results,
      best: results[0]
    };
  }

  function recommendScratch(cells) {
    validateBoard(cells);
    var pool = poolFor(cells);
    var hidden = hiddenIndexes(cells);
    var n = pool.length;
    if (hidden.length === 0 || n === 0) return [];
    var recs = [];
    for (var h = 0; h < hidden.length; h++) {
      var idx = hidden[h];
      var total = 0;
      for (var p = 0; p < n; p++) {
        var test = cells.slice();
        test[idx] = pool[p];
        total += solveBoard(test).best.ev;
      }
      recs.push({ index: idx, ev: total / n });
    }
    recs.sort(function (a, b) { return b.ev - a.ev; });
    return recs;
  }

  function renderBoard(cells) {
    var out = '';
    for (var r = 0; r < 3; r++) {
      var row = [];
      for (var c = 0; c < 3; c++) {
        var v = cells[r * 3 + c];
        row.push(v === null || v === undefined || v === '' ? '?' : String(v));
      }
      out += row.join(' ');
      if (r < 2) out += '\n';
    }
    return out;
  }

  return {
    LINES: LINES,
    PAYOUT: PAYOUT,
    solveBoard: solveBoard,
    recommendScratch: recommendScratch,
    lineAssignments: lineAssignments,
    lineSum: lineSum,
    linePayout: linePayout,
    poolFor: poolFor,
    hiddenIndexes: hiddenIndexes,
    validateBoard: validateBoard,
    permutations: permutations,
    renderBoard: renderBoard
  };
}));
