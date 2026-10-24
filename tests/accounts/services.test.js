import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountServices } from '../../dist/js/features/accounts/services.js';
import { SyncEngine } from '../../dist/js/features/accounts/sync.js';
import {
  PreferencesSync,
  sharedPreferences,
} from '../../dist/js/features/accounts/preferences-sync.js';
import {
  AUTH_METHODS,
  validateAccountServices,
} from '../../dist/js/features/accounts/service-contract.js';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (i) => [...values.keys()][i],
    get length() {
      return values.size;
    },
  };
}
const id = '11111111-1111-4111-8111-111111111111';
const config = {
  provider: 'supabase',
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test',
};

test('provider ports preserve existing sessions and hide transport credentials from app callers', async () => {
  const local = storage(),
    sessionKey = `dayline.session:${config.url}`,
    requests = [];
  const raw = {
    user: { id, email: 'tester@example.invalid', app_metadata: { private: 'hidden' } },
    access_token: 'fixture-access',
    refresh_token: 'fixture-refresh',
    expires_at: Date.now() / 1000 + 3600,
  };
  const saved = JSON.stringify(raw);
  local.setItem(sessionKey, saved);
  const services = createAccountServices(config, {
    storage: local,
    fetcher: async (url, options) => {
      requests.push({ url, ...options });
      return new Response('{"conflict":false,"revision":1}');
    },
  });
  assert.equal(services.auth.sessionKey, sessionKey);
  assert.deepEqual(services.auth.readSession(), { user: { id, email: 'tester@example.invalid' } });
  assert.equal(local.getItem(sessionKey), saved);
  assert.equal(services.auth.storeSession, undefined);
  assert.equal(services.auth.signedRequest, undefined);
  assert.equal(services.notes.signInPassword, undefined);
  await services.notes.saveDay('2026-10-24', [], 0);
  assert.equal(requests[0].headers.Authorization, 'Bearer fixture-access');
  assert.deepEqual(JSON.parse(requests[0].body), {
    p_day: '2026-10-24',
    p_entries: [],
    p_expected_revision: 0,
  });
  assert.ok(!JSON.stringify(services.auth.readSession()).includes('fixture-'));
});

test('legacy configs and disabled accounts keep their behavior; unsupported providers never silently reroute', () => {
  const { provider, ...legacy } = config;
  assert.equal(createAccountServices(legacy, { storage: storage() }).provider, 'supabase');
  assert.equal(
    createAccountServices({ url: '', publishableKey: '' }, { storage: storage() }).auth.enabled,
    false,
  );
  for (const provider of ['other', 'constructor', '__proto__'])
    assert.throws(() => createAccountServices({ ...config, provider }), /not supported/);
  assert.throws(
    () =>
      createAccountServices({ ...config, publishableKey: 'sb_secret_no' }, { storage: storage() }),
    /publishable key/,
  );
  assert.throws(() => validateAccountServices({ auth: {} }), /incomplete auth/);
});

test('the same note/settings engines work with a non-Supabase provider without changing account or note IDs', async () => {
  // Disposable contract fake, not a deployable authentication implementation.
  const days = new Map();
  let preferences = null;
  const make = () => ({
    auth: {
      ...Object.fromEntries(AUTH_METHODS.map((name) => [name, async () => ({ user: { id } })])),
      readSession: () => ({ user: { id } }),
      enabled: true,
      sessionKey: 'test-provider-session',
    },
    notes: {
      async loadDays() {
        return [...days].map(([day, row]) => ({ day, ...structuredClone(row) }));
      },
      async saveDay(day, entries, expected) {
        const current = days.get(day) || { entries: [], revision: 0 };
        if (current.revision !== expected) return { conflict: true, ...structuredClone(current) };
        const revision = expected + 1;
        days.set(day, { entries: structuredClone(entries), revision });
        return { conflict: false, revision };
      },
    },
    preferences: {
      async loadPreferences() {
        return structuredClone(preferences);
      },
      async savePreferences(values, expected) {
        const current = preferences || { revision: 0 };
        if (current.revision !== expected) return { conflict: true, ...structuredClone(current) };
        preferences = { preferences: structuredClone(values), revision: expected + 1 };
        return { conflict: false, revision: expected + 1 };
      },
    },
  });
  const ports = createAccountServices({ provider: 'test-memory' }, {}, { 'test-memory': make });
  const local = storage();
  let visible = {};
  const notes = new SyncEngine({
    cloud: ports.notes,
    userId: id,
    storage: local,
    onDays: (value) => {
      visible = value;
    },
    onStatus() {},
    onConflict() {},
  });
  const prefs = new PreferencesSync({
    cloud: ports.preferences,
    userId: id,
    storage: local,
    initial: sharedPreferences({ interval: 60, clock: '12' }),
    onValues() {},
    onStatus() {},
  });
  try {
    await notes.sync();
    notes.stage({
      '2026-10-24': [{ id: 'keep-note-id', minute: 615, text: 'Portable note', done: false }],
    });
    await notes.sync();
    prefs.stage(sharedPreferences({ interval: 30, clock: '24' }, 'founder'), true);
    await prefs.sync();
    assert.equal(visible['2026-10-24'][0].id, 'keep-note-id');
    assert.equal((await ports.notes.loadDays())[0].entries[0].text, 'Portable note');
    assert.equal((await ports.preferences.loadPreferences()).preferences.layout, 'founder');
    assert.equal(ports.auth.readSession().user.id, id);
    assert.ok(notes.key.includes(id));
    assert.ok(prefs.key.includes(id));
  } finally {
    notes.stop();
    prefs.stop();
  }
});
