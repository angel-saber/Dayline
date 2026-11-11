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
    const body = dialog.querySelector('[aria-label="Commitment details"]');
    body.value = 'One chapter.\nOne thought.';
    dialog.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    assert.equal(composer.open, false);
    assert.equal(readCommitmentState(storage).items[0].id, 'a');
    assert.equal(readCommitmentState(storage).items[0].body, 'One chapter.\nOne thought.');
    assert.equal(
      dialog.querySelector('[data-commitment-id="a"] .commitment-body').textContent,
      'One chapter.\nOne thought.',
    );
    assert.equal(body.value, '');
    dialog.querySelector('[data-commitment-id="a"] .commitment-complete').click();
    assert.deepEqual(
      [...dialog.querySelectorAll('.commitment-row')].map((row) => row.dataset.commitmentId),
      ['a', 'b'],
    );
    assert.equal(
      dialog.querySelector('[data-commitment-id="a"]').style.getPropertyValue('--commitment-card'),
      color,
    );
    assert.match(dialog.querySelector('.commitment-list-heading').textContent, /1 \/ 2 complete/);
    document.querySelector('#launch-commitments').click();
    const currentMenu = dialog.querySelector('[data-commitment-id="b"] .commitment-card-menu');
    [...currentMenu.querySelectorAll('button')].find((b) => b.textContent === 'Edit').click();
    const draftInput = dialog.querySelector('[aria-label="Habit name"]');
    draftInput.value = 'Keep this unsaved draft';
    document.documentElement.dataset.layout = 'builder';
    window.dispatchEvent(new window.Event('dayline:appearance'));
    assert.notEqual(
      dialog.querySelector('[data-commitment-id="a"]').style.getPropertyValue('--commitment-card'),
      color,
    );
    assert.equal(dialog.querySelector('[aria-label="Habit name"]'), draftInput);
    assert.equal(draftInput.value, 'Keep this unsaved draft');
    const reorder = dialog.querySelector('[data-commitment-id="b"] .commitment-reorder-handle');
    const key = new window.Event('keydown', { cancelable: true });
    key.key = 'ArrowUp';
    reorder.dispatchEvent(key);
    assert.deepEqual(
      readCommitmentState(storage).items.map((item) => item.id),
      ['b', 'a'],
    );
    assert.equal(draftInput.value, 'Keep this unsaved draft');
    const rows = [...dialog.querySelectorAll('.commitment-row')];
    rows[0].parentElement.getBoundingClientRect = () => ({
      left: 0,
      right: 300,
      top: 0,
      bottom: 110,
    });
    rows.forEach((row, i) => {
      row.getBoundingClientRect = () => ({ top: i * 60, height: 50 });
    });
    const handle = rows[1].querySelector('.commitment-reorder-handle');
    for (const [type, y] of [
      ['pointerdown', 70],
      ['pointermove', -5],
      ['pointerup', -5],
    ]) {
      const event = new window.Event(type, { cancelable: true });
      Object.assign(event, { button: 0, pointerId: 1, clientX: 50, clientY: y });
      handle.dispatchEvent(event);
    }
    assert.deepEqual(
      readCommitmentState(storage).items.map((item) => item.id),
      ['a', 'b'],
    );
    const reorderMenu = dialog.querySelector('[data-commitment-id="a"] .commitment-card-menu');
    [...reorderMenu.querySelectorAll('button')].find((b) => b.textContent === 'Move down').click();
    assert.deepEqual(
      readCommitmentState(storage).items.map((item) => item.id),
      ['b', 'a'],
    );
  } finally {
    api?.destroy();
    for (const [k, d] of old) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
});
