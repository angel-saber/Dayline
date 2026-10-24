import test from 'node:test';
import assert from 'node:assert/strict';
import { grouped, slots, bucket } from '../../dist/js/shared/schedule.js';
test('one-pass grouping preserves every bucket, note order, and original objects', () => {
  const entries = [
    { id: 'late', minute: 1439 },
    { id: 'first', minute: 615 },
    { id: 'second', minute: 600 },
    { id: 'start', minute: 0 },
    { id: 'same', minute: 615 },
  ];
  const before = structuredClone(entries);
  for (const interval of [1, 15, 30, 47, 60, 120, 240, 1440]) {
    const expected = slots(interval).map((minute) => ({
      minute,
      entries: entries.filter((entry) => bucket(entry.minute, interval) === minute),
    }));
    const actual = grouped(entries, interval);
    assert.deepEqual(actual, expected);
    assert.ok(actual.flatMap((slot) => slot.entries).every((entry) => entries.includes(entry)));
  }
  assert.deepEqual(entries, before);
});
