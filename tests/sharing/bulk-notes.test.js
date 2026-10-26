import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectionKey,
  selectedNotes,
  matchingNotes,
  scopeRange,
  bulkChange,
} from '../../dist/js/features/bulk/model.js';
import {
  categoryValue,
  categoryLabel,
  categoryOptions,
} from '../../dist/js/features/notes/note-types.js';
import { validState } from '../../dist/js/shared/storage.js';
import { shareNotesText } from '../../dist/js/features/sharing/share-note.js';
const note = (id, minute = 615, noteType = 'project') => ({
  id,
  minute,
  noteType,
  title: id,
  text: '☀️ Plan',
  done: false,
  task: false,
});
const days = {
  '2026-10-23': [note('a'), note('b', 645, 'admin')],
  '2026-10-25': [note('c', 600, 'custom:Film prep')],
  '2026-11-01': [note('d', 700, '')],
};
const keys = new Set([selectionKey('2026-10-23', 'a'), selectionKey('2026-10-25', 'c')]);
test('selection keys keep same IDs on different dates separate and selection spans pages', () => {
  const records = { ...days, '2026-10-24': [note('a')] };
  assert.equal(selectedNotes(records, keys).length, 2);
  assert.equal(
    selectedNotes(records, new Set([selectionKey('2026-10-24', 'a')]))[0].date,
    '2026-10-24',
  );
});
test('category selection respects calendar day, Sunday–Saturday week, and month boundaries', () => {
  assert.deepEqual(scopeRange('2026-10-23', 'week'), { start: '2026-10-18', end: '2026-10-24' });
  assert.deepEqual(scopeRange('2024-02-19', 'month'), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(
    matchingNotes(days, '2026-10-23', 'day', new Set(['project'])).map((i) => i.entry.id),
    ['a'],
  );
  assert.deepEqual(
    matchingNotes(days, '2026-10-23', 'week', new Set(['project', 'custom:Film prep'])).map(
      (i) => i.entry.id,
    ),
    ['a'],
  );
  assert.deepEqual(
    matchingNotes(days, '2026-10-23', 'month', new Set(['project', 'custom:Film prep'])).map(
      (i) => i.entry.id,
    ),
    ['a', 'c'],
  );
  assert.throws(() => scopeRange('2026-02-30', 'month'));
});
test('bulk moves preserve relative dates and exact times without altering occupied destination notes', () => {
  const original = structuredClone(days),
    result = bulkChange(days, keys, { kind: 'move', date: '2026-11-01', keepSpacing: true });
  assert.deepEqual(
    result.days['2026-11-01'].map((e) => e.id),
    ['a', 'd'],
  );
  assert.equal(result.days['2026-11-03'][0].id, 'c');
  assert.equal(result.days['2026-11-01'][0].minute, 615);
  assert.deepEqual(days, original);
  for (const [date, entries] of Object.entries(result.previous))
    assert.deepEqual(entries, original[date] || []);
});
test('bulk moves can collect all notes on one day and resolve ID collisions without losing notes', () => {
  const records = {
      '2026-10-23': [note('same')],
      '2026-10-24': [note('same')],
      '2026-10-25': [note('same')],
    },
    selected = new Set([selectionKey('2026-10-23', 'same'), selectionKey('2026-10-24', 'same')]);
  let id = 0;
  const result = bulkChange(
    records,
    selected,
    { kind: 'move', date: '2026-10-25', keepSpacing: false },
    () => `unique-${++id}`,
  );
  assert.equal(result.days['2026-10-25'].length, 3);
  assert.equal(new Set(result.days['2026-10-25'].map((e) => e.id)).size, 3);
});
test('bulk category and deletion affect only selected notes and expose full undo snapshots', () => {
  const tagged = bulkChange(days, keys, { kind: 'category', category: 'custom:Production' });
  assert.equal(tagged.days['2026-10-23'][0].noteType, 'custom:Production');
  assert.equal(tagged.days['2026-10-23'][1].noteType, 'admin');
  const deleted = bulkChange(days, keys, { kind: 'delete' });
  assert.deepEqual(
    deleted.days['2026-10-23'].map((e) => e.id),
    ['b'],
  );
  assert.equal(deleted.days['2026-10-25'].length, 0);
  assert.deepEqual({ ...deleted.days, ...deleted.previous }, days);
  assert.throws(() => bulkChange(days, new Set(), { kind: 'delete' }));
});
test('custom categories are reusable, validated, shared, and retained in backups', () => {
  assert.equal(categoryValue('  film   prep ', categoryOptions(days)), 'custom:Film prep');
  assert.equal(categoryValue('PROJECT'), 'project');
  assert.equal(categoryLabel('custom:Film prep'), 'Film prep');
  assert.equal(categoryLabel('constructor'), '');
  assert.deepEqual(validState({ version: 1, days }).days, days);
  assert.throws(() => categoryValue('x'.repeat(41)));
});
test('multi-note sharing sorts notes chronologically, groups dates, and includes one heading and footer', () => {
  const records = selectedNotes(days, keys).reverse(),
    text = shareNotesText(records, {}, '24', 'Production plan');
  assert.ok(text.startsWith('Production plan\n'));
  assert.ok(text.indexOf('10:15 — a') < text.indexOf('10:00 — c'));
  assert.ok(text.includes('Film prep'));
  assert.equal(text.match(/Planned with Dayline/g).length, 1);
  const plain = shareNotesText(records, { dateTime: false, type: false });
  assert.ok(!plain.includes('10:15'));
  assert.ok(!plain.includes('Film prep'));
});
test('multi-note share excludes all reports until explicitly chosen', () => {
  const entry = {
      ...note('private'),
      guidedActivities: [
        {
          completedAt: 1,
          answers: {
            work: 'Secret',
            health: 'Secret',
            learning: 'Secret',
            relationships: 'Secret',
            spirituality: 'Secret',
          },
        },
      ],
    },
    records = [{ date: '2026-10-23', entry }];
  assert.ok(!shareNotesText(records).includes('Secret'));
  assert.ok(shareNotesText(records, { guidedReports: true }).includes('Secret'));
});

test('bulk time shifts preserve exact gaps, same-interval notes, contents, occupied notes and undo', () => {
  const date = '2026-10-26';
  const original = {
    [date]: [note('a', 540), note('b', 555), note('c', 630), note('occupied', 660)],
  };
  const selection = new Set(['a', 'b', 'c'].map((id) => selectionKey(date, id)));
  const result = bulkChange(original, selection, {
    kind: 'move',
    date,
    minute: 660,
    keepSpacing: true,
  });
  const byId = new Map(result.days[date].map((entry) => [entry.id, entry]));
  assert.deepEqual(
    ['a', 'b', 'c'].map((id) => byId.get(id).minute),
    [660, 675, 750],
  );
  assert.equal(byId.get('occupied').minute, 660);
  for (const id of ['a', 'b', 'c'])
    assert.deepEqual(
      { ...byId.get(id), minute: original[date].find((entry) => entry.id === id).minute },
      original[date].find((entry) => entry.id === id),
    );
  assert.deepEqual({ ...result.days, ...result.previous }, original);
  assert.deepEqual(
    original[date].map((entry) => entry.minute),
    [540, 555, 630, 660],
  );
  assert.deepEqual(validState({ version: 1, days: result.days }).days, result.days);
});

test('bulk time shifts work earlier and across dates, and reject invalid or midnight-spilling groups atomically', () => {
  const records = {
    '2026-10-26': [note('a', 600), note('b', 660)],
    '2026-10-27': [note('c', 720)],
  };
  const selection = new Set(
    Object.entries(records).flatMap(([date, notes]) =>
      notes.map((entry) => selectionKey(date, entry.id)),
    ),
  );
  const result = bulkChange(records, selection, {
    kind: 'move',
    date: '2026-11-01',
    minute: 540,
    keepSpacing: true,
  });
  assert.deepEqual(
    result.days['2026-11-01'].map((entry) => entry.minute),
    [540, 600],
  );
  assert.equal(result.days['2026-11-02'][0].minute, 660);
  const before = structuredClone(records);
  for (const minute of [-1, 1440, NaN, 1.5, 1400])
    assert.throws(
      () => bulkChange(records, selection, { kind: 'move', date: '2026-10-26', minute }),
      /time|midnight/,
    );
  const uneven = { '2026-10-26': [note('early', 600)], '2026-10-27': [note('earlier', 100)] };
  assert.throws(
    () =>
      bulkChange(
        uneven,
        new Set([selectionKey('2026-10-26', 'early'), selectionKey('2026-10-27', 'earlier')]),
        { kind: 'move', date: '2026-10-26', minute: 0 },
      ),
    /midnight/,
  );
  assert.deepEqual(records, before);
});
