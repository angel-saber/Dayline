import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setupCommitments } from '../../dist/js/features/commitments/controller.js';
import {
  COMMITMENT_STATE_KEY,
  readCommitmentState,
} from '../../dist/js/features/commitments/game.js';
import { dayKey } from '../../dist/js/shared/dates.js';
function harness(run) {
  const { window, document } = parseHTML(
    '<html><body><button id="launch-commitments"></button></body></html>',
  );
  const keys = ['window', 'document'];
  const old = keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  Object.assign(globalThis, { window, document });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.focus = function () {};
  const values = new Map([
    ['dayline.daily-commitments.v1', JSON.stringify([{ id: 'a', title: 'Read', minutes: 30 }])],
  ]);
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  try {
    run({ window, document, storage });
  } finally {
    for (const [k, d] of old) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
}
test('duration presets choose optional breaks and a right swipe marks done without launching Focus or inventing recorded time', () =>
  harness(({ window, document, storage }) => {
    let launches = 0;
    const api = setupCommitments({
      getState: () => ({ days: {} }),
      startPractice: () => launches++,
      storage,
    });
    try {
      const dialog = document.querySelector('dialog');
      const click = (text) =>
        [...dialog.querySelectorAll('button')].find((b) => b.textContent === text).click();
      click('2 min');
      assert.equal(dialog.querySelector('[aria-label="Daily focus minutes"]').value, '2');
      assert.equal(dialog.querySelector('[aria-label="Commitment break minutes"]').value, '0');
      click('120 min');
      assert.equal(dialog.querySelector('[aria-label="Commitment break minutes"]').value, '15');
      const start = dialog.querySelector('.commitment-start');
      function pointer(type, x) {
        const e = new window.Event(type, { bubbles: true, cancelable: true });
        for (const [k, v] of Object.entries({ pointerId: 1, button: 0, clientX: x, clientY: 20 }))
          Object.defineProperty(e, k, { value: v });
        start.dispatchEvent(e);
      }
      pointer('pointerdown', 0);
      pointer('pointerup', 100);
      assert.equal(launches, 0);
      assert.deepEqual(readCommitmentState(storage).marks[dayKey()], ['a']);
      assert.match(dialog.textContent, /0 min recorded/);
      assert.match(dialog.textContent, /Done today/);
      click('Undo done');
      assert.deepEqual(readCommitmentState(storage).marks[dayKey()], []);
    } finally {
      api.destroy();
    }
  }));
test('empty interval suggestions deduplicate, ignore occupied intervals and Focus/breaks, and stop once all commitments are done', () =>
  harness(({ storage }) => {
    let clock = new Date();
    clock.setHours(9, 0, 0, 0);
    const date = dayKey(clock),
      notes = {};
    const state = { days: notes, settings: { interval: 60, notifications: true, sound: false } };
    const alerts = [];
    const api = setupCommitments({
      getState: () => state,
      startPractice() {},
      storage,
      now: () => clock,
      notify: (e, t) => alerts.push([e, t]),
    });
    try {
      api.checkPings();
      api.checkPings();
      assert.equal(alerts.length, 1);
      clock = new Date(clock);
      clock.setHours(10);
      notes[date] = [{ id: 'busy', minute: 600, text: 'Booked' }];
      api.checkPings();
      assert.equal(alerts.length, 1);
      clock.setHours(11);
      storage.setItem('dayline.focus.v1', 'active');
      api.checkPings();
      assert.equal(alerts.length, 1);
      storage.removeItem('dayline.focus.v1');
      storage.setItem('dayline.focus-break.v1', JSON.stringify({ until: clock.getTime() + 60000 }));
      api.checkPings();
      assert.equal(alerts.length, 1);
      storage.removeItem('dayline.focus-break.v1');
      api.checkPings();
      assert.equal(alerts.length, 2);
      clock.setHours(12);
      const saved = readCommitmentState(storage);
      saved.marks[date] = ['a'];
      storage.setItem(COMMITMENT_STATE_KEY, JSON.stringify(saved));
      api.checkPings();
      assert.equal(alerts.length, 2);
      clock.setHours(13);
      state.settings.notifications = false;
      api.checkPings();
      assert.equal(alerts.length, 2);
    } finally {
      api.destroy();
    }
  }));

test('a completed timed practice credits its start day across midnight without inventing a Focus report', () =>
  harness(({ storage }) => {
    const api = setupCommitments({ getState: () => ({ days: {} }), startPractice() {}, storage });
    try {
      const start = new Date(2026, 10, 5, 23, 50).getTime();
      assert.equal(api.recordPractice({ id: 'a', minutes: 30 }, start, start + 29 * 60000), false);
      assert.equal(api.recordPractice({ id: 'a', minutes: 30 }, start, start + 30 * 60000), true);
      assert.deepEqual(readCommitmentState(storage).marks['2026-11-05'], ['a']);
      assert.equal(api.recordPractice({ id: 'a', minutes: 30 }, start, start + 30 * 60000), true);
      assert.deepEqual(readCommitmentState(storage).marks['2026-11-05'], ['a']);
    } finally {
      api.destroy();
    }
  }));

test('over-budget additions show Awake Hours guidance and a direct settings route, while smaller edits remain possible', () =>
  harness(({ window, document, storage }) => {
    storage.setItem('dayline.awake-hours.v1', JSON.stringify({ from: 420, to: 451 }));
    let opened = 0;
    const api = setupCommitments({
      getState: () => ({ days: {} }),
      startPractice() {},
      storage,
      openAwakeSettings: () => opened++,
    });
    try {
      const dialog = document.querySelector('dialog'),
        name = dialog.querySelector('[aria-label="Habit name"]'),
        minutes = dialog.querySelector('[aria-label="Daily focus minutes"]'),
        rest = dialog.querySelector('[aria-label="Commitment break minutes"]');
      const click = (text) =>
        [...dialog.querySelectorAll('button')].find((b) => b.textContent === text).click();
      const submit = () =>
        dialog
          .querySelector('form')
          .dispatchEvent(new window.Event('submit', { cancelable: true }));
      name.value = 'Extra';
      minutes.value = '2';
      rest.value = '0';
      submit();
      assert.equal(storage.getItem(COMMITMENT_STATE_KEY), null);
      assert.match(dialog.textContent, /shorten existing commitments/);
      click('Adjust Awake Hours');
      assert.equal(opened, 1);
      click('Edit');
      minutes.value = '20';
      rest.value = '5';
      submit();
      assert.equal(readCommitmentState(storage).items[0].minutes, 20);
      name.value = 'Extra';
      minutes.value = '5';
      rest.value = '0';
      submit();
      assert.equal(readCommitmentState(storage).items.length, 2);
      name.value = 'Too much';
      minutes.value = '2';
      rest.value = '0';
      submit();
      assert.equal(readCommitmentState(storage).items.length, 2);
    } finally {
      api.destroy();
    }
  }));
