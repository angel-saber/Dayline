import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITIES, voice, focusMantras } from '../../dist/js/personalities/index.js';
import { DEFAULT_ACCESS_POLICY, PAYMENTS_ENABLED } from '../../dist/js/features/access/policy.js';
import {
  sharedPreferences,
  validatePreferences,
} from '../../dist/js/features/accounts/preferences-sync.js';
import {
  musicLength,
  renderMusic,
  musicProfile,
} from '../../dist/js/features/focus-audio/music.js';
import { dailyQuote } from '../../dist/js/personalities/quotes.js';

test('Poet is a free basic personality in the same copy, quote, mantra, audio and settings pipeline', () => {
  assert.equal(PERSONALITIES.poet.effects, null);
  assert.equal(DEFAULT_ACCESS_POLICY.personalities.poet.requirement, 'free');
  assert.equal(PAYMENTS_ENABLED, false);
  assert.equal(voice('focus.noteHeading', 'poet'), 'Work in progress');
  assert.ok(focusMantras([], 'poet').includes('Name the feeling. Give it a form.'));
  const today = new Date(2026, 9, 24, 12),
    tomorrow = new Date(2026, 9, 25, 12);
  assert.notEqual(dailyQuote(today, 'poet'), dailyQuote(tomorrow, 'poet'));
  const preferences = sharedPreferences({ interval: 60 }, 'poet');
  assert.equal(validatePreferences(JSON.parse(JSON.stringify(preferences))).layout, 'poet');
  assert.equal(musicProfile('poet').label, 'Afterglow letters');
});

test('Afterglow Letters renders deterministic finite music with expressive dynamics', () => {
  const rate = 1000,
    data = new Float32Array(musicLength(rate, 'poet')),
    again = new Float32Array(data.length);
  renderMusic(data, rate, 'poet');
  renderMusic(again, rate, 'poet');
  assert.deepEqual(data, again);
  assert.ok(data.every((value) => Number.isFinite(value) && Math.abs(value) <= 0.781));
  assert.ok(data.some((value) => Math.abs(value) > 0.5));
  const rms = (start, end) =>
    Math.sqrt(
      data.slice(start, end).reduce((sum, value) => sum + value * value, 0) / (end - start),
    );
  const section = Math.round(((32 * 60) / 122) * rate);
  assert.ok(
    rms(section * 4, section * 5) > rms(0, section),
    'The score rises into its middle passage.',
  );
  assert.notDeepEqual(data.slice(0, 1000), data.slice(1000, 2000));
});
