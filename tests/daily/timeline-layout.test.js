import test from 'node:test';
import assert from 'node:assert/strict';
import { intervalLayout } from '../../dist/js/features/daily/timeline-layout.js';

test('note starts are proportional within each interval, including custom and midnight intervals', () => {
  for (const [start, duration] of [
    [420, 60],
    [0, 15],
    [600, 30],
    [0, 120],
    [0, 240],
    [420, 17],
    [1430, 60],
  ]) {
    const actual = Math.min(duration, 1440 - start);
    const minute = start + Math.floor(actual / 2);
    const layout = intervalLayout([{ minute, height: 90 }], start, duration);
    assert.equal(layout.items[0].top / layout.height, (minute - start) / actual);
    assert.ok(layout.items[0].top + 90 <= layout.height);
  }
});
test('expanded intervals keep adjacent and simultaneous note bodies readable without changing time order', () => {
  const layout = intervalLayout(
    [
      { minute: 450, height: 100 },
      { minute: 420, height: 400 },
      { minute: 450, height: 200 },
      { minute: 451, height: 90 },
    ],
    420,
    60,
  );
  assert.deepEqual(
    layout.items.map((n) => n.minute),
    [420, 450, 450, 451],
  );
  for (let i = 1; i < layout.items.length; i++)
    assert.ok(
      layout.items[i].top >= layout.items[i - 1].top + layout.items[i - 1].height + 8 - 0.00001,
    );
  assert.equal(layout.items[1].top, layout.height / 2);
  assert.ok(Math.abs(layout.items[3].top - (layout.height * 31) / 60) < 0.00001);
  assert.ok(layout.items.at(-1).top + 90 <= layout.height);
});

test('Daily binding aligns cards, leaves all-day notes alone and keeps editors in normal flow', async () => {
  const { parseHTML } = await import('linkedom');
  const { bindIntervalLayout } = await import('../../dist/js/features/daily/timeline-layout.js');
  const previous = globalThis.window;
  const { document, window } = parseHTML(
    '<html><body><main><section class="slot" data-minute="420"><button class="slot-time"></button><div class="slot-notes"><article class="entry" data-minute="450"></article></div></section><section class="slot all-day-slot"><div class="slot-notes"><article class="entry"></article></div></section></main></body></html>',
  );
  globalThis.window = window;
  try {
    const card = document.querySelector('.entry');
    card.getBoundingClientRect = () => ({ height: 80 });
    const cleanup = bindIntervalLayout(document.querySelector('main'), 60);
    const slot = document.querySelector('.slot');
    assert.ok(slot.classList.contains('precise-layout'));
    assert.equal(
      parseFloat(card.style.top),
      parseFloat(slot.style.getPropertyValue('--interval-height')) / 2,
    );
    assert.ok(!document.querySelector('.all-day-slot').classList.contains('precise-layout'));
    const editor = document.createElement('div');
    editor.className = 'editor';
    slot.querySelector('.slot-notes').append(editor);
    window.dispatchEvent(new window.Event('resize'));
    assert.ok(!slot.classList.contains('precise-layout'));
    assert.equal(card.style.top || '', '');
    cleanup();
  } finally {
    globalThis.window = previous;
  }
});
