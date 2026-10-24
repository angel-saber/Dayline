import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTE_TYPES,
  validNoteType,
  matchesNoteType,
} from '../../dist/js/features/notes/note-types.js';
import { validState } from '../../dist/js/shared/storage.js';
import { moveToDay } from '../../dist/js/features/monthly/model.js';
import { moveEntry } from '../../dist/js/shared/schedule.js';
import { mergeEntries } from '../../dist/js/features/accounts/sync.js';
const entry = { id: 'tagged', minute: 60, text: 'A note', title: 'Plan', done: false };
test('the four agreed types and None are optional; unknown values are rejected', () => {
  assert.deepEqual(Object.keys(NOTE_TYPES), ['project', 'admin', 'event', 'personal']);
  for (const type of ['', ...Object.keys(NOTE_TYPES)]) assert.equal(validNoteType(type), type);
  for (const type of ['deadline', 'custom', 'constructor', null, {}, 42])
    assert.throws(() => validNoteType(type));
});
test('legacy untyped notes and typed notes survive backup validation', () => {
  const legacy = validState({ version: 1, days: { '2026-10-22': [entry] } });
  assert.equal(Object.hasOwn(legacy.days['2026-10-22'][0], 'noteType'), false);
  for (const noteType of ['', ...Object.keys(NOTE_TYPES)]) {
    const restored = validState(
      JSON.parse(JSON.stringify({ version: 1, days: { '2026-10-22': [{ ...entry, noteType }] } })),
    );
    assert.equal(restored.days['2026-10-22'][0].noteType, noteType);
  }
  assert.throws(() =>
    validState({ version: 1, days: { '2026-10-22': [{ ...entry, noteType: 'deadline' }] } }),
  );
});
test('Monthly filters combine selected types and can include or exclude untyped notes', () => {
  const notes = [
    entry,
    { ...entry, id: 'project', noteType: 'project' },
    { ...entry, id: 'event', noteType: 'event' },
    { ...entry, id: 'none', noteType: '' },
  ];
  assert.deepEqual(
    notes.filter((e) => matchesNoteType(e, new Set(['project', 'event']))).map((e) => e.id),
    ['project', 'event'],
  );
  assert.deepEqual(
    notes.filter((e) => matchesNoteType(e, new Set(['none']))).map((e) => e.id),
    ['tagged', 'none'],
  );
  assert.equal(notes.filter((e) => matchesNoteType(e, new Set())).length, 0);
  assert.equal(
    notes.filter((e) => matchesNoteType(e, new Set(['none', ...Object.keys(NOTE_TYPES)]))).length,
    4,
  );
});
test('types remain attached when moving between intervals, days, and merging independent changes', () => {
  const tagged = { ...entry, noteType: 'personal' },
    days = { '2026-10-22': [tagged] };
  assert.equal(moveEntry([tagged], 'tagged', 120, 60)[0].noteType, 'personal');
  assert.equal(
    moveToDay(days, '2026-10-22', 'tagged', '2026-10-23')['2026-10-23'][0].noteType,
    'personal',
  );
  assert.equal(
    mergeEntries([entry], [{ ...entry, noteType: 'admin' }], [entry]).entries[0].noteType,
    'admin',
  );
});
