import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITIES } from '../../dist/js/personalities/index.js';
import {
  DEFAULT_ACCESS_POLICY,
  PAYMENTS_ENABLED,
  PERSONALITY_IDS,
  validateAccessPolicy,
  evaluatePersonalityAccess,
  exportAccessLedger,
  readAccessLedger,
} from '../../dist/js/features/access/policy.js';
const accountId = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
const grant = {
  id: '33333333-3333-4333-8333-333333333333',
  accountId,
  featureKey: 'personality.builder',
  productKey: 'builder-pack',
  status: 'active',
  source: 'purchase',
  validFrom: 100,
  validUntil: 200,
};
function paidPolicy() {
  const value = structuredClone(DEFAULT_ACCESS_POLICY);
  value.personalities.builder = { requirement: 'purchase', productKey: 'builder-pack' };
  return value;
}

test('every current personality remains free for guests and accounts; payments stay disabled', () => {
  assert.equal(PAYMENTS_ENABLED, false);
  assert.deepEqual(PERSONALITY_IDS, Object.keys(PERSONALITIES));
  for (const personalityId of PERSONALITY_IDS)
    for (const id of [null, accountId])
      assert.deepEqual(evaluatePersonalityAccess({ personalityId, accountId: id }), {
        allowed: true,
        reason: 'free',
      });
});
test('future policy evaluation respects account ownership, revocation and exact validity boundaries', () => {
  const check = (overrides = {}) =>
    evaluatePersonalityAccess({
      personalityId: 'builder',
      policy: paidPolicy(),
      accountId,
      verifiedGrants: [grant],
      now: 100,
      ...overrides,
    });
  assert.equal(check().allowed, true);
  assert.equal(check({ now: 199 }).allowed, true);
  assert.equal(check({ now: 200 }).allowed, false);
  assert.equal(check({ accountId: other }).allowed, false);
  assert.equal(check({ accountId: null }).reason, 'sign-in-required');
  assert.equal(check({ verifiedGrants: [{ ...grant, status: 'revoked' }] }).allowed, false);
  assert.equal(
    check({ verifiedGrants: [{ ...grant, featureKey: 'personality.founder' }] }).allowed,
    false,
  );
  assert.equal(check({ personalityId: 'constructor' }).allowed, false);
});
test('access records round-trip without processor-specific fields and reject malformed or duplicate grants', () => {
  const archive = exportAccessLedger([grant]);
  assert.deepEqual(readAccessLedger(JSON.parse(JSON.stringify(archive))), archive);
  assert.throws(() => exportAccessLedger([grant, grant]), /duplicate/);
  assert.throws(() => exportAccessLedger([{ ...grant, isPaid: true }]), /Invalid access record/);
  assert.throws(() => exportAccessLedger([{ ...grant, validUntil: 99 }]), /duration/);
  assert.throws(
    () => validateAccessPolicy({ version: 2, personalities: DEFAULT_ACCESS_POLICY.personalities }),
    /Unsupported/,
  );
  assert.deepEqual(DEFAULT_ACCESS_POLICY.personalities.builder, { requirement: 'free' });
});
