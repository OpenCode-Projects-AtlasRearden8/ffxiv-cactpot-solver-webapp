(function () {
  'use strict';

  var C = window.Cactpot;
  var solverBoard = [null, null, null, null, null, null, null, null, null];
  var fmt = function (n) { return n.toLocaleString('en-US'); };

  function gridCells(gridEl) {
    return gridEl.children;
  }

  function buildGrid(gridEl, onCellClick) {
    gridEl.textContent = '';
    for (var i = 0; i < 9; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.dataset.index = String(i);
      btn.addEventListener('click', onCellClick);
      gridEl.appendChild(btn);
    }
  }

  function setCell(btn, value, revealed) {
    btn.textContent = value === null ? '?' : String(value);
    btn.classList.toggle('revealed', revealed && value !== null);
  }

  function cycleCell(index) {
    var v = solverBoard[index];
    var next = v === null ? 1 : v + 1;
    if (next > 9) next = null;
    solverBoard[index] = next;
    updateSolver();
  }

  function onSolverCellClick(ev) {
    var idx = parseInt(ev.currentTarget.dataset.index, 10);
    cycleCell(idx);
  }

  function updateSolver() {
    var grid = document.getElementById('solver-grid');
    var cells = gridCells(grid);
    var errorEl = document.getElementById('solver-error');
    var summaryEl = document.getElementById('solver-summary');
    var tbody = document.querySelector('#solver-table tbody');
    var scratchEl = document.getElementById('solver-scratch');

    var revealedCount = 0;
    for (var i = 0; i < 9; i++) {
      if (solverBoard[i] !== null) revealedCount++;
    }

    Array.prototype.forEach.call(cells, function (btn) {
      var idx = parseInt(btn.dataset.index, 10);
      setCell(btn, solverBoard[idx], true);
      btn.classList.remove('best');
    });

    tbody.textContent = '';
    scratchEl.textContent = '';
    errorEl.hidden = true;
    summaryEl.textContent = revealedCount + ' of 9 revealed. Click squares to cycle values.';

    if (revealedCount === 0) {
      summaryEl.textContent = 'All 9 squares unknown. Click squares to enter scratched numbers.';
      return;
    }

    var sol;
    try {
      sol = C.solveBoard(solverBoard);
    } catch (e) {
      errorEl.textContent = e.message + ' - fix the ticket below.';
      errorEl.hidden = false;
      return;
    }

    var bestCells = new Set(sol.best.cells);
    Array.prototype.forEach.call(cells, function (btn) {
      var idx = parseInt(btn.dataset.index, 10);
      if (bestCells.has(idx)) btn.classList.add('best');
    });

    summaryEl.innerHTML =
      'Averaging over ' + fmt(sol.possibleBoards) + ' possible ticket' +
      (sol.possibleBoards === 1 ? '' : 's') +
      '. Best line: <strong>' + sol.best.label + '</strong> at <strong>' +
      fmt(Math.round(sol.best.ev)) + ' MGP</strong> expected.';

    var frag = document.createDocumentFragment();
    sol.lines.forEach(function (line, rank) {
      var tr = document.createElement('tr');
      if (rank === 0) tr.className = 'best';
      var td1 = document.createElement('td');
      td1.textContent = line.label;
      var td2 = document.createElement('td');
      td2.textContent = fmt(Math.round(line.ev * 100) / 100);
      tr.appendChild(td1);
      tr.appendChild(td2);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);

    if (sol.hidden === 0) {
      scratchEl.textContent = 'Whole ticket revealed - the table shows actual payouts.';
    } else if (sol.hidden <= 8) {
      var recs = C.recommendScratch(solverBoard);
      var top = recs[0];
      var r = Math.floor(top.index / 3) + 1;
      var c = top.index % 3 + 1;
      scratchEl.innerHTML = 'Best next scratch: square <strong>R' + r + 'C' + c + '</strong>' +
        ' (results in an average best line of <strong>' + fmt(Math.round(top.ev)) + ' MGP</strong>).';
    } else {
      scratchEl.textContent = 'Nothing revealed yet - by symmetry every square is equal; scratch any of them.';
    }
  }

  function switchTab(name) {
    document.getElementById('solver-view').hidden = name !== 'solver';
    document.getElementById('drill-view').hidden = name !== 'drill';
    document.getElementById('tab-solver').className = 'tab' + (name === 'solver' ? ' active' : '');
    document.getElementById('tab-drill').className = 'tab' + (name === 'drill' ? ' active' : '');
  }

  document.getElementById('tab-solver').addEventListener('click', function () { switchTab('solver'); });
  document.getElementById('tab-drill').addEventListener('click', function () { switchTab('drill'); });

  document.getElementById('solver-clear').addEventListener('click', function () {
    solverBoard = [null, null, null, null, null, null, null, null, null];
    updateSolver();
  });

  document.getElementById('solver-sample').addEventListener('click', function () {
    solverBoard = [9, null, 8, 4, 2, 7, 5, null, 6];
    updateSolver();
  });

  document.addEventListener('keydown', function (ev) {
    var active = document.activeElement;
    if (!active || !active.classList || !active.classList.contains('cell')) return;
    if (active.parentElement.id !== 'solver-grid') return;
    var idx = parseInt(active.dataset.index, 10);
    var d = parseInt(ev.key, 10);
    if (ev.key >= '1' && ev.key <= '9') {
      solverBoard[idx] = d;
      updateSolver();
      ev.preventDefault();
    } else if (ev.key === '0' || ev.key === 'Backspace' || ev.key === 'Escape') {
      solverBoard[idx] = null;
      updateSolver();
      ev.preventDefault();
    }
  });

  buildGrid(document.getElementById('solver-grid'), onSolverCellClick);
  updateSolver();

  window.CactpotApp = {
    fmt: fmt,
    buildGrid: buildGrid,
    setCell: setCell
  };
})();
