import test from 'node:test';
import assert from 'node:assert/strict';
import { dueEntries, grouped, moveEntry } from '../../dist/js/shared/schedule.js';
import { validState } from '../../dist/js/shared/storage.js';
const notes = [
  { id: 'a', minute: 615, text: 'First note', done: false },
  { id: 'b', minute: 645, text: 'Second note', done: false },
  { id: 'c', minute: 615, text: 'Another note at the same time', done: false },
];
const at = (hour, minute) => new Date(2026, 9, 23, hour, minute).getTime();
test('separate notes share an interval and keep independent exact times through backup restoration', () => {
  const state = validState(
    JSON.parse(JSON.stringify({ version: 1, days: { '2026-10-23': notes } })),
  );
  assert.deepEqual(
    grouped(state.days['2026-10-23'], 60).find((s) => s.minute === 600).entries,
    notes,
  );
});
test('notes notify at 10:15 and 10:45, never at the 10:00 interval boundary', () => {
  assert.deepEqual(dueEntries(notes, '2026-10-23', 60, at(10, 0) - 1000, at(10, 0)), []);
  assert.deepEqual(
    dueEntries(notes, '2026-10-23', 60, at(10, 15) - 1000, at(10, 15)).map((e) => e.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    dueEntries(notes, '2026-10-23', 60, at(10, 45) - 1000, at(10, 45)).map((e) => e.id),
    ['b'],
  );
  for (const interval of [15, 30, 60, 240, 47, 1440])
    assert.deepEqual(
      dueEntries(notes, '2026-10-23', interval, at(10, 15) - 1000, at(10, 15)).map((e) => e.id),
      ['a', 'c'],
    );
});
test('moving intervals retains the exact-minute offset for the moved note and shifted notes', () => {
  const result = moveEntry(
    [{ ...notes[0] }, { id: 'd', minute: 675, text: 'Shifted', done: false }],
    'a',
    660,
    60,
  );
  assert.equal(result.find((e) => e.id === 'a').minute, 675);
  assert.equal(result.find((e) => e.id === 'd').minute, 615);
  const last = moveEntry([{ ...notes[0] }], 'a', 1410, 47);
  assert.ok(last.every((e) => e.minute < 1440));
});
