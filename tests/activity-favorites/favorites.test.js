import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  setupActivityFavorites,
  validFavorites,
  FAVORITES_KEY,
} from '../../dist/js/features/activity-favorites/controller.js';

test('favorite preferences reject invalid data and deduplicate stable IDs', () => {
  assert.deepEqual(validFavorites(['breathing', 'visualization', 'breathing']), [
    'breathing',
    'visualization',
  ]);
  assert.throws(() => validFavorites({ breathing: true }));
  assert.throws(() => validFavorites(['https://example.com']));
  assert.throws(() => validFavorites(Array(51).fill('breathing')));
});
test('favorites create direct launch buttons, persist on reload, synchronize tabs, and survive failed writes', () => {
  const previous = new Map(
    ['window', 'document'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const { window, document } = parseHTML('<html><body><main></main></body></html>');
  for (const [key, value] of Object.entries({ window, document }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const values = new Map(),
    calls = [],
    messages = [];
  let fail = false;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (fail) throw Error('full');
      values.set(key, value);
    },
  };
  try {
    const api = setupActivityFavorites({
      root: document.querySelector('main'),
      storage,
      toast: (message) => messages.push(message),
    });
    const breathing = api.register('breathing', 'Guided Breathing', () => calls.push('breathing'));
    const visual = api.register('visualization', 'Guided Visualization', () =>
      calls.push('visualization'),
    );
    assert.equal(api.dock.hidden, true);
    breathing.click();
    visual.click();
    assert.equal(api.dock.hidden, false);
    assert.equal(api.dock.children.length, 2);
    assert.equal(breathing.getAttribute('aria-pressed'), 'true');
    api.dock.querySelector('[data-activity="breathing"]').click();
    assert.deepEqual(calls, ['breathing']);
    const modal = document.createElement('dialog');
    modal.setAttribute('open', '');
    document.body.append(modal);
    api.dock.querySelector('[data-activity="visualization"]').click();
    assert.deepEqual(calls, ['breathing']);
    assert.match(messages.pop(), /Close the current window/);
    modal.remove();
    const other = setupActivityFavorites({
      root: document.body,
      storage,
      toast: (message) => messages.push(message),
    });
    other.register('visualization', 'Guided Visualization', () => calls.push('reload'));
    assert.equal(other.dock.children.length, 1);
    other.dock.querySelector('button').click();
    assert.equal(calls.at(-1), 'reload');
    fail = true;
    visual.click();
    assert.equal(visual.getAttribute('aria-pressed'), 'true');
    assert.equal(api.dock.children.length, 2);
    assert.match(messages.pop(), /Could not save/);
    fail = false;
    breathing.click();
    assert.equal(api.dock.children.length, 1);
    storage.setItem(FAVORITES_KEY, '[]');
    const event = new window.Event('storage');
    Object.defineProperty(event, 'key', { value: FAVORITES_KEY });
    window.dispatchEvent(event);
    assert.equal(api.dock.hidden, true);
    assert.equal(other.dock.hidden, true);
    storage.setItem(FAVORITES_KEY, 'broken');
    api.refresh();
    assert.equal(api.dock.hidden, true);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
