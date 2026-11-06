import test from 'node:test';
import assert from 'node:assert/strict';
import { newCommitmentState } from '../../dist/js/features/commitments/game.js';
import {
  commitmentRecords,
  commitmentToken,
  writeCommitmentAccount,
  importDeviceCommitments,
} from '../../dist/js/features/commitments/account-state.js';
import { validState } from '../../dist/js/shared/storage.js';
import { SyncEngine } from '../../dist/js/features/accounts/sync.js';
const habit = {
  id: 'read',
  title: 'Read',
  minutes: 30,
  breakMinutes: 5,
  tags: ['personal', 'custom:Study'],
};
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i],
    get length() {
      return m.size;
    },
  };
};
test('commitment envelopes survive validation/backups, preserve ordinary notes, reject stale writes, and imports retain device data', () => {
  const device = newCommitmentState([habit]),
    untouched = structuredClone(device);
  const original = { '2026-11-06': [{ id: 'note', text: 'Keep this', minute: 540, done: false }] };
  const days = writeCommitmentAccount(
    original,
    device,
    commitmentToken(original),
    null,
    () => 'commitment-record',
  );
  assert.deepEqual(validState({ version: 1, days }).days, days);
  assert.deepEqual(original['2026-11-06'], days['2026-11-06']);
  assert.equal(commitmentRecords(days)[0].yearly.kind, 'commitments');
  assert.throws(() => writeCommitmentAccount(days, device, commitmentToken(original)), /changed/);
  const account = newCommitmentState([{ ...habit, title: 'Read something else' }]);
  const merged = importDeviceCommitments(account, device);
  assert.equal(merged.items.length, 2);
  assert.equal(merged.items[0].title, 'Read something else');
  assert.equal(importDeviceCommitments(merged, device).items.length, 2);
  assert.deepEqual(device, untouched);
});
test('two devices sync commitments, tags, marks and game state through the existing owner-scoped notes port; conflicts retain both versions', async () => {
  const accounts = new Map();
  function cloud(owner) {
    const rows = accounts.get(owner) || new Map();
    accounts.set(owner, rows);
    return {
      async loadDays() {
        return [...rows].map(([day, row]) => ({ day, ...structuredClone(row) }));
      },
      async saveDay(day, entries, expected) {
        const old = rows.get(day) || { entries: [], revision: 0 };
        if (expected !== old.revision) return { conflict: true, ...structuredClone(old) };
        const next = { entries: structuredClone(entries), revision: old.revision + 1 };
        rows.set(day, next);
        return { conflict: false, revision: next.revision };
      },
    };
  }
  const engine = (owner) =>
    new SyncEngine({
      cloud: cloud(owner),
      userId: owner,
      storage: memory(),
      cacheId: crypto.randomUUID(),
      onDays() {},
      onStatus() {},
      onConflict() {},
    });
  const a = engine('owner-a'),
    b = engine('owner-a'),
    other = engine('owner-b');
  try {
    await a.sync();
    let initial = newCommitmentState([habit]);
    initial.marks['2026-11-06'] = ['read'];
    initial.game.enabled = true;
    initial.game.nextDate = '2026-11-06';
    a.stage(writeCommitmentAccount(a.days, initial, commitmentToken(a.days), null, () => 'record'));
    await a.sync();
    await b.sync();
    assert.deepEqual(JSON.parse(commitmentRecords(b.days)[0].text).items, [habit]);
    assert.deepEqual(JSON.parse(commitmentRecords(b.days)[0].text).marks, initial.marks);
    await other.sync();
    assert.equal(commitmentRecords(other.days).length, 0);
    const first = JSON.parse(commitmentRecords(a.days)[0].text),
      second = JSON.parse(commitmentRecords(b.days)[0].text);
    first.items[0].minutes = 45;
    second.items[0].minutes = 60;
    a.stage(writeCommitmentAccount(a.days, first, commitmentToken(a.days)));
    b.stage(writeCommitmentAccount(b.days, second, commitmentToken(b.days)));
    await a.sync();
    await b.sync();
    await a.sync();
    const versions = commitmentRecords(a.days);
    assert.equal(versions.length, 2);
    assert.throws(
      () => writeCommitmentAccount(a.days, first, commitmentToken(a.days)),
      /Two saved/,
    );
    const resolved = writeCommitmentAccount(a.days, first, commitmentToken(a.days), versions[0].id);
    assert.equal(commitmentRecords(resolved).length, 1);
    assert.equal(commitmentRecords(resolved, true).length, 2);
  } finally {
    a.stop();
    b.stop();
    other.stop();
  }
});
