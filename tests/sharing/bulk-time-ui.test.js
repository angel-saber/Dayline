import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setupBulk } from '../../dist/js/features/bulk/view.js';
import { bulkChange } from '../../dist/js/features/bulk/model.js';

test('bulk move dialog defaults to the same day and shifts selected times without closing on an invalid group', () => {
  const previous = new Map(
    ['window', 'document'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const { window, document } = parseHTML('<html><body></body></html>');
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.HTMLElement.prototype.setCustomValidity = function (value) {
    this.error = value;
  };
  window.HTMLElement.prototype.reportValidity = function () {
    return !this.error;
  };
  const date = '2026-10-26';
  let state = {
      settings: {},
      days: {
        [date]: [
          { id: 'a', minute: 540, text: 'First' },
          { id: 'b', minute: 630, text: 'Second' },
          { id: 'stay', minute: 660, text: 'Stay' },
        ],
      },
    },
    calls = 0;
  try {
    for (const [name, value] of Object.entries({ window, document }))
      Object.defineProperty(globalThis, name, { configurable: true, value });
    const bulk = setupBulk({
      getState: () => state,
      flush() {},
      refresh() {},
      visible: () => true,
      apply(keys, action) {
        calls++;
        state = { ...state, days: bulkChange(state.days, keys, action).days };
        return true;
      },
    });
    const controls = bulk.controls();
    document.body.append(controls);
    controls.querySelector('button').click();
    for (const note of state.days[date].slice(0, 2)) {
      const label = bulk.checkbox(date, note);
      document.body.append(label);
      const check = label.querySelector('input');
      check.checked = true;
      check.dispatchEvent(new window.Event('change'));
    }
    [...document.querySelectorAll('.bulk-bar button')]
      .find((button) => button.textContent === 'Move')
      .click();
    const dialog = document.querySelector('.bulk-dialog');
    assert.equal(dialog.querySelector('input[type=date]').value, date);
    assert.equal(dialog.querySelector('fieldset').hidden, true);
    const time = dialog.querySelector('input[type=time]');
    assert.equal(time.value, '09:00');
    const move = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Move notes',
    );
    time.value = '23:30';
    move.click();
    assert.equal(calls, 0);
    assert.equal(dialog.open, true);
    time.value = '11:00';
    time.dispatchEvent(new window.Event('input'));
    move.click();
    assert.equal(calls, 1);
    assert.deepEqual(
      state.days[date].map((note) => [note.id, note.minute]),
      [
        ['stay', 660],
        ['a', 660],
        ['b', 750],
      ],
    );
    assert.equal(document.querySelector('.bulk-dialog'), null);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
