// Provider-neutral policy/ledger models for FUTURE server enforcement.
// No checkout, admin endpoint, protected asset delivery, or paywall is enabled.
// A browser flag, an imported file, and this evaluator are NOT proof of purchase.
import { validateAccountId } from '../../shared/account-id.js?v=6880fc00acca';
import { PERSONALITY_IDS } from '../../personalities/ids.js?v=6880fc00acca';
export { PERSONALITY_IDS };
export const PAYMENTS_ENABLED = false;
const validFeature = (value) => PERSONALITY_IDS.some((id) => value === `personality.${id}`);
const PRODUCT = /^[a-z][a-z0-9._-]{0,79}$/;
export const DEFAULT_ACCESS_POLICY = Object.freeze({
  version: 1,
  personalities: Object.freeze(
    Object.fromEntries(PERSONALITY_IDS.map((id) => [id, Object.freeze({ requirement: 'free' })])),
  ),
});

function exact(value, keys) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== keys.slice().sort().join(',')
  )
    throw new Error('Invalid access record.');
}
export function validateAccessPolicy(value) {
  exact(value, ['version', 'personalities']);
  if (value.version !== 1) throw new Error('Unsupported access policy.');
  exact(value.personalities, PERSONALITY_IDS);
  const personalities = {};
  for (const id of PERSONALITY_IDS) {
    const rule = value.personalities[id];
    if (rule?.requirement === 'free') {
      exact(rule, ['requirement']);
      personalities[id] = { requirement: 'free' };
    } else if (rule?.requirement === 'purchase') {
      exact(rule, ['requirement', 'productKey']);
      if (typeof rule.productKey !== 'string' || !PRODUCT.test(rule.productKey))
        throw new Error('Use a stable Dayline product key.');
      personalities[id] = { requirement: 'purchase', productKey: rule.productKey };
    } else throw new Error('Unknown personality access requirement.');
  }
  return { version: 1, personalities };
}
export function validateGrants(value) {
  if (!Array.isArray(value) || value.length > 100000) throw new Error('Invalid access ledger.');
  const seen = new Set();
  return value.map((grant) => {
    exact(grant, [
      'id',
      'accountId',
      'featureKey',
      'productKey',
      'status',
      'source',
      'validFrom',
      'validUntil',
    ]);
    validateAccountId(grant.id);
    validateAccountId(grant.accountId);
    if (
      seen.has(grant.id) ||
      typeof grant.featureKey !== 'string' ||
      !validFeature(grant.featureKey) ||
      !['active', 'revoked'].includes(grant.status) ||
      !['purchase', 'admin', 'legacy'].includes(grant.source)
    )
      throw new Error('Invalid or duplicate access grant.');
    if (
      grant.productKey !== null &&
      (typeof grant.productKey !== 'string' || !PRODUCT.test(grant.productKey))
    )
      throw new Error('Invalid grant product key.');
    if (grant.source === 'purchase' && grant.productKey === null)
      throw new Error('Purchased access needs a product key.');
    for (const time of [grant.validFrom, grant.validUntil])
      if (time !== null && (!Number.isSafeInteger(time) || time < 0))
        throw new Error('Invalid grant time.');
    if (
      grant.validFrom !== null &&
      grant.validUntil !== null &&
      grant.validUntil <= grant.validFrom
    )
      throw new Error('Invalid grant duration.');
    seen.add(grant.id);
    return { ...grant };
  });
}
// Server callers must fetch authoritative policy/grants themselves after
// authenticating. Never accept these inputs from a browser as authorization.
export function evaluatePersonalityAccess({
  personalityId,
  policy = DEFAULT_ACCESS_POLICY,
  accountId = null,
  verifiedGrants = [],
  now = Date.now(),
}) {
  const valid = validateAccessPolicy(policy);
  if (!PERSONALITY_IDS.includes(personalityId))
    return { allowed: false, reason: 'unknown-personality' };
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid access-check time.');
  if (valid.personalities[personalityId].requirement === 'free')
    return { allowed: true, reason: 'free' };
  if (accountId === null) return { allowed: false, reason: 'sign-in-required' };
  validateAccountId(accountId);
  const allowed = validateGrants(verifiedGrants).some(
    (grant) =>
      grant.accountId === accountId &&
      grant.featureKey === `personality.${personalityId}` &&
      grant.status === 'active' &&
      (grant.validFrom === null || grant.validFrom <= now) &&
      (grant.validUntil === null || now < grant.validUntil),
  );
  return { allowed, reason: allowed ? 'granted' : 'purchase-required' };
}
export function exportAccessLedger(grants) {
  return { format: 'dayline-access-ledger', version: 1, grants: validateGrants(grants) };
}
export function readAccessLedger(value) {
  exact(value, ['format', 'version', 'grants']);
  if (value.format !== 'dayline-access-ledger' || value.version !== 1)
    throw new Error('Unsupported access ledger.');
  return exportAccessLedger(value.grants);
}
