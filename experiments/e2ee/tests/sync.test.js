import test from 'node:test';
import assert from 'node:assert/strict';
import { Vault } from '../vault-crypto.js';
import { VaultSync, plannerSnapshot, sealSnapshot } from '../vault-sync.js';
import { prepareMigration, openEncryptedBackup } from '../migration.js';
const owner = '11111111-1111-4111-8111-111111111111',
  phrase = 'independent vault passphrase for fixtures';
const note = (id, text) => ({
  id,
  text,
  title: 'Private title',
  minute: 600,
  done: false,
  tags: ['project', 'event'],
  tasks: [{ start: 0, done: false }],
});
const initial = () =>
  plannerSnapshot({
    version: 1,
    days: { '2026-10-24': [note('first', 'A private task')] },
    settings: { interval: 60, clock: '12' },
  });
function storage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}
async function fixture() {
  const { vault, recoveryKey } = await Vault.create(owner, phrase);
  let row = {
    descriptor: vault.descriptor,
    payload: await sealSnapshot(vault, initial(), 1),
    revision: 1,
  };
  const transmitted = [];
  const cloud = {
    async load() {
      return structuredClone(row);
    },
    async save(payload, expected) {
      transmitted.push(JSON.stringify(payload));
      if (expected !== row.revision) return { conflict: true, revision: row.revision };
      row = { ...row, payload, revision: row.revision + 1 };
      return { conflict: false, revision: row.revision };
    },
  };
  return {
    vault,
    recoveryKey,
    cloud,
    transmitted,
    get row() {
      return row;
    },
    set row(next) {
      row = next;
    },
  };
}

test('two devices merge independent notes/settings, preserve conflicts and store only encrypted drafts', async () => {
  const f = await fixture(),
    disk = storage();
  const a = new VaultSync({ vault: f.vault, cloud: f.cloud, storage: disk, tabId: 'desktop' });
  const b = new VaultSync({
    vault: await Vault.unlock(f.row.descriptor, owner, phrase),
    cloud: f.cloud,
    storage: disk,
    tabId: 'phone',
  });
  await a.initialize();
  await b.initialize();
  const x = a.snapshot,
    y = b.snapshot;
  x.state.days['2026-10-24'].push(note('desktop', 'desktop change'));
  y.state.days['2026-10-24'].push(note('phone', 'phone change'));
  y.state.settings.interval = 30;
  await a.stage(x);
  await b.stage(y);
  await a.sync();
  await b.sync();
  await a.sync();
  assert.equal(a.snapshot.state.days['2026-10-24'].length, 3);
  assert.equal(a.snapshot.state.settings.interval, 30);
  const ac = a.snapshot,
    bc = b.snapshot;
  ac.state.days['2026-10-24'][0].text = 'first version';
  bc.state.days['2026-10-24'][0].text = 'second version';
  await a.stage(ac);
  await b.stage(bc);
  await a.sync();
  await b.sync();
  assert.equal(b.snapshot.state.days['2026-10-24'].length, 4);
  const wire = JSON.stringify([...disk.data.values(), ...f.transmitted]);
  for (const secret of [
    'Private title',
    'desktop change',
    'phone change',
    phrase,
    'first version',
    '2026-10-24',
  ])
    assert.ok(!wire.includes(secret));
  await a.lock();
  await b.lock();
});

test('an offline encrypted draft resumes after reload and sync does not discard in-flight edits', async () => {
  const f = await fixture(),
    disk = storage();
  const a = new VaultSync({ vault: f.vault, cloud: f.cloud, storage: disk, tabId: 'desktop' });
  await a.initialize();
  const next = a.snapshot;
  next.state.days['2026-10-24'][0].text = 'offline note';
  await a.stage(next);
  await a.lock();
  const b = new VaultSync({
    vault: await Vault.unlock(f.row.descriptor, owner, phrase),
    cloud: f.cloud,
    storage: disk,
    tabId: 'desktop',
  });
  await b.initialize();
  assert.equal(b.snapshot.state.days['2026-10-24'][0].text, 'offline note');
  assert.equal(b.pending, true);
  let release, started;
  const began = new Promise((resolve) => {
    started = resolve;
  });
  const save = f.cloud.save;
  f.cloud.save = async (...args) => {
    if (!release) {
      started();
      await new Promise((resolve) => {
        release = resolve;
      });
    }
    return save(...args);
  };
  const syncing = b.sync();
  await began;
  const latest = b.snapshot;
  latest.state.days['2026-10-24'][0].text = 'edited during save';
  await b.stage(latest);
  release();
  await syncing;
  assert.equal(b.pending, false);
  assert.equal((await b.snapshot).state.days['2026-10-24'][0].text, 'edited during save');
  await b.lock();
});

test('CAS collisions retry; rollback, missing vaults and tampering never fall back to plaintext', async () => {
  const f = await fixture(),
    disk = storage(),
    a = new VaultSync({ vault: f.vault, cloud: f.cloud, storage: disk, tabId: 'desktop' });
  await a.initialize();
  const oldPayload = structuredClone(f.row.payload);
  const next = a.snapshot;
  next.state.days['2026-10-24'][0].text = 'keep local';
  await a.stage(next);
  const save = f.cloud.save;
  let collided = false;
  f.cloud.save = async (...args) => {
    if (!collided) {
      collided = true;
      f.row = { ...f.row, revision: f.row.revision + 1 };
    }
    return save(...args);
  };
  await a.sync();
  assert.equal(a.pending, false);
  const good = structuredClone(f.row);
  f.row = { ...good, revision: 1 };
  await assert.rejects(a.sync(), /Older vault/);
  f.row = { ...good, revision: good.revision + 20, payload: oldPayload };
  await assert.rejects(a.sync(), /Older encrypted content/);
  f.row = {
    ...good,
    payload: {
      ...good.payload,
      data: (good.payload.data[0] === 'B' ? 'A' : 'B') + good.payload.data.slice(1),
    },
  };
  await assert.rejects(a.sync());
  assert.equal(a.snapshot.state.days['2026-10-24'][0].text, 'keep local');
  f.cloud.load = async () => null;
  await assert.rejects(a.sync(), /no plaintext fallback/);
  await a.lock();
});

test('migration verifies passphrase/recovery and requires a backup before any server mutation', async () => {
  const rows = [{ day: '2026-10-24', entries: [note('first', 'migration text')], revision: 7 }],
    raw = structuredClone(rows);
  const prepared = await prepareMigration({
    ownerId: owner,
    rows,
    deviceSettings: { interval: 60, clock: '12' },
    passphrase: phrase,
  });
  assert.deepEqual(rows, raw);
  const calls = [],
    cloud = {
      async migrate(...args) {
        calls.push(args);
        return { conflict: false, revision: 1 };
      },
    };
  await assert.rejects(prepared.commit(cloud), /Save the encrypted backup/);
  assert.equal(calls.length, 0);
  const restored = await openEncryptedBackup(
    prepared.backup,
    owner,
    prepared.recoveryKey,
    'recovery',
  );
  assert.deepEqual(restored.snapshot, prepared.snapshot);
  restored.vault.lock();
  await prepared.commit(cloud, { typedRecoveryKey: prepared.recoveryKey, backupSaved: true });
  assert.equal(calls.length, 1);
  assert.ok(!JSON.stringify(calls).includes('migration text'));
  await assert.rejects(
    prepared.commit(cloud, { typedRecoveryKey: prepared.recoveryKey, backupSaved: true }),
    /already committed/,
  );
  prepared.vault.lock();
});

test('storage failure is reported rather than claiming a durable save', async () => {
  const f = await fixture(),
    disk = storage(),
    a = new VaultSync({ vault: f.vault, cloud: f.cloud, storage: disk, tabId: 'desktop' });
  await a.initialize();
  disk.setItem = () => {
    throw new Error('Disk full');
  };
  const next = a.snapshot;
  next.state.days['2026-10-24'][0].text = 'not durable';
  await assert.rejects(a.stage(next), /Disk full/);
  await assert.rejects(a.lock(), /Disk full/);
  assert.equal(f.vault.locked, false);
  f.vault.lock();
});

test('a lost migration response is recovered only by decrypting the matching destination vault', async () => {
  const prepared = await prepareMigration({
    ownerId: owner,
    rows: [],
    deviceSettings: { interval: 60, clock: '12' },
    passphrase: phrase,
  });
  const cloud = {
    async migrate() {
      throw new Error('Response lost');
    },
    async load() {
      return {
        descriptor: prepared.backup.descriptor,
        payload: prepared.backup.payload,
        revision: 1,
      };
    },
  };
  assert.equal(
    (await prepared.commit(cloud, { typedRecoveryKey: prepared.recoveryKey, backupSaved: true }))
      .recovered,
    true,
  );
  prepared.vault.lock();
});

test('migration round-trips multiple notes, weekly notes, formatting, reports, attachment metadata and private settings', async () => {
  const startedAt = Date.UTC(2026, 9, 24, 10),
    endedAt = startedAt + 60000;
  const rich = {
    ...note('rich', 'Draft\nCall'),
    tags: ['project', 'event', 'custom:Secret project'],
    format: [
      {
        start: 0,
        end: 5,
        bold: true,
        italic: true,
        underline: true,
        highlight: 'blue',
        href: 'https://example.com/',
      },
    ],
    indents: [{ start: 6, level: 2 }],
    bullets: [{ start: 6 }],
    attachments: [
      { id: 'private-file', name: 'private-document.pdf', type: 'application/pdf', size: 5 },
    ],
    focusReports: [
      {
        id: 'focus',
        startedAt,
        endedAt,
        durationMs: 60000,
        mantra: 'Private mantra',
        logs: [{ date: '2026-10-24', minute: 600, text: 'Private interruption' }],
        reflection: {
          progress: 'Private progress',
          learned: 'Private lesson',
          next: 'Private next',
        },
      },
    ],
    guidedActivities: [
      {
        id: 'guided',
        completedAt: endedAt,
        answers: {
          work: 'Private work',
          health: 'Private health',
          learning: 'Private learning',
          relationships: 'Private relationship',
          spirituality: 'Private meaning',
        },
      },
    ],
  };
  const weekly = {
    id: 'weekly',
    text: 'Private week',
    title: 'Weekly direction',
    minute: 0,
    done: false,
    weekly: true,
  };
  const settings = {
    interval: 30,
    clock: '24',
    notifications: true,
    sound: true,
    availableHours: { from: 540, to: 1020, hideBefore: true, hideAfter: true },
    tags: { custom: ['custom:Secret project'], disabledDefaults: ['admin'] },
  };
  const rows = [
    { day: '2026-10-24', entries: [rich, note('second', 'Same interval')], revision: 12 },
    { day: '2026-10-25', entries: [weekly], revision: 3 },
    { day: '2026-10-26', entries: [], revision: 4 },
  ];
  const prepared = await prepareMigration({
    ownerId: owner,
    rows,
    preferences: { preferences: { ...settings, layout: 'founder' }, revision: 8 },
    passphrase: phrase,
  });
  const expected = plannerSnapshot(
    { version: 1, days: Object.fromEntries(rows.map((r) => [r.day, r.entries])), settings },
    'founder',
  );
  const restored = await openEncryptedBackup(
    JSON.parse(JSON.stringify(prepared.backup)),
    owner,
    prepared.recoveryKey,
    'recovery',
  );
  assert.deepEqual(restored.snapshot, expected);
  for (const hidden of [
    'Private',
    'private-document.pdf',
    'Secret project',
    '2026-10-24',
    'founder',
  ])
    assert.ok(!JSON.stringify(prepared.backup).includes(hidden));
  restored.vault.lock();
  prepared.vault.lock();
});
