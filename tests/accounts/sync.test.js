import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEntries, mergeGuestDays, clearSyncedDrafts, SyncEngine } from '../../dist/js/features/accounts/sync.js';
const day = '2026-10-19';
const note = (id, text = id, minute = 540) => ({ id, text, minute, done: false });
function storage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key), key: i => [...map.keys()][i], get length() { return map.size; } };
}
function server(initial = []) {
  let entries = structuredClone(initial), revision = initial.length ? 1 : 0;
  return {
    async loadDays() { return revision ? [{ day, entries: structuredClone(entries), revision }] : []; },
    async saveDay(key, value, expected) {
      if (expected !== revision) return { conflict: true, entries: structuredClone(entries), revision };
      entries = structuredClone(value); revision++; return { conflict: false, revision };
    },
    edit(value) { entries = structuredClone(value); revision++; },
    get entries() { return entries; },
  };
}
function engine(cloud, opts = {}) {
  return new SyncEngine({ cloud, userId: 'user-a', storage: storage(), onDays() {}, onStatus() {}, onConflict() {}, ...opts });
}

test('three-way merge retains independent additions and edits from two devices', () => {
  const base = [note('a'), note('b')];
  const local = [note('a', 'local'), note('b'), note('c')];
  const remote = [note('a'), note('b', 'remote'), note('d')];
  const result = mergeEntries(base, local, remote);
  assert.equal(result.conflicts, 0);
  assert.deepEqual(result.entries.map(e => [e.id, e.text]), [['a', 'local'], ['b', 'remote'], ['c', 'c'], ['d', 'd']]);
});
test('overlapping edits retain both complete versions', () => {
  const result = mergeEntries([note('a')], [note('a', 'local', 600)], [note('a', 'remote', 720)], () => 'conflict');
  assert.equal(result.conflicts, 1);
  assert.deepEqual(result.entries, [note('conflict', 'local', 600), note('a', 'remote', 720)]);
});
test('deletions propagate but never erase another device’s new edit', () => {
  assert.deepEqual(mergeEntries([note('a')], [], [note('a')]).entries, []);
  assert.deepEqual(mergeEntries([note('a')], [], [note('a', 'changed')]).entries, [note('a', 'changed')]);
  assert.deepEqual(mergeEntries([note('a')], [note('a', 'changed')], []).entries, [note('a', 'changed')]);
});
test('guest migration is additive and avoids exact duplicate imports', () => {
  const existing = { [day]: [note('a')] };
  const guest = { [day]: [note('a'), note('b')] };
  const once = mergeGuestDays(existing, guest);
  assert.deepEqual(mergeGuestDays(once, guest), once);
  assert.equal(existing[day].length, 1);
});
test('guest migration preserves an ID collision with different content', () => {
  const guest = { [day]: [note('a', 'guest')] };
  const days = mergeGuestDays({ [day]: [note('a', 'cloud')] }, guest, () => 'new');
  assert.deepEqual(days[day].map(e => e.text).sort(), ['cloud', 'guest']);
  assert.deepEqual(mergeGuestDays(days, guest), days);
});
test('two devices load the same account and sync additions, moves, completion and deletion', async () => {
  const cloud = server([note('a')]);
  const first = engine(cloud), second = engine(cloud);
  await first.sync(); await second.sync();
  first.stage({ [day]: [{ ...note('a', 'updated', 720), done: true }, note('b')] });
  await first.sync(); await second.sync();
  assert.deepEqual(second.days, first.days);
  second.stage({ [day]: [note('b')] }); await second.sync(); await first.sync();
  assert.deepEqual(first.days[day], [note('b')]);
  first.stop(); second.stop();
});
test('offline edits persist and sync after reconnection', async () => {
  const cloud = server([note('a')]), cache = storage();
  const first = engine(cloud, { storage: cache }); await first.sync();
  first.stage({ [day]: [note('a', 'offline')] });
  const original = cloud.loadDays; cloud.loadDays = async () => { throw new Error('offline'); };
  await assert.rejects(first.sync()); first.stop();
  const restored = engine(cloud, { storage: cache });
  assert.equal(restored.days[day][0].text, 'offline'); assert.equal(restored.pending, true);
  cloud.loadDays = original; await restored.sync();
  assert.equal(cloud.entries[0].text, 'offline'); assert.equal(restored.pending, false); restored.stop();
});
test('edits made during a save are not replaced by its response', async () => {
  const cloud = server([note('a')]), sync = engine(cloud); await sync.sync();
  const original = cloud.saveDay.bind(cloud); let first = true;
  cloud.saveDay = async (...args) => {
    const reply = await original(...args);
    if (first) { first = false; sync.stage({ [day]: [note('a', 'typed during save')] }); }
    return reply;
  };
  sync.stage({ [day]: [note('a', 'before save')] }); await sync.sync();
  assert.equal(cloud.entries[0].text, 'typed during save'); sync.stop();
});
test('server revision conflicts merge instead of blind overwrite', async () => {
  const cloud = server([note('a')]), sync = engine(cloud); await sync.sync();
  const original = cloud.saveDay.bind(cloud); let first = true;
  cloud.saveDay = async (...args) => {
    if (first) { first = false; cloud.edit([note('a'), note('remote')]); }
    return original(...args);
  };
  sync.stage({ [day]: [note('a'), note('local')] }); await sync.sync();
  assert.deepEqual(cloud.entries.map(e => e.id).sort(), ['a', 'local', 'remote']); sync.stop();
});
test('one account never loads another account’s cached drafts', async () => {
  const cache = storage(), cloud = server();
  const a = engine(cloud, { storage: cache }); a.stage({ [day]: [note('private')] });
  const b = engine(cloud, { storage: cache, userId: 'user-b' });
  assert.deepEqual(b.days, {}); a.stop(); b.stop();
});
test('stopped account ignores in-flight responses', async () => {
  let resolve; const cloud = { loadDays: () => new Promise(r => { resolve = r; }) };
  let published = 0; const sync = engine(cloud, { onDays: () => published++ });
  const pending = sync.sync(); sync.stop(); resolve([{ day, entries: [note('a')], revision: 1 }]);
  await pending; assert.equal(published, 0);
});
test('abandoned drafts are recovered after loading the latest remote state', async () => {
  const cache = storage(), cloud = server([note('a')]);
  cache.setItem('dayline.drafts:user-a:closed-tab', JSON.stringify({ [day]: { base: [note('a')], entries: [note('a', 'unsent')], revision: 1 } }));
  const sync = engine(cloud, { storage: cache, cacheId: 'new-tab' });
  await sync.sync();
  assert.equal(cloud.entries[0].text, 'unsent');
  assert.equal(cache.getItem('dayline.drafts:user-a:closed-tab'), null); sync.stop();
});
test('a live tab’s draft cache is not consumed by another tab', async () => {
  const cache = storage(), cloud = server([note('a')]);
  const key = 'dayline.drafts:user-a:live-tab';
  cache.setItem(key, JSON.stringify({ [day]: { base: [note('a')], entries: [note('a', 'typing')], revision: 1 } }));
  cache.setItem(`${key}:lease`, String(Date.now()));
  const sync = engine(cloud, { storage: cache }); await sync.sync();
  assert.equal(cloud.entries[0].text, 'a'); assert.ok(cache.getItem(key)); sync.stop();
});
test('replaying a conflicting draft does not duplicate a previously recovered version', () => {
  const base = [note('a')], local = [note('a', 'unsent')], remote = [note('a', 'other device')];
  const once = mergeEntries(base, local, remote).entries;
  const twice = mergeEntries(base, local, once).entries;
  assert.deepEqual(twice, once);
});
test('sign-out clears synced caches but keeps another tab’s unsent work and other accounts', () => {
  const cache = storage();
  cache.setItem('dayline.drafts:user-a:synced', JSON.stringify({ [day]: { entries: [note('a')], base: [note('a')], revision: 1 } }));
  cache.setItem('dayline.drafts:user-a:pending', JSON.stringify({ [day]: { entries: [note('a', 'unsent')], base: [note('a')], revision: 1 } }));
  cache.setItem('dayline.drafts:user-b:synced', JSON.stringify({ [day]: { entries: [note('b')], base: [note('b')], revision: 1 } }));
  clearSyncedDrafts(cache, 'dayline.drafts:user-a:');
  assert.equal(cache.getItem('dayline.drafts:user-a:synced'), null);
  assert.ok(cache.getItem('dayline.drafts:user-a:pending'));
  assert.ok(cache.getItem('dayline.drafts:user-b:synced'));
});
