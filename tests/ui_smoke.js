'use strict';

const assert = require('assert');

function classListFactory(el) {
  return {
    add: (...cs) => cs.forEach((c) => el._classes.add(c)),
    remove: (...cs) => cs.forEach((c) => el._classes.delete(c)),
    toggle: (c, force) => {
      const on = force === undefined ? !el._classes.has(c) : !!force;
      if (on) el._classes.add(c); else el._classes.delete(c);
      return on;
    },
    contains: (c) => el._classes.has(c)
  };
}

const bySelector = new Map();

function el(id) {
  const target = {
    _id: id || null,
    children: [],
    handlers: {},
    dataset: {},
    attrs: {},
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    _classes: new Set(),
    parentElement: null,
    _clearAll() { target.children = []; },
    appendChild(child) {
      child.parentElement = target;
      if (child._fragment) {
        child.children.forEach((c) => { c.parentElement = target; target.children.push(c); });
        child.children = [];
      } else {
        target.children.push(child);
      }
      return child;
    },
    addEventListener(type, fn) {
      (target.handlers[type] = target.handlers[type] || []).push(fn);
    },
    setAttribute(k, v) { target.attrs[k] = v; },
    getAttribute(k) { return target.attrs[k]; },
    querySelector(tagSel) {
      target._q = target._q || {};
      if (!target._q[tagSel]) {
        const child = el(tagSel);
        target.appendChild(child);
        target._q[tagSel] = child;
      }
      return target._q[tagSel];
    },
    fire(type) {
      (target.handlers[type] || []).forEach((fn) => fn({ currentTarget: target, preventDefault() {} }));
      return true;
    },
    get classList() { return classListFactory(target); }
  };
  Object.defineProperty(target, 'textContent', {
    get() { return target._text || ''; },
    set(v) {
      target._text = v === null || v === undefined ? '' : String(v);
      if (v === '') target._clearAll();
    }
  });
  return target;
}

const idRegistry = new Map();
function getElementById(id) {
  if (!idRegistry.has(id)) idRegistry.set(id, el(id));
  return idRegistry.get(id);
}

const document = {
  createElement: () => el(null),
  createDocumentFragment: () => Object.assign(el(null), { _fragment: true }),
  getElementById,
  addEventListener() {},
  activeElement: null,
  querySelector(sel) {
    if (!bySelector.has(sel)) bySelector.set(sel, el(sel));
    return bySelector.get(sel);
  },
  querySelectorAll(sel) {
    if (sel.startsWith('#drill-lines')) return getElementById('drill-lines').children;
    if (!bySelector.has(sel)) bySelector.set(sel, el(sel));
    return [];
  },
  confirm: () => true
};

global.window = { document, localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } } };
global.document = document;

window.Cactpot = require('../js/solver.js');
require('../js/app.js');
require('../js/drill.js');

const grid = getElementById('solver-grid');
assert.strictEqual(grid.children.length, 9, 'solver grid built');

grid.children[0].fire('click');
assert.strictEqual(grid.children[0].textContent, '1', 'cell cycles to 1');
grid.children[0].fire('click');
assert.strictEqual(grid.children[0].textContent, '2', 'cell cycles to 2');

document.activeElement = grid.children[1];
document.fire && document.fire('keydown');
const summaryBefore = getElementById('solver-summary').innerHTML;
assert.ok(getElementById('solver-error').hidden === true, 'no error showing');

getElementById('solver-sample').fire('click');
const summary = getElementById('solver-summary').innerHTML;
assert.ok(/Averaging over .* possible tickets/.test(summary), 'summary populated: ' + summary);
assert.ok(/Best line/.test(summary), 'best line shown');
const rows = bySelector.get('#solver-table tbody');
assert.ok(rows.children.length === 8, '8 EV rows');
assert.ok(/Best next scratch/.test(getElementById('solver-scratch').innerHTML), 'scratch hint');

getElementById('solver-clear').fire('click');
assert.ok(/All 9 squares unknown/.test(getElementById('solver-summary').textContent), 'clear resets');

const dgrid = getElementById('drill-grid');
const lines = getElementById('drill-lines');
assert.strictEqual(lines.children.length, 8, 'line picker built');

getElementById('drill-new').fire('click');
assert.strictEqual(dgrid.children[0].textContent, '?', 'drill starts hidden');
assert.ok(/Scratched 0 of 3/.test(getElementById('drill-status').textContent), 'status: ' + getElementById('drill-status').textContent);

dgrid.children[0].fire('click');
dgrid.children[1].fire('click');
dgrid.children[2].fire('click');
dgrid.children[3].fire('click');
assert.strictEqual(dgrid.children[3].textContent, '?', 'blocked after 3 scratches');
assert.ok(/Scratched 3 of 3/.test(getElementById('drill-status').textContent), 'status after 3');

lines.children[0].fire('click');
assert.ok(/MGP/.test(getElementById('drill-status').innerHTML), 'result shown: ' + getElementById('drill-status').innerHTML);
assert.strictEqual(getElementById('streak-games').textContent, '1', 'streak games logged');
assert.ok(/Drill complete/.test(getElementById('drill-status').textContent) || /picked/.test(getElementById('drill-status').textContent), 'completion status');

const dtable = getElementById('drill-table');
assert.strictEqual(dtable.hidden, false, 'result table visible');
assert.strictEqual(getElementById('drill-table').querySelector('tbody').children.length, 8, '8 payout rows');

getElementById('drill-hint').fire('click');
getElementById('drill-new').fire('click');
assert.strictEqual(dgrid.children[0].textContent, '?', 'new drill resets');

console.log('SMOKE OK - app.js + drill.js interact correctly with DOM');
