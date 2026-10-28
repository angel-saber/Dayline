import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepeatCycle, repeatPlan } from '../../dist/js/features/repeating/model.js';
import {
  changeRepeatNotes,
  rescheduleRepeatNotes,
} from '../../dist/js/features/repeating/series.js';
import { usFederalHolidays } from '../../dist/js/features/repeating/holidays.js';
import { validState } from '../../dist/js/shared/storage.js';
import { duplicateNote } from '../../dist/js/features/notes/duplicate.js';
const source = {
  id: 'a',
  title: 'Practice',
  text: 'Task',
  minute: 615,
  done: false,
  tasks: [{ start: 0, done: false }],
};
const rule = { start: '2026-11-24', end: '2026-11-27', frequency: 'daily' };
function cycle() {
  let n = 0;
  return createRepeatCycle(
    { '2026-11-24': [structuredClone(source)] },
    '2026-11-24',
    'a',
    rule,
    () => `id-${++n}`,
  ).days;
}

test('cycle identities survive storage and following edits preserve earlier/unrelated notes and completion', () => {
  const days = validState({ version: 1, days: cycle() }).days;
  const selected = days['2026-11-25'][0];
  days['2026-11-27'][0].done = true;
  days['2026-11-27'][0].tasks[0].done = true;
  days['2026-11-26'].push({
    id: 'other',
    title: 'Practice',
    text: 'Task',
    minute: 615,
    done: false,
  });
  const before = structuredClone(days);
  const result = changeRepeatNotes(
    days,
    '2026-11-25',
    selected.id,
    {
      kind: 'edit',
      values: { title: 'Study', text: 'New task', tasks: [{ start: 0, done: false }] },
    },
    'following',
  );
  assert.equal(result.count, 3);
  assert.deepEqual(result.days['2026-11-24'], before['2026-11-24']);
  assert.equal(result.days['2026-11-26'].find((note) => note.id === 'other').title, 'Practice');
  assert.equal(result.days['2026-11-27'][0].title, 'Study');
  assert.equal(result.days['2026-11-27'][0].done, true);
  assert.equal(result.days['2026-11-27'][0].tasks[0].done, true);
  assert.ok(validState({ version: 1, days: result.days }));
  assert.deepEqual(days, before);
  const one = changeRepeatNotes(days, '2026-11-25', selected.id, { kind: 'delete' }, 'one');
  assert.equal(one.count, 1);
  assert.equal(one.days['2026-11-26'].length, 2);
  const following = changeRepeatNotes(
    days,
    '2026-11-25',
    selected.id,
    { kind: 'delete' },
    'following',
  );
  assert.equal(following.count, 3);
  assert.equal(following.days['2026-11-24'].length, 1);
  assert.deepEqual(
    following.days['2026-11-26'].map((note) => note.id),
    ['other'],
  );
  assert.equal(
    duplicateNote(days['2026-11-25'], selected.id, () => 'duplicate').notes[1].repeat,
    undefined,
  );
});
test('holidays cover annual and observed U.S. federal dates across year boundaries', () => {
  assert.ok(usFederalHolidays('2026-11-26').includes('Thanksgiving Day'));
  assert.ok(usFederalHolidays('2026-07-03').includes('Independence Day (observed)'));
  assert.ok(usFederalHolidays('2026-07-04').includes('Independence Day'));
  assert.ok(
    usFederalHolidays('2027-06-18').includes('Juneteenth National Independence Day (observed)'),
  );
  assert.ok(usFederalHolidays('2021-12-31').includes('New Year’s Day (observed)'));
  assert.ok(usFederalHolidays('2026-05-25').includes('Memorial Day'));
  assert.deepEqual(usFederalHolidays('2026-11-25'), []);
  assert.deepEqual(usFederalHolidays('2020-06-19'), []);
});
test('occurrence exceptions skip holidays or customize one note without extending the finite cycle', () => {
  const changes = {
    ...rule,
    exceptions: {
      '2026-11-26': { skip: true },
      '2026-11-27': { date: '2026-11-25', title: 'Special', text: 'Adjusted', minute: 720 },
    },
  };
  assert.deepEqual(
    repeatPlan(changes, '2026-11-24').map((item) => item.date),
    ['2026-11-25', '2026-11-25'],
  );
  let id = 0;
  const result = createRepeatCycle(
    { '2026-11-24': [source] },
    '2026-11-24',
    'a',
    changes,
    () => `new-${++id}`,
  );
  assert.equal(result.count, 2);
  assert.equal(result.days['2026-11-26'], undefined);
  assert.equal(result.days['2026-11-25'].length, 2);
  const special = result.days['2026-11-25'].find((note) => note.title === 'Special');
  assert.equal(special.minute, 720);
  assert.equal(special.text, 'Adjusted');
  assert.equal(special.repeat.occurrence, '2026-11-27');
  assert.deepEqual(special.tasks, []);
  assert.ok(validState({ version: 1, days: result.days }));
  assert.throws(() =>
    repeatPlan({ ...rule, exceptions: { '2026-11-26': { date: '2026-11-28' } } }, '2026-11-24'),
  );
});

test('rescheduling a cycle preserves finite bounds and detaches a single out-of-cycle exception', () => {
  const days = cycle(),
    id = days['2026-11-25'][0].id;
  const sameDates = rescheduleRepeatNotes(
    days,
    '2026-11-25',
    id,
    '2026-11-25',
    '14:15',
    'following',
  );
  assert.equal(sameDates.count, 3);
  assert.equal(sameDates.days['2026-11-24'][0].minute, 615);
  assert.equal(sameDates.days['2026-11-27'][0].minute, 855);
  assert.throws(
    () => rescheduleRepeatNotes(days, '2026-11-25', id, '2026-11-26', '14:15', 'following'),
    /outside this cycle/,
  );
  const one = rescheduleRepeatNotes(days, '2026-11-25', id, '2026-12-01', '12:00', 'one');
  assert.equal(one.days['2026-12-01'][0].repeat, undefined);
  assert.equal(one.days['2026-11-26'].length, 1);
  assert.ok(validState({ version: 1, days: one.days }));
});

test('malformed cycle metadata is rejected while ordinary older notes remain valid', () => {
  assert.ok(validState({ version: 1, days: { '2026-11-24': [source] } }));
  for (const repeat of [
    { id: 'cycle', start: '2026-11-24', occurrence: '2026-11-24' },
    { id: 'cycle', start: '2026-11-24', end: '2026-11-27', occurrence: '2026-12-01' },
    { id: '', start: '2026-11-24', end: '2026-11-27', occurrence: '2026-11-24' },
  ])
    assert.throws(() =>
      validState({ version: 1, days: { '2026-11-24': [{ ...source, repeat }] } }),
    );
});
