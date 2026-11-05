(function () {
  'use strict';

  var C = window.Cactpot;
  var App = window.CactpotApp;
  var STORE_KEY = 'cactpot_streak_log_v1';

  var memoryStore = null;
  function loadLog() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return blankLog();
      return normalizeLog(JSON.parse(raw));
    } catch (e) {
      if (memoryStore) return normalizeLog(memoryStore);
      return blankLog();
    }
  }

  function blankLog() {
    return { games: 0, optimal: 0, current: 0, best: 0, history: [] };
  }

  function normalizeLog(log) {
    var clean = blankLog();
    ['games', 'optimal', 'current', 'best'].forEach(function (k) {
      if (typeof log[k] === 'number' && isFinite(log[k])) clean[k] = Math.max(0, Math.floor(log[k]));
    });
    if (Array.isArray(log.history)) {
      clean.history = log.history.slice(0, 50).filter(function (h) {
        return h && typeof h === 'object';
      });
    }
    return clean;
  }

  function saveLog(log) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(log));
    } catch (e) {
      memoryStore = log;
    }
  }

  var drill = {
    phase: 'idle',
    full: null,
    revealed: [],
    picked: null,
    hintUsed: false
  };

  function shuffledDigits() {
    var pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool;
  }

  function drillGrid() {
    var grid = document.getElementById('drill-grid');
    var cells = grid.children;
    for (var i = 0; i < 9; i++) {
      var revealed = drill.full !== null && drill.revealed.indexOf(i) !== -1;
      var value = revealed || drill.phase === 'done' ? drill.full[i] : null;
      App.setCell(cells[i], value, revealed);
      cells[i].classList.remove('best');
      cells[i].disabled = drill.phase !== 'scratch' || revealed || drill.revealed.length >= 3;
    }
    if (drill.picked !== null) {
      C.LINES[drill.picked].cells.forEach(function (idx) {
        cells[idx].classList.add('best');
      });
    }
  }

  function getStatusMessage() {
    if (drill.phase === 'idle') return 'Press "New drill" to start a fresh ticket.';
    if (drill.phase === 'scratch') {
      var left = 3 - drill.revealed.length;
      return 'Scratched ' + drill.revealed.length + ' of 3. ' +
        (left > 0 ? left + ' scratch' + (left === 1 ? '' : 'es') + ' left, or pick a line below.' : 'No scratches left - pick a line below.');
    }
    return 'Drill complete. Press "New drill" for another ticket.';
  }

  function renderDrill() {
    document.getElementById('drill-status').textContent = getStatusMessage();
    document.getElementById('drill-hint').disabled = drill.phase !== 'scratch' || drill.hintUsed;
    document.querySelectorAll('#drill-lines button').forEach(function (btn) {
      var lineIndex = parseInt(btn.dataset.line, 10);
      btn.disabled = drill.phase !== 'scratch' || drill.revealed.length === 0;
      btn.setAttribute('aria-pressed', drill.picked === lineIndex ? 'true' : 'false');
    });
    drillGrid();
    renderDrillTable();
  }

  function renderDrillTable() {
    var table = document.getElementById('drill-table');
    if (drill.phase !== 'done') {
      table.hidden = true;
      return;
    }
    table.hidden = false;
    var rows = C.LINES.map(function (line) {
      return {
        line: line,
        sum: C.lineSum(drill.full, line),
        payout: C.linePayout(drill.full, line)
      };
    });
    rows.sort(function (a, b) { return b.payout - a.payout; });
    var best = rows[0].payout;
    var tbody = table.querySelector('tbody');
    tbody.textContent = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      if (row.payout === best) tr.className = 'best';
      if (drill.picked === row.line.index) tr.className += ' yours';
      var td1 = document.createElement('td');
      td1.textContent = row.line.label;
      var td2 = document.createElement('td');
      td2.textContent = String(row.sum);
      var td3 = document.createElement('td');
      td3.textContent = App.fmt(row.payout);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tbody.appendChild(tr);
    });
  }

  function startDrill() {
    drill.phase = 'scratch';
    drill.full = shuffledDigits();
    drill.revealed = [];
    drill.picked = null;
    drill.hintUsed = false;
    document.getElementById('drill-table').querySelector('tbody').textContent = '';
    renderDrill();
  }

  function onDrillCellClick(ev) {
    if (drill.phase !== 'scratch') return;
    var idx = parseInt(ev.currentTarget.dataset.index, 10);
    if (drill.revealed.indexOf(idx) !== -1 || drill.revealed.length >= 3) return;
    drill.revealed.push(idx);
    renderDrill();
  }

  function finishDrill() {
    var payouts = C.LINES.map(function (line) {
      return C.linePayout(drill.full, line);
    });
    var bestPayout = Math.max.apply(null, payouts);
    var playerPayout = payouts[drill.picked];
    var optimal = playerPayout === bestPayout;

    var log = loadLog();
    log.games++;
    if (optimal) {
      log.optimal++;
      log.current++;
    } else {
      log.current = 0;
    }
    if (log.current > log.best) log.best = log.current;
    log.history.unshift({
      ts: new Date().toISOString(),
      reveals: drill.revealed.length,
      payout: playerPayout,
      best: bestPayout,
      optimal: optimal,
      hint: drill.hintUsed
    });
    saveLog(log);
    renderStats(log);
    drill.phase = 'done';
    renderDrill();

    var status = document.getElementById('drill-status');
    status.innerHTML = 'You picked ' + C.LINES[drill.picked].label + ': ' + App.fmt(playerPayout) +
      ' MGP. Best line on the true ticket: ' + App.fmt(bestPayout) + ' MGP. ' +
      (optimal ? '<strong>Optimal!</strong>' : 'Missed the best line this time.');
  }

  function pickLine(ev) {
    if (drill.phase !== 'scratch' || drill.revealed.length === 0) return;
    drill.picked = parseInt(ev.currentTarget.dataset.line, 10);
    finishDrill();
  }

  function useHint() {
    if (drill.phase !== 'scratch' || drill.hintUsed) return;
    drill.hintUsed = true;
    var publicCells = drill.full.map(function (v, i) {
      return drill.revealed.indexOf(i) !== -1 ? v : null;
    });
    var sol = C.solveBoard(publicCells);
    var msg = 'Solver: best line right now is <strong>' + sol.best.label +
      '</strong> (~' + App.fmt(Math.round(sol.best.ev)) + ' MGP expected)';
    if (drill.revealed.length < 3) {
      var recs = C.recommendScratch(publicCells);
      if (recs.length) {
        var idx = recs[0].index;
        msg += '; best next scratch is square <strong>R' + (Math.floor(idx / 3) + 1) +
          'C' + (idx % 3 + 1) + '</strong>';
      }
    }
    document.getElementById('drill-status').innerHTML = msg + '.';
    document.getElementById('drill-hint').disabled = true;
  }

  function renderStats(log) {
    document.getElementById('streak-now').textContent = String(log.current);
    document.getElementById('streak-best').textContent = String(log.best);
    document.getElementById('streak-optimal').textContent = String(log.optimal);
    document.getElementById('streak-games').textContent = String(log.games);
    var rate = log.games > 0 ? Math.round(100 * log.optimal / log.games) + '%' : '0%';
    document.getElementById('streak-rate').textContent = rate;
    var tbody = document.querySelector('#streak-history tbody');
    tbody.textContent = '';
    log.history.slice(0, 10).forEach(function (h) {
      var tr = document.createElement('tr');
      var when = document.createElement('td');
      when.textContent = new Date(h.ts).toLocaleString();
      var reveals = document.createElement('td');
      reveals.textContent = String(h.reveals);
      var payout = document.createElement('td');
      payout.textContent = App.fmt(h.payout);
      var best = document.createElement('td');
      best.textContent = App.fmt(h.best);
      var result = document.createElement('td');
      result.textContent = h.optimal ? 'Optimal' : 'Missed by ' + App.fmt(h.best - h.payout);
      if (h.hint) result.textContent += ' (hint used)';
      tr.appendChild(when);
      tr.appendChild(reveals);
      tr.appendChild(payout);
      tr.appendChild(best);
      tr.appendChild(result);
      tbody.appendChild(tr);
    });
  }

  function resetStats() {
    if (!window.confirm('Reset the entire streak log? This cannot be undone.')) return;
    var log = blankLog();
    saveLog(log);
    renderStats(log);
  }

  function initLinePicker() {
    var picker = document.getElementById('drill-lines');
    picker.textContent = '';
    C.LINES.forEach(function (line) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.line = String(line.index);
      btn.textContent = line.label;
      btn.addEventListener('click', pickLine);
      picker.appendChild(btn);
    });
  }

  App.buildGrid(document.getElementById('drill-grid'), onDrillCellClick);
  initLinePicker();
  document.getElementById('drill-new').addEventListener('click', startDrill);
  document.getElementById('drill-hint').addEventListener('click', useHint);
  document.getElementById('streak-reset').addEventListener('click', resetStats);
  renderStats(loadLog());
  renderDrill();
})();
