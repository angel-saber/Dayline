import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  cycleEnd,
  repeatDates,
  createRepeatCycle,
} from '../../dist/js/features/repeating/model.js';
import { validState } from '../../dist/js/shared/storage.js';

test('finite durations include the first day and clamp month and leap-year boundaries', () => {
  assert.equal(cycleEnd('2026-10-28', 'days', 3), '2026-10-30');
  assert.equal(cycleEnd('2026-10-28', 'weeks', 2), '2026-11-10');
  assert.equal(cycleEnd('2026-10-28', 'months', 1), '2026-11-27');
  assert.equal(cycleEnd('2026-10-28', 'date', 0, '2026-12-31'), '2026-12-31');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.deepEqual(repeatDates({ start: '2026-01-31', end: '2026-04-30', frequency: 'monthly' }), [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
  ]);
});
test('daily, weekly and chosen weekdays stop at the explicit end date', () => {
  assert.deepEqual(repeatDates({ start: '2026-12-30', end: '2027-01-01', frequency: 'daily' }), [
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
  ]);
  assert.deepEqual(repeatDates({ start: '2026-10-28', end: '2026-11-11', frequency: 'weekly' }), [
    '2026-10-28',
    '2026-11-04',
    '2026-11-11',
  ]);
  assert.deepEqual(
    repeatDates({
      start: '2026-10-26',
      end: '2026-11-01',
      frequency: 'weekdays',
      weekdays: [1, 3, 5],
    }),
    ['2026-10-26', '2026-10-28', '2026-10-30'],
  );
  for (const rule of [
    { start: '2026-10-28', frequency: 'daily' },
    { start: '2026-10-28', end: '2026-10-27', frequency: 'daily' },
    { start: '2026-10-28', end: '2026-10-30', frequency: 'forever' },
    { start: '2026-10-28', end: '2026-10-30', frequency: 'weekdays', weekdays: [] },
    { start: '2026-10-28', end: '2030-01-01', frequency: 'daily' },
  ])
    assert.throws(() => repeatDates(rule));
  for (const amount of [0, -1, 1.5, NaN])
    assert.throws(() => cycleEnd('2026-10-28', 'weeks', amount));
});
test('repeat creation preserves source and occupied days, resets completion/history, and snapshots the whole batch', () => {
  const note = {
    id: 'source',
    minute: 615,
    title: 'Practice',
    text: 'First task',
    done: true,
    tags: ['project'],
    format: [{ start: 0, end: 5, bold: true }],
    tasks: [{ start: 0, done: true }],
    attachments: [{ id: 'file', name: 'a.txt', type: 'text/plain', size: 1 }],
    focusReports: [],
    guidedActivities: [],
  };
  const days = {
    '2026-10-28': [note],
    '2026-10-29': [{ id: 'other', minute: 615, text: 'Keep me', done: false }],
  };
  const original = structuredClone(days);
  let serial = 0;
  const result = createRepeatCycle(
    days,
    '2026-10-28',
    'source',
    { start: '2026-10-28', end: '2026-10-30', frequency: 'daily' },
    () => `copy-${++serial}`,
  );
  assert.equal(result.count, 2);
  assert.deepEqual(days, original);
  assert.equal(result.days['2026-10-29'].length, 2);
  assert.deepEqual(result.days['2026-10-29'][0], days['2026-10-29'][0]);
  const copy = result.days['2026-10-30'][0];
  assert.equal(copy.minute, 615);
  assert.equal(copy.done, false);
  assert.equal(copy.tasks[0].done, false);
  assert.equal(copy.focusReports, undefined);
  assert.equal(copy.guidedActivities, undefined);
  assert.deepEqual(copy.attachments, note.attachments);
  assert.deepEqual(copy.tags, note.tags);
  assert.deepEqual(result.previous, {
    '2026-10-28': days['2026-10-28'],
    '2026-10-29': days['2026-10-29'],
    '2026-10-30': [],
  });
  assert.ok(validState({ version: 1, days: { '2026-10-30': [copy] } }));
  assert.throws(() =>
    createRepeatCycle(
      days,
      '2026-10-28',
      'source',
      { start: '2026-10-28', end: '2026-10-30', frequency: 'daily' },
      () => 'other',
    ),
  );
  assert.deepEqual(days, original);
});
