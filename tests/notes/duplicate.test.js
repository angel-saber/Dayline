import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateNote } from '../../dist/js/features/notes/duplicate.js';
import { changeWeekly } from '../../dist/js/features/monthly/weekly-model.js';
import { validState } from '../../dist/js/shared/storage.js';

test('duplicate preserves content, time, tags and file references with independent formatting and fresh completion/history', () => {
  const original = {
    id: 'a',
    minute: 615,
    title: 'Plan',
    text: 'Task',
    done: true,
    tags: ['project', 'event'],
    format: [{ start: 0, end: 4, bold: true }],
    tasks: [{ start: 0, done: true }],
    attachments: [{ id: 'file-1', name: 'plan.pdf', type: 'application/pdf', size: 12 }],
    focusReports: [{ old: true }],
    guidedActivities: [{ old: true }],
  };
  const before = structuredClone(original);
  const result = duplicateNote([original, { id: 'b', minute: 615 }], 'a', () => 'copy');
  assert.deepEqual(
    result.notes.map((note) => note.id),
    ['a', 'copy', 'b'],
  );
  const copy = result.notes[1];
  assert.equal(copy.minute, 615);
  assert.equal(copy.title, original.title);
  assert.deepEqual(copy.tags, original.tags);
  assert.deepEqual(copy.attachments, original.attachments);
  assert.notEqual(copy.attachments[0], original.attachments[0]);
  assert.equal(copy.done, false);
  assert.equal(copy.tasks[0].done, false);
  assert.equal(copy.focusReports, undefined);
  assert.equal(copy.guidedActivities, undefined);
  copy.format[0].bold = false;
  assert.deepEqual(original, before);
  const restored = validState({ version: 1, days: { '2026-10-26': [copy] } });
  assert.equal(restored.days['2026-10-26'][0].id, 'copy');
  assert.throws(() => duplicateNote([original], 'missing'));
  assert.throws(() => duplicateNote([original], 'a', () => 'a'));
});

test('weekly duplication stays undated in the same week and records an undo snapshot', () => {
  const days = {
    '2026-10-25': [{ id: 'weekly', weekly: true, minute: 0, title: 'Week', text: '', done: true }],
  };
  const result = changeWeekly(days, '2026-10-26', 'weekly', { kind: 'duplicate' }, () => 'new');
  assert.equal(result.id, 'new');
  assert.equal(result.days['2026-10-25'][1].weekly, true);
  assert.equal(result.days['2026-10-25'][1].done, false);
  assert.deepEqual(result.previous['2026-10-25'], days['2026-10-25']);
  assert.equal(days['2026-10-25'].length, 1);
});
