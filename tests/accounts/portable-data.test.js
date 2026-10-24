import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportAccountData,
  readAccountData,
} from '../../dist/js/features/portability/account-data.js';
import { sharedPreferences } from '../../dist/js/features/accounts/preferences-sync.js';
const accountId = '11111111-1111-4111-8111-111111111111';
test('portable data preserves account/note identities, weekly notes, rich text and settings without provider credentials', () => {
  const days = {
    '2026-10-24': [
      {
        id: 'daily',
        text: 'A task',
        minute: 615,
        title: 'Keep this',
        done: false,
        tags: ['project'],
        format: [{ start: 0, end: 1, bold: true }],
        tasks: [{ start: 0, done: true }],
        attachments: [{ id: 'file', name: 'note.pdf', size: 10, type: 'application/pdf' }],
      },
    ],
    '2026-10-25': [{ id: 'weekly', text: 'Week plan', minute: 0, done: false, weekly: true }],
  };
  const preferences = sharedPreferences(
    { interval: 30, clock: '24', tags: { custom: ['custom:Work'], disabledDefaults: ['admin'] } },
    'founder',
  );
  const value = exportAccountData({
    accountId,
    days,
    preferences,
    session: { refresh_token: 'never-export-this' },
    apiKey: 'never-export-key',
  });
  assert.deepEqual(readAccountData(JSON.parse(JSON.stringify(value))), value);
  assert.deepEqual(value.days, days);
  assert.equal(value.accountId, accountId);
  assert.equal(value.preferences.layout, 'founder');
  assert.ok(!JSON.stringify(value).includes('never-export'));
  value.days['2026-10-24'][0].text = 'Changed copy';
  assert.equal(days['2026-10-24'][0].text, 'A task');
});
test('portable reads fail closed on unknown versions, embedded credentials and invalid ownership', () => {
  const good = exportAccountData({
    accountId,
    days: {},
    preferences: sharedPreferences({ interval: 60 }),
  });
  assert.throws(() => readAccountData({ ...good, version: 2 }), /Unsupported/);
  assert.throws(
    () => readAccountData({ ...good, session: { access_token: 'not-allowed' } }),
    /Invalid portable/,
  );
  assert.throws(() => readAccountData({ ...good, accountId: 'provider-subject' }), /identity/);
  assert.throws(() => readAccountData({ ...good, days: { '2026-02-30': [] } }), /calendar day/);
});
