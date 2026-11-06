import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awakeMinutes,
  isAwake,
  validAwakeHours,
  commitmentAllocation,
  assertCommitmentBudget,
} from '../../dist/js/features/settings/awake-hours.js';
const timing = { autoBreak: true, breakMinutes: 5 };
test('awake hours are distinct from availability and support daytime, overnight and full-day ranges', () => {
  assert.equal(awakeMinutes({ from: 420, to: 1380 }), 960);
  assert.equal(awakeMinutes({ from: 1200, to: 480 }), 720);
  assert.equal(awakeMinutes({ from: 0, to: 0 }), 1440);
  assert.equal(isAwake(60, { from: 1200, to: 480 }), true);
  assert.equal(isAwake(800, { from: 1200, to: 480 }), false);
  assert.equal(isAwake(480, { from: 1200, to: 480 }), false);
  assert.throws(() => validAwakeHours({ from: -1, to: 480 }));
  assert.throws(() => validAwakeHours({ from: 0, to: 1440 }));
});
test('commitment additions include optional or default breaks, block over-budget increases and allow gradual reductions of existing over-budget lists', () => {
  const hours = { from: 600, to: 660 },
    a = { id: 'a', title: 'Read', minutes: 30, breakMinutes: 0 },
    b = { id: 'b', title: 'Learn', minutes: 25, breakMinutes: 5 };
  assert.equal(commitmentAllocation([a, b], timing), 60);
  assert.doesNotThrow(() => assertCommitmentBudget([a], [a, b], hours, timing));
  assert.throws(
    () =>
      assertCommitmentBudget(
        [a, b],
        [a, b, { id: 'c', title: 'Extra', minutes: 2, breakMinutes: 0 }],
        hours,
        timing,
      ),
    /Awake Hours/,
  );
  assert.equal(commitmentAllocation([{ ...a, breakMinutes: undefined }], timing), 35);
  const oversized = [{ ...a, minutes: 120 }];
  assert.doesNotThrow(() =>
    assertCommitmentBudget(oversized, [{ ...a, minutes: 90 }], hours, timing),
  );
  assert.throws(() => assertCommitmentBudget(oversized, [{ ...a, minutes: 125 }], hours, timing));
});
