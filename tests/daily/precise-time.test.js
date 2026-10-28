import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { minuteAtPosition, bindPreciseTime } from '../../dist/js/features/daily/precise-time.js';

test('vertical position selects exact minutes for all intervals, with safe midnight bounds', () => {
  const box = { top: 200, height: 100 };
  assert.equal(minuteAtPosition(420, 60, 250, box), 450);
  assert.equal(minuteAtPosition(420, 60, 225, box), 435);
  for (const interval of [15, 30, 60, 120, 240, 17, 1440])
    assert.equal(minuteAtPosition(0, interval, 250, box), Math.round(interval / 2));
  assert.equal(minuteAtPosition(420, 60, 100, box), 420);
  assert.equal(minuteAtPosition(420, 60, 500, box), 479);
  assert.equal(minuteAtPosition(1430, 60, 250, box), 1435);
  assert.equal(minuteAtPosition(1430, 60, 300, box), 1439);
  assert.equal(minuteAtPosition(420, 60, 250, { top: 200, height: 0 }), 420);
  assert.equal(minuteAtPosition(420, 60, NaN, box), 420);
  assert.throws(() => minuteAtPosition(1440, 60, 250, box));
});

test('time gutter and empty space add at the suggested time without hijacking notes, editors, selection or keyboard', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const { document, window } = parseHTML(
    '<html><body><section class="slot"><button class="slot-time"></button><div class="slot-notes"><article class="entry"><button>Edit</button></article><button class="empty-add"></button></div></section></body></html>',
  );
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  try {
    const row = document.querySelector('.slot'),
      time = document.querySelector('.slot-time'),
      notes = document.querySelector('.slot-notes'),
      added = [];
    time.getBoundingClientRect = () => ({ top: 200, height: 100 });
    let selecting = false;
    const api = bindPreciseTime({
      row,
      time,
      notes,
      start: 420,
      interval: 60,
      clock: '24',
      onAdd: (minute) => added.push(minute),
      isSelecting: () => selecting,
    });
    const dispatch = (target, type, values = {}) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      for (const [key, value] of Object.entries(values))
        Object.defineProperty(event, key, { value });
      target.dispatchEvent(event);
      return event;
    };
    dispatch(time, 'click', { clientY: 250, detail: 1, button: 0 });
    assert.deepEqual(added, [450]);
    dispatch(notes, 'click', { clientY: 225, detail: 1, button: 0 });
    assert.equal(added.at(-1), 435);
    dispatch(document.querySelector('.entry button'), 'click', { clientY: 275, detail: 1 });
    assert.equal(added.length, 2);
    document.querySelector('.empty-add').addEventListener('click', api.add);
    dispatch(document.querySelector('.empty-add'), 'click', { clientY: 275, detail: 1 });
    assert.equal(added.at(-1), 465);
    dispatch(time, 'click', { clientY: 250, detail: 0 });
    assert.equal(added.at(-1), 420);
    const editor = document.createElement('form');
    editor.className = 'editor';
    notes.append(editor);
    dispatch(notes, 'click', { clientY: 250, detail: 1 });
    assert.equal(added.length, 4);
    editor.remove();
    selecting = true;
    dispatch(time, 'click', { clientY: 250, detail: 1 });
    assert.equal(added.length, 4);
    selecting = false;
    dispatch(time, 'pointermove', { clientY: 250, pointerType: 'mouse', buttons: 0 });
    assert.equal(time.querySelector('.interval-time-preview').hidden, false);
    assert.match(time.textContent, /07:30/);
    dispatch(row, 'pointerleave');
    assert.equal(time.querySelector('.interval-time-preview').hidden, true);
    dispatch(time, 'click', { clientY: 250, detail: 1, button: 2 });
    assert.equal(added.length, 4);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
