import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  previewSchedule,
  applySchedule,
  candidates,
  enabled,
  EXPERIMENT_KEY,
} from '../../dist/js/features/day-adjust/model.js';
import { setupDayAdjust } from '../../dist/js/features/day-adjust/view.js';
import { dayKey } from '../../dist/js/shared/dates.js';
const now = new Date(2026, 10, 4, 10, 0),
  date = '2026-11-04';
const days = {
  [date]: [
    {
      id: 'a',
      minute: 540,
      title: 'First',
      text: 'Rich note',
      done: false,
      format: [{ start: 0, end: 4, bold: true }],
      tags: ['project'],
      attachments: [{ id: 'file' }],
    },
    { id: 'b', minute: 600, text: 'Second', done: false },
    { id: 'repeat', minute: 660, text: 'Recurring', repeat: { id: 'cycle' } },
    { id: 'weekly', minute: 0, text: 'Weekly', weekly: true },
    { id: 'done', minute: 700, text: 'Done', done: true },
  ],
};
test('preview is read-only; applying preserves content and other notes, rolls past midnight, and can restore the prior days', () => {
  const before = structuredClone(days);
  const draft = previewSchedule(days, date, ['b', 'a'], date, 1430, 30, now);
  assert.deepEqual(days, before);
  assert.deepEqual(
    draft.moves.map((m) => [m.id, m.date, m.minute]),
    [
      ['a', date, 1430],
      ['b', '2026-11-05', 20],
    ],
  );
  const next = applySchedule(days, draft, now);
  assert.deepEqual(
    next[date].find((n) => n.id === 'a'),
    { ...days[date][0], minute: 1430 },
  );
  assert.deepEqual(next['2026-11-05'][0], { ...days[date][1], minute: 20 });
  assert.deepEqual(
    next[date].filter((n) => ['repeat', 'weekly', 'done'].includes(n.id)),
    days[date].slice(2).sort((a, b) => a.minute - b.minute),
  );
  const undone = { ...next, ...draft.before };
  assert.deepEqual(undone[date], before[date]);
  assert.deepEqual(undone['2026-11-05'], []);
  assert.deepEqual(days, before);
});
test('stale previews, passed times and ineligible selections fail without touching notes', () => {
  const draft = previewSchedule(days, date, ['a'], date, 660, 30, now);
  const changed = structuredClone(days);
  changed[date][0].text = 'Newer text';
  assert.throws(() => applySchedule(changed, draft, now), /changed since/);
  assert.equal(changed[date][0].text, 'Newer text');
  assert.throws(() => applySchedule(days, draft, new Date(2026, 10, 4, 12)), /passed/);
  for (const ids of [[], ['a', 'a'], ['repeat'], ['weekly'], ['done'], ['missing']])
    assert.throws(() => previewSchedule(days, date, ids, date, 660, 30, now));
  assert.throws(() => previewSchedule(days, date, ['a'], '2026-02-30', 660, 30, now));
  assert.throws(() => previewSchedule(days, date, ['a'], date, 500, 30, now));
  assert.throws(() => previewSchedule(days, date, ['a'], date, 660, 0, now));
  assert.deepEqual(
    candidates(days, date).map((n) => n.id),
    ['a', 'b'],
  );
});
test('conflicts are surfaced without displacing existing notes; unrelated day changes do not block apply', () => {
  const withTarget = { ...days, '2026-11-05': [{ id: 'existing', minute: 540, text: 'Keep me' }] };
  const draft = previewSchedule(withTarget, date, ['a'], '2026-11-05', 540, 30, now);
  assert.equal(draft.warnings.length, 1);
  const next = applySchedule(
    { ...withTarget, '2026-11-10': [{ id: 'other', minute: 0, text: 'Unrelated' }] },
    draft,
    now,
  );
  assert.equal(next['2026-11-05'].length, 2);
  assert.equal(next['2026-11-10'][0].text, 'Unrelated');
});
test('experiment offers five selectable states, requires preview before apply, and can be hidden without modifying notes', () => {
  const { document, window } = parseHTML('<html><body><main></main><aside></aside></body></html>');
  const prior = Object.fromEntries(
    ['document', 'window', 'localStorage'].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  const storage = new Map();
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: document },
    window: { configurable: true, value: window },
    localStorage: {
      configurable: true,
      value: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    },
  });
  try {
    const today = dayKey();
    const state = {
      days: { [today]: structuredClone(days[date]) },
      settings: { interval: 60, clock: '24' },
    };
    let calls = 0;
    const ui = setupDayAdjust({
      root: document.querySelector('main'),
      settingsRoot: document.querySelector('aside'),
      getState: () => state,
      getDate: () => today,
      openNote() {},
      apply() {
        calls++;
        return true;
      },
      toast() {},
    });
    const click = (text) =>
      [...document.querySelectorAll('button')].find((b) => b.textContent === text).click();
    assert.equal(document.querySelector('.day-adjust').open, undefined);
    click('I’m doing too much');
    assert.equal(document.querySelectorAll('.day-adjust-actions button').length, 5);
    assert.equal(
      [...document.querySelectorAll('button')].find((b) => b.textContent === 'Apply these changes')
        .hidden,
      true,
    );
    const box = document.querySelector('fieldset input');
    box.checked = true;
    box.dispatchEvent(new window.Event('change'));
    click('Preview changes');
    assert.match(document.querySelector('.day-adjust-preview').textContent, /First/);
    assert.equal(calls, 0);
    click('Apply these changes');
    assert.equal(calls, 1);
    click('I’m ahead');
    assert.match(document.querySelector('.day-adjust-body').textContent, /extra work is optional/);
    const toggle = document.querySelector('aside input');
    toggle.checked = false;
    toggle.dispatchEvent(new window.Event('change'));
    assert.equal(enabled(), false);
    assert.equal(storage.get(EXPERIMENT_KEY), 'false');
    assert.equal(document.querySelector('.day-adjust').hidden, true);
    ui.render();
    assert.equal(document.querySelector('.day-adjust').hidden, true);
    assert.deepEqual(state.days[today], days[date]);
  } finally {
    for (const [key, desc] of Object.entries(prior)) {
      if (desc) Object.defineProperty(globalThis, key, desc);
      else delete globalThis[key];
    }
  }
});
