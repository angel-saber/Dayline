import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleBullets, validBullets } from '../../dist/js/features/notes/formatting/bullets.js';
import {
  replaceText,
  insertLineBreak,
  applyCheckbox,
} from '../../dist/js/features/notes/editor-state.js';
import { validState } from '../../dist/js/shared/storage.js';
import { moveToDay } from '../../dist/js/features/monthly/model.js';
const note = (text) => ({ text, format: [], tasks: [], bullets: [] });
test('bullets toggle the current line or selected lines without changing plain text', () => {
  let state = toggleBullets(note('One\nTwo\nThree'), 5);
  assert.deepEqual(state.bullets, [{ start: 4 }]);
  state = toggleBullets(state, 0, 8);
  assert.deepEqual(state.bullets, [{ start: 0 }, { start: 4 }]);
  state = toggleBullets(state, 0, 8);
  assert.deepEqual(state.bullets, []);
  assert.equal(state.text, 'One\nTwo\nThree');
});
test('Enter continues bullets and text styles, and toggling off stops continuation', () => {
  let state = toggleBullets(note('First'), 2);
  let next = insertLineBreak(state, 5, 5, { bold: true });
  assert.deepEqual(next.state.bullets, [{ start: 0 }, { start: 6 }]);
  state = replaceText(next.state, 6, 6, 'Next', next.typingStyle);
  assert.deepEqual(state.bullets, [{ start: 0 }, { start: 6 }]);
  state = toggleBullets(state, 7);
  next = insertLineBreak(state, 10, 10, { bold: true });
  assert.deepEqual(next.state.bullets, [{ start: 0 }]);
  assert.equal(next.typingStyle.bold, true);
});
test('line markers shift with edits and deleted list lines do not mark the following line', () => {
  let state = toggleBullets(note('Same\nSame\nPlain'), 5);
  state = replaceText(state, 0, 0, 'Intro\n');
  assert.deepEqual(state.bullets, [{ start: 11 }]);
  state = replaceText(state, 11, 16, '');
  assert.equal(state.text, 'Intro\nSame\nPlain');
  assert.deepEqual(state.bullets, []);
});
test('checkboxes and bullets replace each other on the chosen line', () => {
  let state = applyCheckbox(note('First\nSecond'), 2);
  state = toggleBullets(state, 2);
  assert.deepEqual(state.tasks, []);
  assert.deepEqual(state.bullets, [{ start: 0 }]);
  state = applyCheckbox(state, 2);
  assert.deepEqual(state.bullets, []);
  assert.deepEqual(state.tasks, [{ start: 0, done: false }]);
});
test('bullets survive backup validation and moving to another day; bad anchors are rejected', () => {
  const entry = {
    ...toggleBullets(note('One\nTwo'), 4),
    id: 'list',
    minute: 60,
    done: false,
    task: false,
  };
  const state = validState(
    JSON.parse(JSON.stringify({ version: 1, days: { '2026-10-22': [entry] } })),
  );
  const moved = moveToDay(state.days, '2026-10-22', 'list', '2026-10-23');
  assert.deepEqual(moved['2026-10-23'][0].bullets, [{ start: 4 }]);
  for (const bullets of [
    [{ start: 1 }],
    [{ start: 0 }, { start: 0 }],
    [{ start: -1 }],
    [{ start: 0, html: '<b>' }],
  ])
    assert.throws(() => validBullets(bullets, 'One\nTwo'));
});
