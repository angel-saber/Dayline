import test from 'node:test';
import assert from 'node:assert/strict';
import { SyncEngine } from '../../dist/js/features/accounts/sync.js';
import {
  listItems,
  orderedItems,
  reorderList,
  itemKey,
} from '../../dist/js/features/lists/model.js';
const storage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i],
    get length() {
      return map.size;
    },
  };
};
test('saved list order and life associations travel through existing account sync without changing note times', async () => {
  const rows = new Map();
  const cloud = {
    async loadDays() {
      return [...rows].map(([day, row]) => ({ day, ...structuredClone(row) }));
    },
    async saveDay(day, entries, revision) {
      const old = rows.get(day) || { entries: [], revision: 0 };
      if (old.revision !== revision) return { conflict: true, ...structuredClone(old) };
      rows.set(day, { entries: structuredClone(entries), revision: revision + 1 });
      return { conflict: false, revision: revision + 1 };
    },
  };
  const client = (cacheId) =>
    new SyncEngine({
      cloud,
      userId: 'owner',
      cacheId,
      storage: storage(),
      onDays() {},
      onStatus() {},
      onConflict() {},
    });
  const a = client('desktop'),
    b = client('phone');
  try {
    await a.sync();
    a.stage({
      '2026-11-08': [
        { id: 'a', text: 'A', minute: 600, done: false, lifeSource: { group: 'health' } },
        { id: 'b', text: 'B', minute: 700, done: false },
      ],
    });
    await a.sync();
    await b.sync();
    const items = orderedItems(listItems(b.days, 'daily', '2026-11-08'), 'daily');
    b.stage(reorderList(b.days, items, 'daily', itemKey(items[1]), itemKey(items[0])));
    await b.sync();
    await a.sync();
    assert.deepEqual(
      orderedItems(listItems(a.days, 'daily', '2026-11-08'), 'daily').map((item) => item.entry.id),
      ['b', 'a'],
    );
    assert.deepEqual(
      a.days['2026-11-08'].map((item) => item.minute),
      [600, 700],
    );
    assert.deepEqual(a.days['2026-11-08'][0].lifeSource, { group: 'health' });
  } finally {
    a.stop();
    b.stop();
  }
});
