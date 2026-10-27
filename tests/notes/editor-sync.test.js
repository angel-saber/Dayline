import test from 'node:test';
import assert from 'node:assert/strict';
import { canKeepEditor } from '../../dist/js/features/notes/editor-sync.js';

test('account updates keep an editor open only when its own note is unchanged', () => {
  const note = { id: 'active', minute: 600, text: 'My draft', tags: ['project'] };
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
});
