import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderCommitments } from '../../dist/js/features/commitments/reorder.js';
import {
  newCommitmentState,
  validCommitmentState,
} from '../../dist/js/features/commitments/game.js';
const items = ['a', 'b', 'c'].map((id) => ({
  id,
  title: id,
  minutes: 30,
  body: 'Details ' + id,
  tags: ['personal'],
}));
test('reorder inserts before and after either direction without changing commitment data', () => {
  for (const [id, target, after, expected] of [
    ['a', 'c', true, ['b', 'c', 'a']],
    ['c', 'a', false, ['c', 'a', 'b']],
    ['a', 'b', false, ['a', 'b', 'c']],
    ['b', 'a', false, ['b', 'a', 'c']],
  ]) {
    const next = reorderCommitments(items, id, target, after);
    assert.deepEqual(
      next.map((i) => i.id),
      expected,
    );
    for (const item of next)
      assert.equal(
        item,
        items.find((i) => i.id === item.id),
      );
    assert.deepEqual(
      validCommitmentState(JSON.parse(JSON.stringify(newCommitmentState(next)))).items,
      next,
    );
  }
  assert.equal(reorderCommitments(items, 'a', 'a'), items);
  assert.equal(reorderCommitments(items, 'missing', 'b'), items);
  assert.deepEqual(
    items.map((i) => i.id),
    ['a', 'b', 'c'],
  );
});
