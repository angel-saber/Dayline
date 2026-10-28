import { validState } from '../../shared/storage.js?v=ca08f99f62a3';
import { validateAccountId } from '../../shared/account-id.js?v=ca08f99f62a3';
import { validatePreferences } from '../accounts/preferences-sync.js?v=ca08f99f62a3';

// A migration format, not a session, identity proof, or purchase receipt.
// Explicitly pick fields; never serialize an auth/provider response wholesale.
// Existing user-facing backup files and their version stay unchanged.
export function exportAccountData({ accountId, days, preferences }) {
  validateAccountId(accountId);
  const valid = validatePreferences(preferences);
  const { layout, ...settings } = valid;
  const state = validState({ version: 1, days, settings });
  return {
    format: 'dayline-account-data',
    version: 1,
    accountId,
    days: structuredClone(state.days),
    preferences: { ...state.settings, layout },
  };
}
export function readAccountData(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      ['format', 'version', 'accountId', 'days', 'preferences'].sort().join(',')
  )
    throw new Error('Invalid portable account data.');
  if (value.format !== 'dayline-account-data' || value.version !== 1)
    throw new Error('Unsupported portable account data.');
  return exportAccountData(value);
}
