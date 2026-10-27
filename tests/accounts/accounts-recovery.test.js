import test from 'node:test';
import assert from 'node:assert/strict';
import { setupAccounts } from '../../dist/js/features/accounts/accounts.js';
import { cloudConfig } from '../../dist/js/features/accounts/config.js';
import { deviceNotes, preserveDeviceNotes } from '../../dist/js/features/accounts/device-notes.js';

function storage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    key: (i) => [...data.keys()][i],
    get length() {
      return data.size;
    },
  };
}
const guest = {
  version: 1,
  days: {
    '2026-10-24': [
      {
        id: 'desktop',
        title: 'My desktop plan',
        text: 'Keep this note',
        minute: 615,
        done: false,
        tags: ['project'],
      },
    ],
  },
  settings: { interval: 60, clock: '12' },
};

test('device checkpoints survive an empty guest copy and never replace the original', () => {
  const local = storage(),
    raw = JSON.stringify(guest);
  local.setItem('dayline.v1', raw);
  preserveDeviceNotes(local);
  assert.equal(local.getItem('dayline.v1'), raw);
  local.setItem('dayline.v1', JSON.stringify({ ...guest, days: {} }));
  preserveDeviceNotes(local);
  assert.equal(deviceNotes(local).days['2026-10-24'][0].id, 'desktop');
});

test('signing in with an empty account preserves guest notes and exposes deliberate recovery', async () => {
  const names = [
    'localStorage',
    'sessionStorage',
    'window',
    'document',
    'fetch',
    'setInterval',
    'clearInterval',
  ];
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const local = storage(),
    raw = JSON.stringify(guest),
    elements = new Map();
  local.setItem('dayline.v1', raw);
  class Element extends EventTarget {
    constructor() {
      super();
      this.hidden = false;
      this.value = '';
    }
    focus() {}
    closest() {
      return this;
    }
    showModal() {
      this.open = true;
    }
  }
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  let state = structuredClone(guest),
    flushes = 0;
  try {
    for (const [name, value] of Object.entries({
      localStorage: local,
      sessionStorage: storage(),
      window: Object.assign(new EventTarget(), {
        location: { href: 'https://example.com/Dayline/' },
        history: { replaceState() {} },
      }),
      document: { querySelector: element },
      fetch: async (_url, options) =>
        new Response(
          JSON.stringify(options.method === 'POST' ? { conflict: false, revision: 1 } : []),
        ),
      setInterval: () => 0,
      clearInterval: () => {},
    }))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    local.setItem(
      `dayline.session:${cloudConfig.url}`,
      JSON.stringify({
        user: { id: 'test-user', email: 'test@example.invalid' },
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_at: Date.now() / 1000 + 3600,
      }),
    );
    const api = setupAccounts({
      getState: () => state,
      setState: (next) => {
        state = next;
      },
      flushEditor: () => flushes++,
      toast() {},
      onStatus() {},
      downloadDeviceBackup: async () => {},
    });
    await api.retry();
    assert.ok(flushes > 0);
    assert.deepEqual(state.days, {});
    assert.equal(local.getItem('dayline.v1'), raw);
    assert.equal(element('#device-notes-notice').hidden, false);
    assert.match(element('#device-notes-message').textContent, /1 note is still saved/);
    const dialog = element('#migration-dialog');
    dialog.returnValue = 'import';
    dialog.dispatchEvent(new Event('close'));
    assert.equal(state.days['2026-10-24'][0].id, 'desktop');
    assert.equal(local.getItem('dayline.v1'), raw);
    assert.equal(element('#device-notes-notice').hidden, true);
    await api.retry();
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test('password form clears credentials on failure and signs in without replacing device notes', async () => {
  const names = [
    'localStorage',
    'sessionStorage',
    'window',
    'document',
    'fetch',
    'setInterval',
    'clearInterval',
  ];
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const local = storage(),
    raw = JSON.stringify(guest),
    elements = new Map(),
    calls = [];
  local.setItem('dayline.v1', raw);
  class Element extends EventTarget {
    constructor() {
      super();
      this.hidden = false;
      this.value = '';
    }
    focus() {}
    closest() {
      return this;
    }
    setAttribute(name, value) {
      this[name] = value;
    }
  }
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  let state = structuredClone(guest),
    reject = true;
  const settled = async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      if (!element('#auth-submit').disabled) return;
    }
    throw new Error('Sign-in did not finish');
  };
  try {
    for (const [name, value] of Object.entries({
      localStorage: local,
      sessionStorage: storage(),
      window: Object.assign(new EventTarget(), {
        location: { href: 'https://example.com/Dayline/' },
        history: { replaceState() {} },
      }),
      document: { querySelector: element },
      fetch: async (url, options) => {
        calls.push(url);
        if (url.includes('grant_type=password'))
          return reject
            ? new Response('{"msg":"Invalid login credentials"}', { status: 400 })
            : new Response(
                JSON.stringify({
                  user: { id: 'private-tester', email: 'tester@example.invalid' },
                  access_token: 'test-access',
                  refresh_token: 'test-refresh',
                  expires_in: 3600,
                }),
              );
        return new Response('[]');
      },
      setInterval: () => 0,
      clearInterval: () => {},
    }))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    setupAccounts({
      getState: () => state,
      setState: (next) => {
        state = next;
      },
      flushEditor() {},
      toast() {},
      onStatus() {},
    });
    element('#auth-method').onclick();
    assert.equal(element('#auth-password').required, true);
    assert.equal(element('#password-field').hidden, false);
    element('#auth-email').value = 'tester@example.invalid';
    element('#auth-password').value = 'fixture-password';
    element('#auth-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settled();
    assert.match(element('#auth-message').textContent, /Check your email and password/);
    assert.equal(element('#auth-password').value, '');
    assert.deepEqual(state.days, guest.days);
    assert.equal(local.getItem(`dayline.session:${cloudConfig.url}`), null);
    reject = false;
    element('#auth-password').value = 'fixture-password';
    element('#auth-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settled();
    assert.equal(element('#auth-view').hidden, true);
    assert.equal(element('#auth-password').value, '');
    assert.equal(local.getItem('dayline.v1'), raw);
    assert.equal(element('#device-notes-notice').hidden, false);
    assert.equal(calls.filter((url) => url.includes('grant_type=password')).length, 2);
    assert.ok(!calls.some((url) => /\/otp|\/signup/.test(url)));
    element('#auth-method').onclick();
    assert.equal(element('#auth-password').required, false);
    assert.equal(element('#auth-password').disabled, true);
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test('background account settings do not close an active Daily editor', async () => {
  const names = [
    'localStorage',
    'sessionStorage',
    'window',
    'document',
    'setInterval',
    'clearInterval',
  ];
  const saved = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const local = storage(),
    elements = new Map();
  local.setItem('dayline.v1', JSON.stringify(guest));
  class Element extends EventTarget {
    constructor() {
      super();
      this.hidden = false;
      this.value = '';
    }
    focus() {}
    closest() {
      return this;
    }
  }
  const element = (key) => {
    if (!elements.has(key)) elements.set(key, new Element());
    return elements.get(key);
  };
  let resolvePreferences;
  const waiting = new Promise((resolve) => {
    resolvePreferences = resolve;
  });
  let state = structuredClone(guest),
    flushes = 0,
    editing = false;
  const { sharedPreferences } = await import('../../dist/js/features/accounts/preferences-sync.js');
  try {
    const window = Object.assign(new EventTarget(), {
      location: { href: 'https://example.com/Dayline/' },
      history: { replaceState() {} },
    });
    for (const [name, value] of Object.entries({
      localStorage: local,
      sessionStorage: storage(),
      window,
      document: { querySelector: element },
      setInterval: () => 0,
      clearInterval: () => {},
    }))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    setupAccounts({
      getState: () => state,
      setState: (next) => {
        state = next;
      },
      flushEditor: () => {
        flushes++;
      },
      preserveDailyEditor: () => editing,
      toast() {},
      onStatus() {},
      connect: () => ({
        auth: {
          enabled: true,
          readSession: () => ({ user: { id: 'u', email: 'u@example.invalid' } }),
        },
        notes: { loadDays: async () => [], saveDay: async () => ({ revision: 1 }) },
        preferences: {
          loadPreferences: () => waiting,
          savePreferences: async () => ({ revision: 1 }),
        },
      }),
    });
    editing = true;
    const before = flushes;
    resolvePreferences({
      revision: 1,
      preferences: sharedPreferences({ ...guest.settings, interval: 30 }, 'zen'),
    });
    for (let i = 0; i < 20 && state.settings.interval !== 30; i++)
      await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state.settings.interval, 30);
    assert.equal(flushes, before);
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
