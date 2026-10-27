import test from 'node:test';
import assert from 'node:assert/strict';
import { canKeepEditor } from '../../dist/js/features/notes/editor-sync.js';
import { validateDay } from '../../dist/js/features/accounts/sync.js';

test('account updates keep an editor open only when its own note is unchanged', () => {
  const note = { id: 'active', minute: 600, text: 'My draft', done: false, tags: ['project'] };
  const previous = { '2026-10-27': [note] };
  const same = { '2026-10-27': [{ ...note }, { id: 'other', text: 'From phone' }] };
  assert.equal(canKeepEditor(previous, same, '2026-10-27', 'active'), true);
  assert.equal(canKeepEditor(previous, same, '2026-10-27', undefined), true);
  assert.equal(
    canKeepEditor(
      previous,
      { '2026-10-27': [{ ...note, text: 'Changed remotely' }] },
      '2026-10-27',
      'active',
    ),
    false,
  );
  assert.equal(canKeepEditor(previous, { '2026-10-27': [] }, '2026-10-27', 'active'), false);
  assert.equal(
    canKeepEditor({ '2026-10-27': [] }, { '2026-10-27': [] }, '2026-10-27', 'active'),
    true,
  );
  assert.equal(canKeepEditor({ '2026-10-27': [] }, previous, '2026-10-27', 'active'), false);
});

test('a freshly typed note stays open when sync returns the same normalized note', () => {
  const date = '2026-10-27';
  const newNote = {
    id: 'new-note',
    title: 'A new plan',
    text: 'Start here',
    minute: 615,
    done: false,
    format: [{ start: 0, end: 5, bold: true }],
    tasks: [],
    bullets: [],
    indents: [],
    noteType: '',
    tags: [],
    attachments: [],
    task: false,
  };
  const before = { [date]: [newNote] };
  const synced = { [date]: validateDay(date, [newNote]) };
  assert.notEqual(JSON.stringify(before[date][0]), JSON.stringify(synced[date][0]));
  assert.equal(canKeepEditor(before, synced, date, newNote.id), true);
  const changed = { [date]: [{ ...synced[date][0], text: 'Start somewhere else', format: [] }] };
  assert.equal(canKeepEditor(before, changed, date, newNote.id), false);
  assert.equal(canKeepEditor(before, { [date]: [] }, date, newNote.id), false);
  assert.equal(
    canKeepEditor(
      before,
      { [date]: [{ ...synced[date][0], tags: ['project'] }] },
      date,
      newNote.id,
    ),
    false,
  );
});
