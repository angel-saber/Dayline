import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setupYearly } from '../../dist/js/features/yearly/view.js';
import {
  writeYearly,
  yearRecords,
  planNextStep,
  carryIntentions,
} from '../../dist/js/features/yearly/model.js';
import { validState } from '../../dist/js/shared/storage.js';

function harness(month = 9) {
  const keys = ['window', 'document', 'localStorage', 'CSS'];
  const before = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const { window } = parseHTML('<html><body><section id="yearly"></section></body></html>');
  const { document, HTMLElement, HTMLSelectElement } = window;
  Object.defineProperty(HTMLElement.prototype, 'open', {
    configurable: true,
    get() {
      return this.hasAttribute('open');
    },
    set(value) {
      this.toggleAttribute('open', value);
    },
  });
  HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  HTMLElement.prototype.reportValidity = () => true;
  HTMLElement.prototype.scrollIntoView = function () {};
  Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return (
        this.querySelector('option[selected]')?.value || this.querySelector('option')?.value || ''
      );
    },
    set(value) {
      for (const option of this.querySelectorAll('option'))
        option.toggleAttribute('selected', option.value === String(value));
    },
  });
  const stored = new Map();
  for (const [key, value] of Object.entries({
    window,
    document,
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    CSS: { escape: (value) => value },
  }))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  let state = { version: 1, days: {}, settings: { interval: 60 } },
    seq = 0,
    fail = false;
  const opened = [],
    compass = [],
    messages = [];
  const save = (days) => {
    if (fail) return false;
    state = validState({ ...state, days });
    window.dispatchEvent(new window.Event('dayline:notes-changed'));
    return true;
  };
  const view = setupYearly({
    root: document.querySelector('#yearly'),
    getState: () => state,
    now: () => new Date(2026, month, 15),
    saveRecord: (record) => save(writeYearly(state.days, record, () => `id-${++seq}`).days),
    planStep: (record, draft) =>
      save(planNextStep(state.days, record, draft, () => `id-${++seq}`).days),
    carry: (year, ids) => save(carryIntentions(state.days, year, ids, () => `id-${++seq}`)),
    openNote: (...args) => opened.push(args),
    openCompass: (source) => compass.push(source),
    toast: (message) => messages.push(message),
  });
  const root = document.querySelector('#yearly'),
    dialog = document.querySelector('dialog');
  const click = (label, within = root) => {
    const b = [...within.querySelectorAll('button')].find((item) => item.textContent === label);
    assert.ok(b, `Button ${label}`);
    b.click();
  };
  const input = (label) => {
    const result = [...dialog.querySelectorAll('input,textarea,select')].find(
      (item) => item.getAttribute('aria-label') === label,
    );
    assert.ok(result, label);
    return result;
  };
  const submit = () =>
    dialog.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  return {
    window,
    document,
    root,
    dialog,
    view,
    click,
    input,
    submit,
    opened,
    compass,
    messages,
    get state() {
      return state;
    },
    set days(value) {
      state = { ...state, days: value };
    },
    set fail(value) {
      fail = value;
    },
    restore() {
      for (const [key, descriptor] of before) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

test('Yearly welcomes users at different times with only the current quarter expanded', () => {
  for (const month of [0, 4, 9, 11]) {
    const h = harness(month);
    try {
      h.view.show();
      const quarters = [...h.root.querySelectorAll('.yearly-quarter[data-quarter]')];
      assert.equal(quarters.length, 4);
      assert.equal(quarters.filter((item) => item.open).length, 1);
      assert.equal(
        quarters.find((item) => item.open).dataset.quarter,
        String(Math.floor(month / 3) + 1),
      );
      assert.match(h.root.textContent, /No backfilling needed/);
      assert.equal(
        h.root.querySelector('progress').getAttribute('aria-label'),
        'Time elapsed in 2026; not a measure of accomplishment',
      );
      h.click('→');
      assert.equal(h.root.querySelector('h1').textContent, '2027');
      assert.equal(
        [...h.root.querySelectorAll('[data-quarter]')].some((item) => item.open),
        false,
      );
    } finally {
      h.restore();
    }
  }
});

test('Yearly creates, reshapes, moves, releases and restores intentions without interrupting typing', () => {
  const h = harness();
  try {
    h.view.show();
    h.click('Add an intention');
    h.input('Intention').value = 'Paint';
    h.input('Supporting notes (optional)').value = 'Try an imperfect study';
    const form = h.dialog.querySelector('form');
    h.window.dispatchEvent(new h.window.Event('dayline:notes-changed'));
    assert.equal(h.dialog.querySelector('form'), form);
    h.submit();
    assert.equal(h.dialog.open, false);
    assert.equal(yearRecords(h.state.days, 2026).length, 1);
    h.click('Reshape');
    h.input('Intention').value = 'A smaller study';
    h.submit();
    assert.equal(yearRecords(h.state.days, 2026)[0].title, 'A smaller study');
    h.click('Move');
    h.input('Quarter').value = '3';
    h.submit();
    assert.equal(yearRecords(h.state.days, 2026)[0].yearly.quarter, 3);
    h.click('Release');
    assert.equal(yearRecords(h.state.days, 2026)[0].yearly.status, 'released');
    assert.ok(h.root.querySelector('.yearly-aside'));
    h.click('Continue');
    assert.equal(yearRecords(h.state.days, 2026)[0].yearly.status, 'active');
  } finally {
    h.restore();
  }
});

test('direction versions, linked next steps, Compass context and reviewed carry-forward are usable', () => {
  const h = harness();
  try {
    h.view.show();
    h.click('Add a direction');
    h.input('What would you like to make room for this year?').value = 'Explore';
    h.submit();
    h.click('Revise direction');
    h.input('What would you like to make room for this year?').value = 'Make space for art';
    h.submit();
    assert.equal(
      yearRecords(h.state.days, 2026).find((n) => n.yearly.kind === 'direction').yearly.history[0]
        .text,
      'Explore',
    );
    h.click('Add an intention');
    h.input('Intention').value = 'Paint';
    h.submit();
    h.click('Continue / plan a next step');
    h.input('Next-step title').value = 'Pick colors';
    h.submit();
    assert.equal(h.state.days['2026-10-11'][0].weekly, true);
    assert.ok(h.root.querySelector('.yearly-linked'));
    h.click('Week of 2026-10-11 · Pick colors');
    assert.equal(h.opened.length, 1);
    h.click('Continue / plan a next step');
    h.click('Open Monthly Compass instead', h.dialog);
    assert.equal(h.compass[0].title, 'Paint');
    h.click('Bring selected intentions into next year');
    h.submit();
    assert.match(h.dialog.querySelector('[role="alert"]').textContent, /Select at least one/);
    const checkbox = h.dialog.querySelector('input[type="checkbox"]');
    assert.notEqual(checkbox.checked, true);
    checkbox.checked = true;
    h.submit();
    assert.equal(yearRecords(h.state.days, 2027).length, 1);
    assert.equal(yearRecords(h.state.days, 2026).length, 2);
  } finally {
    h.restore();
  }
});

test('failed writes keep drafts open and remote edits cannot be silently overwritten', () => {
  const h = harness();
  try {
    h.view.show();
    h.click('Add an intention');
    h.input('Intention').value = 'Keep my draft';
    h.fail = true;
    h.submit();
    assert.equal(h.dialog.open, true);
    assert.equal(h.input('Intention').value, 'Keep my draft');
    assert.equal(yearRecords(h.state.days, 2026).length, 0);
    h.fail = false;
    h.submit();
    h.click('Reshape');
    h.input('Intention').value = 'Local change';
    const record = yearRecords(h.state.days, 2026)[0];
    h.days = writeYearly(h.state.days, { ...record, title: 'Remote change' }).days;
    h.submit();
    assert.equal(h.dialog.open, true);
    assert.match(h.dialog.querySelector('[role="alert"]').textContent, /changed on another device/);
    assert.equal(yearRecords(h.state.days, 2026)[0].title, 'Remote change');
  } finally {
    h.restore();
  }
});

test('optional quarter themes and reflection fields can be left blank or cleared', () => {
  const h = harness();
  try {
    h.view.show();
    h.click('Edit direction and memories');
    h.input('What I want to remember').value = 'A quiet week';
    h.submit();
    let record = yearRecords(h.state.days, 2026).find((note) => note.yearly.kind === 'quarter');
    assert.equal(record.title, '');
    assert.equal(record.yearly.reflection, 'A quiet week');
    h.click('Edit direction and memories');
    h.input('What I want to remember').value = '';
    h.submit();
    record = yearRecords(h.state.days, 2026).find((note) => note.yearly.kind === 'quarter');
    assert.equal(record.yearly.reflection, '');
    h.click('Add an intention');
    h.input('Intention').value = 'Try art';
    h.input('Life dimension (optional)').value = 'learning';
    h.input('A possible next step (optional)').value = 'Pick a color';
    h.submit();
    h.click('Reshape');
    h.input('Life dimension (optional)').value = '';
    h.input('A possible next step (optional)').value = '';
    h.submit();
    record = yearRecords(h.state.days, 2026).find((note) => note.yearly.kind === 'intention');
    assert.equal(record.yearly.dimension, '');
    assert.equal(record.yearly.nextStep, '');
  } finally {
    h.restore();
  }
});

test('concurrent singleton versions are visible and can be chosen without discarding either', () => {
  const h = harness();
  try {
    let days = writeYearly(
      {},
      {
        title: 'Annual direction',
        text: 'Original',
        yearly: { year: 2026, quarter: 0, kind: 'direction' },
      },
      () => 'first',
    ).days;
    days['2026-01-01'].push({
      ...structuredClone(days['2026-01-01'][0]),
      id: 'second',
      text: 'Another direction',
    });
    h.days = days;
    h.view.show();
    assert.match(h.root.textContent, /Other saved versions/);
    h.click('Use this saved version');
    assert.equal(yearRecords(h.state.days, 2026)[0].text, 'Another direction');
    assert.equal(yearRecords(h.state.days, 2026).length, 2);
  } finally {
    h.restore();
  }
});
