import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setupCommitments } from '../../dist/js/features/commitments/controller.js';
import { readCommitmentState } from '../../dist/js/features/commitments/game.js';
test('card-first view keeps setup collapsed, exposes accessible completion/menu actions, and opens the editor without losing the habit', () => {
  const { document, window } = parseHTML(
    '<html><body><button id="launch-commitments"></button></body></html>',
  );
  const old = ['window', 'document'].map((k) => [
    k,
    Object.getOwnPropertyDescriptor(globalThis, k),
  ]);
  Object.assign(globalThis, { window, document });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.focus = function () {};
  const items = [
    { id: 'a', title: 'Read', minutes: 30, breakMinutes: 5 },
    { id: 'b', title: 'Exercise', minutes: 15, breakMinutes: 0 },
  ];
  const data = new Map([['dayline.daily-commitments.v1', JSON.stringify(items)]]);
  const storage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  let api;
  try {
    api = setupCommitments({ getState: () => ({ days: {} }), startPractice() {}, storage });
    const dialog = document.querySelector('dialog'),
      composer = dialog.querySelector('.commitment-composer'),
      preferences = dialog.querySelector('.commitment-preferences');
    assert.ok(!composer.open);
    assert.ok(!preferences.open);
    const first = dialog.querySelector('[data-commitment-id="a"]'),
      color = first.style.getPropertyValue('--commitment-card');
    assert.ok(color.startsWith('#'));
    assert.ok(!first.querySelector('.commitment-start').classList.contains('secondary'));
    assert.equal(
      first.querySelector('.commitment-complete').getAttribute('aria-label'),
      'Mark done',
    );
    const menu = first.querySelector('.commitment-card-menu');
    assert.equal(menu.querySelector('summary').getAttribute('aria-label'), 'Manage Read');
    [...menu.querySelectorAll('button')].find((b) => b.textContent === 'Edit').click();
    assert.equal(composer.open, true);
    assert.equal(dialog.querySelector('[aria-label="Habit name"]').value, 'Read');
    dialog.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    assert.equal(composer.open, false);
    assert.equal(readCommitmentState(storage).items[0].id, 'a');
    dialog.querySelector('[data-commitment-id="a"] .commitment-complete').click();
    assert.deepEqual(
      [...dialog.querySelectorAll('.commitment-row')].map((row) => row.dataset.commitmentId),
      ['b', 'a'],
    );
    assert.equal(
      dialog.querySelector('[data-commitment-id="a"]').style.getPropertyValue('--commitment-card'),
      color,
    );
    assert.match(dialog.querySelector('.commitment-list-heading').textContent, /1 \/ 2 complete/);
  } finally {
    api?.destroy();
    for (const [k, d] of old) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
});
