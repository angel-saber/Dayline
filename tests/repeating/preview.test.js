import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { openRepeatCycle } from '../../dist/js/features/repeating/view.js';

test('repeat preview flags holidays and submits individual skips and edits', () => {
  const saved = new Map(
    ['window', 'document'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const { window, document } = parseHTML('<html><body></body></html>');
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.HTMLElement.prototype.reportValidity = () => true;
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return (
        this.querySelector('option[selected]')?.value || this.querySelector('option')?.value || ''
      );
    },
    set(value) {
      for (const option of this.querySelectorAll('option'))
        option.toggleAttribute('selected', option.value === String(value));
    },
  });
  let submitted;
  try {
    for (const [key, value] of Object.entries({ window, document }))
      Object.defineProperty(globalThis, key, { configurable: true, value });
    const dialog = openRepeatCycle({
      source: '2026-11-24',
      note: { title: 'Practice', text: 'Task', minute: 615 },
      apply: (rule) => {
        submitted = rule;
        return true;
      },
    });
    assert.match(dialog.textContent, /Thanksgiving Day/);
    assert.match(dialog.textContent, /observed dates/);
    const row = dialog.querySelector('[data-occurrence="2026-11-26"]');
    const include = row.querySelector('input[type="checkbox"]');
    include.checked = false;
    include.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.match(row.querySelector('summary').textContent, /Skipped/);
    const title = dialog.querySelector('[aria-label="Title for occurrence 2026-11-27"]');
    title.value = 'A lighter practice';
    title.dispatchEvent(new window.Event('input', { bubbles: true }));
    const time = dialog.querySelector('[aria-label="Time for occurrence 2026-11-27"]');
    time.value = '12:30';
    time.dispatchEvent(new window.Event('input', { bubbles: true }));
    dialog
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(submitted.exceptions['2026-11-26'].skip, true);
    assert.equal(submitted.exceptions['2026-11-27'].title, 'A lighter practice');
    assert.equal(submitted.exceptions['2026-11-27'].minute, 750);
    assert.equal(document.querySelector('.repeat-dialog'), null);
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
