import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listItems,
  orderedItems,
  reorderList,
  saveOrder,
  validListOrder,
  itemKey,
} from '../../dist/js/features/lists/model.js';
import { validState } from '../../dist/js/shared/storage.js';
import { writeYearly } from '../../dist/js/features/yearly/model.js';
const note = (id, minute = 600, extra = {}) => ({
  id,
  title: id,
  text: 'Keep this',
  minute,
  done: false,
  ...extra,
});
const days = {
  '2026-11-01': [note('past', 600, { done: true }), note('open', 900)],
  '2026-11-08': [note('current', 600), note('late', 900)],
  '2026-10-25': [note('previous-week', 0, { weekly: true })],
  '2026-11-29': [note('weekly', 0, { weekly: true })],
  '2026-12-01': [note('next-month')],
  '2026-01-01': [
    note('intention', 0, {
      yearly: { year: 2026, quarter: 2, kind: 'intention', status: 'active' },
    }),
    note('direction', 0, { yearly: { year: 2026, quarter: 0, kind: 'direction' } }),
  ],
  '2026-12-05': [note('life', 600, { lifeSource: { group: 'health' } }), note('legacy')],
  '1900-01-01': [note('private-settings', 0, { yearly: { kind: 'commitments', year: 1900 } })],
};
test('Daily and Monthly lists include all dated notes, prior days/completed notes, and overlapping weekly notes without leaking other periods or internal records', () => {
  assert.deepEqual(
    listItems(days, 'daily', '2026-11-08').map((item) => item.entry.id),
    ['current', 'late'],
  );
  assert.deepEqual(
    listItems(days, 'monthly', '2026-11').map((item) => item.entry.id),
    ['past', 'open', 'current', 'late', 'weekly'],
  );
  const weekly = { '2026-10-25': [note('overlap', 0, { weekly: true })] };
  assert.equal(listItems(weekly, 'monthly', '2026-10').length, 1);
  assert.equal(listItems(weekly, 'monthly', '2026-11').length, 0);
  assert.equal(
    listItems({ '2026-10-31': [note('overlap', 0, { weekly: true })] }, 'monthly', '2026-11')
      .length,
    1,
  );
});
test('Yearly includes intentions and scheduled life records plus legacy links, excluding ordinary notes and settings', () => {
  const items = listItems(days, 'yearly', '2026', [{ date: '2026-12-05', id: 'legacy' }]);
  assert.deepEqual(
    items.map((item) => item.entry.id),
    ['intention', 'legacy', 'life'],
  );
  assert.equal(listItems(days, 'yearly', '2027').length, 0);
});
test('view-specific priority survives backups, preserves date/time/content and resets independently; stale reorders are rejected', () => {
  const input = {
    '2026-11-08': [
      note('a', 600, { format: [{ start: 0, end: 4, bold: true }], tags: ['project'] }),
      note('b', 700),
    ],
  };
  const items = listItems(input, 'daily', '2026-11-08'),
    before = structuredClone(input);
  const next = reorderList(input, items, 'daily', itemKey(items[1]), itemKey(items[0]));
  assert.deepEqual(
    orderedItems(listItems(next, 'daily', '2026-11-08'), 'daily').map((item) => item.entry.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    orderedItems(listItems(next, 'monthly', '2026-11'), 'monthly').map((item) => item.entry.id),
    ['a', 'b'],
  );
  assert.deepEqual(validState({ version: 1, days: next }).days, next);
  assert.deepEqual(input, before);
  assert.deepEqual(
    next['2026-11-08'].map(({ listOrder, ...entry }) => entry),
    before['2026-11-08'],
  );
  const reset = saveOrder(next, listItems(next, 'daily', '2026-11-08'), 'daily', true);
  assert.deepEqual(
    orderedItems(listItems(reset, 'daily', '2026-11-08'), 'daily').map((item) => item.entry.id),
    ['a', 'b'],
  );
  assert.throws(
    () => reorderList(next, items, 'daily', itemKey(items[0]), itemKey(items[1])),
    /changed/,
  );
  for (const value of [null, [], { unknown: 1 }, { daily: -1 }, { yearly: 1.5 }])
    assert.throws(() => validListOrder(value));
});
test('reshaping a Yearly intention retains completion and list priorities', () => {
  const original = writeYearly(
    {},
    { title: 'Intention', text: 'Original', yearly: { year: 2026, quarter: 1, kind: 'intention' } },
    () => 'id',
  ).days;
  original['2026-01-01'][0].done = true;
  original['2026-01-01'][0].listOrder = { yearly: 2 };
  const next = writeYearly(original, {
    id: 'id',
    title: 'Revised',
    text: 'Keep going',
    yearly: original['2026-01-01'][0].yearly,
  }).days;
  assert.equal(next['2026-01-01'][0].done, true);
  assert.deepEqual(next['2026-01-01'][0].listOrder, { yearly: 2 });
});

test('Yearly recovers legacy life repeat cycles and boundary Weekly Notes while ordinary yearly links remain excluded', () => {
  const notes = {
    '2026-01-01': [note('legacy', 0, { repeat: { id: 'cycle' } })],
    '2026-12-31': [note('repeat', 0, { repeat: { id: 'cycle' } })],
    '2025-12-28': [note('boundary', 0, { weekly: true, lifeSource: { group: 'home' } })],
    '2027-01-01': [note('later', 0, { lifeSource: { group: 'home' } })],
  };
  assert.deepEqual(
    listItems(notes, 'yearly', '2026', [{ date: '2026-01-01', id: 'legacy' }]).map(
      (item) => item.entry.id,
    ),
    ['boundary', 'legacy', 'repeat'],
  );
  const valid = {
    version: 1,
    days: {
      '2026-11-08': [
        note('linked', 600, { lifeSource: { group: 'health' }, listOrder: { yearly: 0 } }),
      ],
    },
  };
  assert.deepEqual(validState(valid).days, valid.days);
  assert.throws(() =>
    validState({
      ...valid,
      days: { '2026-11-08': [note('bad', 600, { lifeSource: { group: 'unknown' } })] },
    }),
  );
});
