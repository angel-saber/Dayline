import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyIndent,
  indentLevel,
  MAX_INDENT,
  validIndents,
} from '../../dist/js/features/notes/formatting/indents.js';
import {
  replaceText,
  insertLineBreak,
  applyCheckbox,
  recognizeBullets,
} from '../../dist/js/features/notes/editor-state.js';
import { validState } from '../../dist/js/shared/storage.js';
import { shareNoteText } from '../../dist/js/features/sharing/share-note.js';
const note = (text) => ({ text, format: [], tasks: [], bullets: [], indents: [] });
test('indent/outdent affect the current or selected lines, excluding an unselected line at the range end', () => {
  const state = note('First\nSecond\nThird');
  let next = applyIndent(state, 0, 13);
  assert.deepEqual(next.indents, [
    { start: 0, level: 1 },
    { start: 6, level: 1 },
  ]);
  next = applyIndent(next, 7);
  assert.equal(indentLevel(next.indents, 6), 2);
  assert.equal(indentLevel(next.indents, 13), 0);
  next = applyIndent(next, 0, 13, -1);
  assert.deepEqual(next.indents, [{ start: 6, level: 1 }]);
  assert.equal(state.text, next.text);
  assert.deepEqual(state.indents, []);
});
test('indentation caps safely, includes blank lines, and does not change checkbox completion or formatting', () => {
  let state = {
    ...note('One\n\nThree'),
    tasks: [{ start: 0, done: true }],
    format: [{ start: 0, end: 3, bold: true }],
  };
  for (let i = 0; i < MAX_INDENT + 2; i++) state = applyIndent(state, 0, 5);
  assert.deepEqual(state.indents, [
    { start: 0, level: MAX_INDENT },
    { start: 4, level: MAX_INDENT },
  ]);
  assert.equal(state.tasks[0].done, true);
  assert.equal(state.format[0].bold, true);
  assert.equal(applyIndent(state, 0, 5), state);
  assert.equal(applyIndent(note(''), 0, 0, -1).indents.length, 0);
});
test('Enter inherits indentation alongside bullets and checkboxes, and following edits preserve line anchors', () => {
  let state = { ...applyIndent(note('First\nLater'), 0), bullets: [{ start: 0 }] };
  let next = insertLineBreak(state, 5, 5);
  assert.deepEqual(next.state.indents, [
    { start: 0, level: 1 },
    { start: 6, level: 1 },
  ]);
  assert.deepEqual(next.state.bullets, [{ start: 0 }, { start: 6 }]);
  state = applyCheckbox(next.state, 6);
  next = insertLineBreak(state, 6, 6);
  assert.equal(indentLevel(next.state.indents, 7), 1);
  assert.ok(next.state.tasks.some((task) => task.start === 7 && !task.done));
  state = replaceText(applyIndent(note('First\nLater'), 6), 0, 0, 'Intro\n');
  assert.deepEqual(state.indents, [{ start: 12, level: 1 }]);
  state = replaceText(state, 12, state.text.length, '');
  assert.deepEqual(state.indents, [{ start: 12, level: 1 }]);
  const bullet = recognizeBullets(
    { ...note('- Task'), indents: [{ start: 0, level: 2 }] },
    0,
    2,
  ).state;
  assert.deepEqual(bullet.indents, [{ start: 0, level: 2 }]);
});
test('deleting an entire indented line never transfers indentation to the following line', () => {
  const state = applyIndent(note('First\nSecond\nThird'), 6);
  const next = replaceText(state, 6, 13, '');
  assert.equal(next.text, 'First\nThird');
  assert.deepEqual(next.indents, []);
});
test('backups validate indentation and sharing expresses it as readable spaces before bullets and tasks', () => {
  const entry = {
    ...note('Heading\nItem\nTask'),
    id: 'n',
    minute: 600,
    done: false,
    indents: [
      { start: 8, level: 1 },
      { start: 13, level: 2 },
    ],
    bullets: [{ start: 8 }],
    tasks: [{ start: 13, done: true }],
  };
  const restored = validState(
    JSON.parse(JSON.stringify({ version: 1, days: { '2026-10-23': [entry] } })),
  ).days['2026-10-23'][0];
  assert.deepEqual(restored.indents, entry.indents);
  const text = shareNoteText(restored, '2026-10-23');
  assert.ok(text.includes('\n  • Item\n    ☑ Task'));
  for (const value of [
    [{ start: 1, level: 1 }],
    [{ start: 0, level: 9 }],
    [{ start: 0, level: 0 }],
    [
      { start: 0, level: 1 },
      { start: 0, level: 2 },
    ],
    [{ start: 0, level: 1, html: 'bad' }],
  ])
    assert.throws(() => validIndents(value, entry.text));
});
