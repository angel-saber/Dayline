import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { commitmentTimelineDrag } from '../../dist/js/features/commitments/timeline-drag.js';
test('commitment drag creates at precise time, cancels outside, and leaves other pointers alone', () => {
  const { window, document } = parseHTML(
    '<html><body><button id="handle"></button><div id="timeline"><div class="slot" data-minute="420"><button class="slot-time"></button></div></div></body></html>',
  );
  const keys = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const old = keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  Object.assign(globalThis, {
    window,
    document,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  });
  try {
    const root = document.querySelector('#timeline'),
      handle = document.querySelector('#handle'),
      slot = root.querySelector('.slot');
    slot.querySelector('button').getBoundingClientRect = () => ({ top: 100, height: 100 });
    let hit = slot,
      begun = 0,
      cancelled = 0;
    const drops = [];
    document.elementFromPoint = () => hit;
    window.scrollBy = () => {};
    window.innerHeight = 800;
    commitmentTimelineDrag(handle, {
      root,
      interval: () => 60,
      begin: () => {
        begun++;
      },
      drop: (m) => drops.push(m),
      cancel: () => cancelled++,
    });
    function send(type, y = 150, pointerId = 1) {
      const e = new window.Event(type, { cancelable: true });
      Object.assign(e, { button: 0, clientX: 100, clientY: y, pointerId });
      handle.dispatchEvent(e);
    }
    send('pointerdown');
    assert.match(root.querySelector('.drop-time-lock').textContent, /Drop at .*7:30/);
    assert.equal(root.querySelectorAll('.drop-time-tick').length, 4);
    send('pointerup', 150, 2);
    assert.deepEqual(drops, []);
    send('pointerup');
    assert.deepEqual(drops, [450]);
    assert.equal(root.querySelector('.drop-time-overlay'), null);
    assert.equal(begun, 1);
    assert.equal(slot.classList.contains('drop-target'), false);
    send('pointerdown');
    hit = null;
    send('pointerup');
    assert.equal(cancelled, 1);
    assert.deepEqual(drops, [450]);
    hit = slot;
    send('pointerdown');
    send('pointercancel');
    send('pointerup');
    assert.equal(cancelled, 2);
    assert.deepEqual(drops, [450]);
  } finally {
    for (const [k, d] of old) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
});
