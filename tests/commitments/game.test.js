import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newCommitmentState,
  evaluateGame,
  toggleGame,
  acknowledgePenalty,
  changeItems,
  commitmentDone,
  validCommitmentState,
  readCommitmentState,
  COMMITMENT_STATE_KEY,
  DURATION_PRESETS,
  suggestedPracticeBreak,
} from '../../dist/js/features/commitments/game.js';
import { offsetDay } from '../../dist/js/shared/dates.js';
const habits = [
  { id: 'a', title: 'Read', minutes: 30 },
  { id: 'b', title: 'Exercise', minutes: 10 },
  { id: 'c', title: 'Learn', minutes: 5 },
];
test('game starts at three or existing count; seven consecutive complete days unlock one slot', () => {
  let s = toggleGame(newCommitmentState(habits), true, '2026-01-01');
  assert.equal(s.game.cap, 3);
  assert.throws(
    () => changeItems(s, [...habits, { id: 'd', title: 'Write', minutes: 15 }], '2026-01-01'),
    /week/,
  );
  for (let i = 0; i < 7; i++) s.marks[offsetDay('2026-01-01', i)] = habits.map((h) => h.id);
  const original = structuredClone(s);
  s = evaluateGame(s, {}, '2026-01-08');
  assert.equal(s.game.cap, 4);
  assert.equal(s.game.wins, 0);
  assert.deepEqual(original.game.wins, 0);
  assert.equal(
    changeItems(s, [...habits, { id: 'd', title: 'Write', minutes: 15 }], '2026-01-08').items
      .length,
    4,
  );
  const five = [
    ...habits,
    { id: 'd', title: 'x', minutes: 2 },
    { id: 'e', title: 'y', minutes: 2 },
  ];
  assert.equal(toggleGame(newCommitmentState(five), true, '2026-01-01').game.cap, 5);
});
test('two missed days create one acknowledged deletion; long absences never stack adjustments', () => {
  let s = toggleGame(newCommitmentState(habits), true, '2026-01-01');
  s = evaluateGame(s, {}, '2026-01-05');
  assert.equal(s.game.pending, '2026-01-02');
  assert.equal(s.items.length, 3);
  const pending = structuredClone(s);
  assert.deepEqual(evaluateGame(s, {}, '2026-06-01'), pending);
  s = acknowledgePenalty(s, 'b', '2026-01-05');
  assert.equal(s.items.length, 2);
  assert.equal(s.game.cap, 2);
  assert.equal(s.game.nextDate, '2026-01-05');
  assert.equal(s.game.pending, null);
  s = evaluateGame(s, {}, '2026-01-06');
  assert.equal(s.game.pending, null);
  s = evaluateGame(s, {}, '2026-01-07');
  assert.ok(s.game.pending);
  assert.throws(() => acknowledgePenalty(s, 'invalid', '2026-01-07'));
});
test('one remaining habit reduces by five to a two-minute floor, one acknowledgment at a time', () => {
  let s = toggleGame(
    newCommitmentState([{ id: 'a', title: 'Read', minutes: 7 }]),
    true,
    '2026-01-01',
  );
  s = evaluateGame(s, {}, '2026-01-10');
  assert.equal(s.items[0].minutes, 7);
  s = acknowledgePenalty(s, null, '2026-01-10');
  assert.equal(s.items[0].minutes, 2);
  assert.equal(s.game.cap, 3);
  s = evaluateGame(s, {}, '2026-01-20');
  s = acknowledgePenalty(s, null, '2026-01-20');
  assert.equal(s.items[0].minutes, 2);
  assert.deepEqual(validCommitmentState(s), s);
});
test('a completed day resets misses; incomplete days reset week progress, and snapshots retain historical goals', () => {
  let s = toggleGame(newCommitmentState([habits[0]]), true, '2026-01-01');
  s.marks['2026-01-02'] = ['a'];
  s = evaluateGame(s, {}, '2026-01-03');
  assert.equal(s.game.misses, 0);
  assert.equal(s.game.wins, 1);
  s = evaluateGame(s, {}, '2026-01-04');
  assert.equal(s.game.wins, 0);
  assert.equal(s.game.misses, 1);
  assert.equal(commitmentDone(s, habits[0], '2026-01-02', {}), true);
  assert.equal(commitmentDone(s, habits[0], '2026-01-03', {}), false);
  assert.equal(toggleGame(s, false, '2026-01-04').game.enabled, false);
  assert.throws(() => validCommitmentState({ ...s, marks: { bad: ['a'] } }));
});
test('legacy habits remain intact and duration suggestions support every requested preset', () => {
  const values = new Map([['dayline.daily-commitments.v1', JSON.stringify(habits)]]);
  const storage = { getItem: (k) => values.get(k) || null };
  assert.deepEqual(readCommitmentState(storage).items, habits);
  assert.equal(values.has(COMMITMENT_STATE_KEY), false);
  assert.deepEqual(DURATION_PRESETS, [2, 5, 10, 15, 25, 30, 45, 60, 90, 120]);
  assert.equal(suggestedPracticeBreak(2), 0);
  assert.equal(suggestedPracticeBreak(30), 5);
  assert.equal(suggestedPracticeBreak(60), 10);
  assert.equal(suggestedPracticeBreak(120), 15);
});

test('one confirmed deletion does not wipe multiple unused earned slots', () => {
  let s = toggleGame(newCommitmentState(habits), true, '2026-01-01');
  s.game.cap = 6;
  s = evaluateGame(s, {}, '2026-01-05');
  s = acknowledgePenalty(s, 'a', '2026-01-05');
  assert.equal(s.game.cap, 5);
  assert.equal(s.items.length, 2);
});
