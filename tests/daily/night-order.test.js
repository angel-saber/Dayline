import test from 'node:test';
import assert from 'node:assert/strict';
import { orderDailySlots, readNightOrder } from '../../dist/js/features/daily/night-order.js';
test('night order rotates existing slots without changing dates, note identity, or all-day placement', () => {
  const note = { id: 'a' },
    slots = [
      { minute: 0, entries: [] },
      { minute: 360, entries: [] },
      { minute: 720, entries: [] },
      { minute: 1080, entries: [note] },
      { allDay: true, minute: -1, entries: [] },
    ];
  const original = slots.slice();
  const ordered = orderDailySlots(slots, { enabled: true, start: 1080 });
  assert.deepEqual(
    ordered.map((s) => s.minute),
    [-1, 1080, 0, 360, 720],
  );
  assert.equal(ordered[1].entries[0], note);
  assert.deepEqual(slots, original);
  assert.equal(orderDailySlots(slots, { enabled: false, start: 1080 }), slots);
  assert.deepEqual(
    orderDailySlots(slots, { enabled: true, start: 1100 }).map((s) => s.minute),
    [-1, 1080, 0, 360, 720],
  );
  assert.deepEqual(readNightOrder({ getItem: () => '{bad' }), { enabled: false, start: 1080 });
});
