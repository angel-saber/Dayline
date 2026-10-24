import test from 'node:test';
import assert from 'node:assert/strict';
import { needsWelcome } from '../../dist/js/features/onboarding/welcome.js';
const storage = (values) => ({ getItem: (key) => values[key] ?? null });
test('introduction never opens over sign-in, including during a session transition', () => {
  assert.equal(needsWelcome(storage({})), false);
  assert.equal(needsWelcome(storage({}), false, true), false);
  assert.equal(needsWelcome(storage({}), true, true), false);
  assert.equal(needsWelcome(storage({}), false, false), false);
});
test('both guest continuation and sign-in allow setup once the planner is visible', () => {
  for (const data of [
    {},
    { 'dayline.guest.v1': 'yes' },
    { 'dayline.v1': 'existing' },
    { 'dayline.appearance.v1': 'builder' },
  ]) {
    assert.equal(needsWelcome(storage(data), true, false), true);
    assert.equal(
      needsWelcome(storage({ ...data, 'dayline.welcome.v1': 'done' }), true, false),
      false,
    );
  }
});
test('storage errors still respect the sign-in page gate', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(needsWelcome(blocked, false, true), false);
  assert.equal(needsWelcome(blocked, true, true), false);
  assert.equal(needsWelcome(blocked, true, false), true);
});
