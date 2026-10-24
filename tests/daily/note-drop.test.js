import test from 'node:test';
import assert from 'node:assert/strict';
import { dropEntry } from '../../dist/js/shared/schedule.js';
import { dropHover } from '../../dist/js/features/daily/drop-hover.js';
const notes = [
  { id: 'a', minute: 615, text: 'Move me' },
  { id: 'b', minute: 675, text: 'Keep me' },
  { id: 'c', minute: 690, text: 'Keep me too' },
  { id: 'd', minute: 735, text: 'Later' },
];
test('normal drops join an occupied interval without shifting any other notes', () => {
  const result = dropEntry(notes, 'a', 660, 60);
  assert.equal(result.find((e) => e.id === 'a').minute, 675);
  for (const id of ['b', 'c', 'd'])
    assert.deepEqual(
      result.find((e) => e.id === id),
      notes.find((e) => e.id === id),
    );
  assert.equal(notes[0].minute, 615);
  assert.equal(result.length, 4);
});
test('an armed target swaps only those two notes and keeps their exact times', () => {
  const result = dropEntry(notes, 'a', 660, 60, 'c');
  assert.equal(result.find((e) => e.id === 'a').minute, 690);
  assert.equal(result.find((e) => e.id === 'c').minute, 615);
  for (const id of ['b', 'd'])
    assert.deepEqual(
      result.find((e) => e.id === id),
      notes.find((e) => e.id === id),
    );
});
test('invalid, removed, or self targets cannot displace other notes', () => {
  for (const target of ['missing', 'a', 'd']) {
    const result = dropEntry(notes, 'a', 660, 60, target);
    assert.equal(result.find((e) => e.id === 'a').minute, 675);
    assert.equal(result.find((e) => e.id === 'c').minute, 690);
  }
  assert.equal(dropEntry(notes, 'a', 661, 60), notes);
  assert.equal(dropEntry(notes, 'missing', 660, 60), notes);
  assert.equal(dropEntry(notes, 'a', 600, 60), notes);
});
test('holding over one note arms it; moving away or cancelling clears the swap', () => {
  const timers = new Map();
  let serial = 0;
  const changes = [];
  const hover = dropHover({
    schedule(fn, delay) {
      assert.equal(delay, 800);
      timers.set(++serial, fn);
      return serial;
    },
    cancel(id) {
      timers.delete(id);
    },
    onChange: (id, armed) => changes.push([id, armed]),
  });
  hover.update('b');
  assert.equal(hover.targetId, null);
  hover.update('b');
  assert.equal(timers.size, 1);
  hover.update('c');
  assert.equal(timers.size, 1);
  assert.equal(hover.targetId, null);
  timers.get(serial)();
  assert.equal(hover.targetId, 'c');
  hover.update(null);
  assert.equal(hover.targetId, null);
  hover.update('b');
  hover.clear();
  assert.equal(hover.targetId, null);
  assert.deepEqual(changes.at(-1), [null, false]);
});
