import test from 'node:test';
import assert from 'node:assert/strict';
import { snapDropMinute } from '../../dist/js/features/daily/drop-time.js';
import { dropEntry } from '../../dist/js/shared/schedule.js';
const rect = { top: 100, height: 120 };
test('drop zones snap to quarter hours and respect short/custom/midnight intervals', () => {
  assert.equal(snapDropMinute(420, 60, 100, rect), 420);
  assert.equal(snapDropMinute(420, 60, 132, rect), 435);
  assert.equal(snapDropMinute(420, 60, 160, rect), 450);
  assert.equal(snapDropMinute(420, 60, 215, rect), 465);
  assert.equal(snapDropMinute(427, 20, 180, rect), 435);
  assert.equal(snapDropMinute(427, 5, 220, rect), 427);
  assert.equal(snapDropMinute(1430, 60, 220, rect), 1430);
  assert.equal(snapDropMinute(-1, 60, 160, rect), -1);
});
test('exact note drops retain preview time within same interval and preserve swap semantics', () => {
  const entries = [
    { id: 'a', minute: 425, text: 'A' },
    { id: 'b', minute: 475, text: 'B' },
  ];
  assert.equal(dropEntry(entries, 'a', 450, 60, null, true).find((n) => n.id === 'a').minute, 450);
  const swap = dropEntry(entries, 'a', 475, 60, 'b', true);
  assert.equal(swap.find((n) => n.id === 'a').minute, 475);
  assert.equal(swap.find((n) => n.id === 'b').minute, 425);
  assert.equal(dropEntry(entries, 'a', 1440, 60, null, true), entries);
});
