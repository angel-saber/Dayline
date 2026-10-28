import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  blankRow,
  defaults,
  resolveDate,
  parseList,
  planLifeRows,
  scheduleLife,
  readLife,
  writeLife,
  LIFE_DATE,
} from '../../dist/js/features/yearly/life/model.js';
import { createLifePlanner } from '../../dist/js/features/yearly/life/view.js';
import { validState } from '../../dist/js/shared/storage.js';
import { grouped, dueEntries, dropEntry } from '../../dist/js/shared/schedule.js';
import { focusIntervalNotes } from '../../dist/js/features/focus/model.js';
import { resolveReminder } from '../../dist/js/features/reminders/reminders.js';
import { emptyIntervals } from '../../dist/js/features/sharing/availability-model.js';
const today = '2026-10-28';
const ids = () => {
  let n = 0;
  return () => `life-${++n}`;
};
const data = () => ({
  version: 1,
  groups: {
    occasions: {
      defaults: { ...defaults('occasions', today), frequency: 'none' },
      rows: [{ ...blankRow(), title: 'Birthday', date: 'May 12' }],
    },
  },
  support: {},
  links: [],
});
test('yearless dates show the next valid occurrence, including leap days, and pasted lists retain ambiguous rows for review', () => {
  assert.equal(resolveDate('May 12', today), '2027-05-12');
  assert.equal(resolveDate('10/28', today), today);
  assert.equal(resolveDate('Feb 29', today), '2028-02-29');
  assert.throws(() => resolveDate('Feb 30', today));
  assert.throws(() => resolveDate('2026-02-30', today));
  const rows = parseList('Mom — May 12\nAnniversary — September 8 — 14:30\nCheck this');
  assert.equal(rows[1].time, '14:30');
  assert.equal(rows[2].date, '');
});
test('bulk scheduling keeps shared defaults and row overrides, finite cycles, weekly anchors, existing notes and full undo snapshots', () => {
  const draft = data();
  draft.groups.occasions.defaults.frequency = 'annual';
  draft.groups.occasions.defaults.end = '2029-12-31';
  draft.groups.occasions.rows.push({
    ...blankRow(),
    title: 'Appointment',
    date: '2026-11-02',
    time: '10:15',
    frequency: 'none',
    tags: 'Project, Care',
    text: 'Bring questions',
  });
  const old = { [today]: [{ id: 'old', title: 'Keep', text: '', minute: 600, done: false }] };
  const result = scheduleLife(old, draft, 'occasions', null, today, ids());
  assert.equal(result.count, 4);
  assert.deepEqual(result.days[today], old[today]);
  assert.equal(result.days['2027-05-12'][0].allDay, true);
  assert.equal(result.days['2027-05-12'][0].remind, false);
  assert.equal(result.days['2026-11-02'][0].minute, 615);
  assert.deepEqual(result.days['2026-11-02'][0].tags, ['project', 'custom:Care']);
  assert.equal(readLife(result.days).data.groups.occasions.rows[0].title, '');
  assert.ok(readLife(result.days).data.links.length);
  assert.deepEqual(validState({ version: 1, days: result.days }).days, result.days);
  const weekly = data();
  weekly.groups.occasions.defaults.mode = 'weekly';
  const plan = planLifeRows(weekly, 'occasions', today, ids());
  assert.equal(plan.notes[0].date, '2027-05-09');
  assert.equal(plan.notes[0].entry.weekly, true);
  const invalid = data();
  invalid.groups.occasions.rows.push({ ...blankRow(), title: 'Needs date' });
  assert.equal(planLifeRows(invalid, 'occasions', today).errors[1], 'Choose a date.');
  assert.throws(() => scheduleLife(old, invalid, 'occasions', null, today, ids()));
  assert.equal(Object.keys(old).length, 1);
});
test('drafts and support statuses persist across years, stale writes fail and support planning preserves another list draft', () => {
  const draft = data();
  draft.support['Emergency kit'] = { status: 'Revisit', text: 'Check flashlight batteries' };
  const generate = ids();
  const first = writeLife({}, draft, null, generate);
  const { record } = readLife(first.days);
  const second = structuredClone(draft);
  second.groups.occasions.rows[0].title = 'Changed';
  assert.throws(() => writeLife(first.days, second, null, ids()));
  const saved = writeLife(first.days, second, record.text, generate);
  assert.equal(readLife(saved.days).data.support['Emergency kit'].status, 'Revisit');
  assert.equal(readLife(saved.days).record.yearly.year, 1900);
  const pending = structuredClone(second);
  pending.groups.other = {
    defaults: defaults('other', today),
    rows: [{ ...blankRow(), title: 'Emergency kit', date: today }],
  };
  const scheduled = scheduleLife(
    saved.days,
    pending,
    'other',
    readLife(saved.days).record.text,
    today,
    generate,
    null,
  );
  assert.equal(readLife(scheduled.days).data.groups.other, undefined);
  assert.equal(readLife(scheduled.days).data.groups.occasions.rows[0].title, 'Changed');
  assert.ok(scheduled.previous[LIFE_DATE]);
});
test('all-day notes group separately, notify only when requested, open their rail, and do not occupy timed availability or Focus', () => {
  const date = '2027-05-12',
    note = {
      id: 'birthday',
      title: 'Birthday',
      text: '',
      minute: 540,
      done: false,
      allDay: true,
      remind: false,
    };
  const at = new Date(2027, 4, 12, 9).getTime();
  assert.equal(grouped([note], 60)[0].allDay, true);
  assert.deepEqual(dueEntries([note], date, 60, at - 1000, at), []);
  assert.equal(dueEntries([{ ...note, remind: true }], date, 60, at - 1000, at).length, 1);
  assert.equal(resolveReminder({ [date]: [note] }, { date, id: note.id }, 60).minute, -1);
  assert.deepEqual(
    focusIntervalNotes(
      { days: { [date]: [note] }, settings: { interval: 60 } },
      { date, minute: 540 },
    ),
    [],
  );
  assert.equal(
    emptyIntervals(
      { [date]: [note] },
      { start: date, end: date, from: 540, to: 600, weekdays: [3], interval: 60 },
      at - 1000,
    ).length,
    1,
  );
  assert.equal(dropEntry([note], note.id, 600, 60)[0].allDay, false);
  assert.equal(dropEntry([{ ...note, allDay: false }], note.id, -1, 60)[0].allDay, true);
});
test('inline planner saves without rebuilding active fields, pastes multiple rows, schedules once and exposes support actions', () => {
  const globals = ['window', 'document'];
  const prev = globals.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  const { window } = parseHTML('<html><body></body></html>');
  Object.assign(globalThis, { window, document: window.document });
  const { document, HTMLSelectElement, HTMLElement } = window;
  Object.defineProperty(HTMLElement.prototype, 'open', {
    configurable: true,
    get() {
      return this.hasAttribute('open');
    },
    set(v) {
      this.toggleAttribute('open', v);
    },
  });
  Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return (
        this.querySelector('option[selected]')?.value || this.querySelector('option')?.value || ''
      );
    },
    set(v) {
      for (const o of this.querySelectorAll('option')) o.toggleAttribute('selected', o.value === v);
    },
  });
  let days = {},
    n = 0,
    savedCount = 0,
    fail = false;
  const newId = () => `ui-${++n}`;
  try {
    const app = createLifePlanner({
      getState: () => ({ days }),
      now: () => new Date(2026, 9, 28, 12),
      saveLife(d, e) {
        if (fail) return false;
        const result = writeLife(days, d, e, newId);
        days = result.days;
        return result;
      },
      planLife(d, k, e, restore) {
        const result = scheduleLife(days, d, k, e, today, newId, restore);
        days = result.days;
        savedCount++;
        return result;
      },
      openNote() {},
    });
    document.body.append(app.element);
    const click = (text) =>
      [...app.element.querySelectorAll('button')].find((b) => b.textContent === text).click();
    click('Birthdays & anniversaries');
    let field = app.element.querySelector('[aria-label="Name or occasion"]');
    field.value = 'Mom';
    field.dispatchEvent(new window.Event('input'));
    assert.equal(app.element.querySelector('[aria-label="Name or occasion"]'), field);
    assert.equal(readLife(days).data.groups.occasions.rows[0].title, 'Mom');
    const box = app.element.querySelector('[aria-label="Paste a list"]');
    box.value = 'Dad — June 1\nAnniversary — September 8';
    click('Turn list into rows');
    assert.equal(app.element.querySelectorAll('.life-row').length, 3);
    const firstDate = app.element.querySelector('.life-row [aria-label="Date"]');
    firstDate.value = 'May 12';
    firstDate.dispatchEvent(new window.Event('input'));
    [...app.element.querySelectorAll('button')]
      .find((b) => b.textContent.startsWith('Add 3 items to calendar'))
      .click();
    assert.equal(savedCount, 1);
    assert.equal(app.element.querySelectorAll('.life-row').length, 1);
    assert.equal(
      Object.values(days)
        .flat()
        .filter((e) => !e.yearly).length,
      3,
    );
    assert.ok(app.element.querySelector('.life-links'));
    const item = [...app.element.querySelectorAll('.life-support-item')].find(
      (e) => e.querySelector('summary').textContent === 'Emergency kit',
    );
    const step = item.querySelector('[aria-label="Personal next step or reference"]');
    step.value = 'Check batteries';
    step.dispatchEvent(new window.Event('input'));
    [...item.querySelectorAll('button')]
      .find((b) => b.textContent === 'Add to Weekly Notes')
      .click();
    assert.ok(
      Object.values(days)
        .flat()
        .some((e) => e.weekly && e.text === 'Check batteries'),
    );
    fail = true;
    const unsaved = app.element.querySelector('.life-row [aria-label="Name or occasion"]');
    unsaved.value = 'Keep this draft after failure';
    unsaved.dispatchEvent(new window.Event('input'));
    app.refresh();
    assert.equal(app.element.querySelector('.life-row [aria-label="Name or occasion"]'), unsaved);
    assert.match(app.element.textContent, /Could not save/);
    fail = false;
    unsaved.dispatchEvent(new window.Event('input'));
    assert.equal(
      readLife(days).data.groups.occasions.rows[0].title,
      'Keep this draft after failure',
    );
  } finally {
    for (const [k, d] of prev) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
});
