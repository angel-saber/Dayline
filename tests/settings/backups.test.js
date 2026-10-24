import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { setupBackups } from '../../dist/js/features/settings/backups.js';

test('extracted backups use current state, require restore confirmation and preserve corrupt device recovery bytes', async () => {
  const names = ['document', 'localStorage', 'URL', 'setTimeout'];
  const previous = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const { document, HTMLElement, Event } = parseHTML(
    readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8'),
  ).window;
  HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  const data = new Map(),
    local = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    },
    downloads = [],
    messages = [];
  const initial = {
    version: 1,
    days: { '2026-10-24': [{ id: 'old', minute: 600, text: 'Original note', done: false }] },
    settings: { interval: 60, clock: '12' },
  };
  let state = structuredClone(initial),
    restored = 0,
    cloudWrites = 0,
    failCloud = false;
  try {
    const values = {
      document,
      localStorage: local,
      URL: {
        createObjectURL(blob) {
          downloads.push(blob);
          return 'blob:test';
        },
        revokeObjectURL() {},
      },
      setTimeout: (fn) => {
        fn();
        return 0;
      },
    };
    for (const [name, value] of Object.entries(values))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    const backups = setupBackups({
      getState: () => state,
      getReadFailed: () => false,
      getAccounts: () => ({
        persist() {
          if (failCloud) throw new Error('Disk full');
          cloudWrites++;
        },
      }),
      flushEditor() {},
      toast: (message) => messages.push(message),
      onRestore(next) {
        state = next;
        restored++;
      },
    });
    state = {
      ...state,
      days: {
        '2026-10-24': [{ id: 'new', minute: 615, text: 'Latest account note', done: false }],
      },
    };
    await document.querySelector('#export').onclick();
    assert.equal(JSON.parse(await downloads[0].text()).days['2026-10-24'][0].id, 'new');
    const backup = {
      ...initial,
      settings: { ...initial.settings, notifications: true, sound: true },
    };
    const choose = () =>
      document.querySelector('#import-file').onchange({
        target: {
          files: [{ size: 100, text: async () => JSON.stringify(backup) }],
          value: 'file.json',
        },
      });
    const dialog = document.querySelector('#restore-dialog');
    await choose();
    assert.equal(dialog.open, true);
    assert.equal(restored, 0);
    dialog.returnValue = 'cancel';
    dialog.dispatchEvent(new Event('close'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(restored, 0);
    await choose();
    dialog.returnValue = 'restore';
    dialog.dispatchEvent(new Event('close'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(restored, 1);
    assert.equal(cloudWrites, 1);
    assert.deepEqual(state.days, initial.days);
    assert.equal(state.settings.notifications, false);
    assert.equal(state.settings.sound, false);
    failCloud = true;
    const before = structuredClone(state);
    await choose();
    dialog.dispatchEvent(new Event('close'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(state, before);
    assert.equal(restored, 1);
    assert.match(messages.at(-1), /Existing data was kept/);
    const raw = '{corrupt guest bytes';
    local.setItem('dayline.v1', raw);
    await backups.downloadDeviceBackup();
    assert.equal(await downloads.at(-1).text(), raw);
    assert.equal(local.getItem('dayline.v1'), raw);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
