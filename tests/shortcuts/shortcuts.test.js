import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setupShortcuts } from '../../dist/js/features/shortcuts/controller.js';
import {
  SHORTCUTS_KEY,
  shortcutValues,
  validShortcuts,
} from '../../dist/js/features/shortcuts/model.js';

test('custom shortcut validation rejects executable URLs, duplicates and oversized lists', () => {
  assert.deepEqual(shortcutValues(' My tool ', 'example.com'), {
    name: 'My tool',
    url: 'https://example.com/',
  });
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///tmp/test',
    'https://user:pass@example.com',
  ])
    assert.throws(() => shortcutValues('Tool', url));
  assert.throws(() => shortcutValues('', 'example.com'));
  assert.throws(() => shortcutValues('x'.repeat(61), 'example.com'));
  assert.throws(() =>
    validShortcuts([{ id: 'google-meet', name: 'Override', url: 'example.com' }]),
  );
  assert.throws(() =>
    validShortcuts(
      Array.from({ length: 31 }, (_, i) => ({ id: 'a' + i, name: 'Tool', url: 'example.com' })),
    ),
  );
});

test('panel adds, edits, restores and removes custom links; failed saves roll back and defaults need no credentials', () => {
  const previous = new Map(
    ['window', 'document'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const { window, document } = parseHTML(
    '<html><head></head><body><div id="planner"><button id="launch-shortcuts">Shortcuts</button></div></body></html>',
  );
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.HTMLElement.prototype.reportValidity = () => true;
  const data = new Map();
  let fail = false;
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (fail) throw new Error('Storage full');
      data.set(key, value);
    },
  };
  let panel;
  try {
    for (const [name, value] of Object.entries({ window, document }))
      Object.defineProperty(globalThis, name, { configurable: true, value });
    panel = setupShortcuts({ storage });
    const launch = document.querySelector('#launch-shortcuts');
    launch.click();
    const dialog = document.querySelector('.shortcuts-panel');
    assert.equal(dialog.open, true);
    assert.equal(launch.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(
      [...dialog.querySelectorAll('a')].map((link) => link.textContent),
      ['Open Google Meet', 'Open Google Drive'],
    );
    const submit = (label, href) => {
      document.querySelector('[aria-label="Shortcut name"]').value = label;
      document.querySelector('[aria-label="Shortcut web address"]').value = href;
      document
        .querySelector('.shortcut-form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    };
    submit('<b>My tool</b>', 'example.com');
    assert.equal(JSON.parse(data.get(SHORTCUTS_KEY))[0].url, 'https://example.com/');
    assert.equal(dialog.querySelector('b'), null);
    for (const link of dialog.querySelectorAll('a')) {
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
    }
    document.querySelector('[aria-label="Edit shortcut: <b>My tool</b>"]').click();
    submit('Edited tool', 'https://example.org/path');
    assert.equal(JSON.parse(data.get(SHORTCUTS_KEY)).length, 1);
    assert.equal(dialog.querySelectorAll('a')[2].textContent, 'Edited tool');
    fail = true;
    submit('Unsaved', 'example.net');
    assert.equal(dialog.querySelectorAll('a').length, 3);
    assert.match(dialog.textContent, /Could not save shortcuts/);
    document.querySelector('[aria-label="Remove shortcut: Edited tool"]').click();
    assert.equal(dialog.querySelectorAll('a').length, 3);
    fail = false;
    panel.destroy();
    panel = setupShortcuts({ storage });
    panel.open();
    assert.equal(document.querySelectorAll('.shortcuts-list a').length, 3);
    document.querySelector('[aria-label="Remove shortcut: Edited tool"]').click();
    assert.deepEqual(JSON.parse(data.get(SHORTCUTS_KEY)), []);
    window.dispatchEvent(new window.Event('dayline:account'));
    assert.equal(document.querySelector('.shortcuts-panel').open, false);
    document.querySelector('#planner').hidden = true;
    panel.open();
    assert.equal(document.querySelector('.shortcuts-panel').open, false);
    assert.equal(document.querySelectorAll('script,iframe').length, 0);
    assert.deepEqual([...data.keys()], [SHORTCUTS_KEY]);
  } finally {
    panel?.destroy();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
