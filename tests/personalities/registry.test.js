import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PERSONALITIES, voice, getPersonality } from '../../dist/js/personalities/index.js';
import { musicLength, renderMusic, musicProfile } from '../../dist/js/features/focus/music.js';

test('every authored copy ID is available in every personality and all HTML references resolve', () => {
  const keys = Object.keys(PERSONALITIES.zen.copy).sort();
  for (const [id, value] of Object.entries(PERSONALITIES)) {
    assert.equal(value.id, id);
    assert.equal(typeof value.renderScore, 'function');
    assert.ok([null, 'orbital', 'mastery'].includes(value.effects));
    assert.deepEqual(Object.keys(value.copy).sort(), keys);
    assert.ok(
      value.name &&
        value.description &&
        value.welcome.title &&
        value.mantras.length &&
        value.quotes.length,
    );
    assert.equal(musicProfile(id).layout, id);
    for (const key of keys) assert.ok(value.copy[key].length > 0);
  }
  const html = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
  for (const [, key] of html.matchAll(/data-voice="([^"]+)"/g)) assert.ok(keys.includes(key), key);
  assert.equal(voice('daily.headingToday', 'builder'), 'STUDY CAREFULLY. BUILD DELIBERATELY.');
  assert.equal(getPersonality('unrecognized'), PERSONALITIES.zen);
  for (const invalid of ['constructor', 'toString', '__proto__']) {
    assert.equal(getPersonality(invalid), PERSONALITIES.zen);
    assert.equal(voice(invalid, invalid), invalid);
  }
});

test('moving procedural scores preserves the exact original audio samples', () => {
  const expected = {
    zen: 'de2f256064a0af797747c2b97505dc0b9f3df0de4f489eac731c23ae9ca9cc31',
    builder: '7b0bdd4d2682c89ac2b44419feed44a497ad6440c3fe702e89feb2b00b57c3e7',
    founder: '70bfca194f50201126660bd64d723d7fa48236c98a6dd38ebbbc1a089143f3c9',
  };
  for (const mode of Object.keys(expected)) {
    const data = new Float32Array(musicLength(256, mode));
    renderMusic(data, 256, mode);
    assert.equal(
      createHash('sha256').update(new Uint8Array(data.buffer)).digest('hex'),
      expected[mode],
      mode,
    );
  }
});

// The pre-paint classic script can remain cached across module/app releases.
// Tie its URL to its bytes so returning users always receive new supported IDs.
test('appearance script cache key changes whenever its content changes', () => {
  const html = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
  const source = readFileSync(
    new URL('../../dist/js/personalities/appearance.js', import.meta.url),
  );
  const digest = createHash('sha256').update(source).digest('hex').slice(0, 12);
  assert.ok(
    html.includes(`./js/personalities/appearance.js?v=${digest}`),
    'Update the appearance script URL to the first 12 SHA-256 characters of its content.',
  );
});

test('Focus and onboarding use the same versioned personality registry as planner copy', () => {
  const files = [
    'app/controller.js',
    'features/focus/controller.js',
    'features/focus-audio/music.js',
    'features/onboarding/welcome.js',
  ];
  const versions = files.map((file) => {
    const source = readFileSync(new URL('../../dist/js/' + file, import.meta.url), 'utf8');
    const match = source.match(/personalities\/index\.js(\?v=[^']+)?'/);
    assert.ok(match?.[1], file + ' must not reuse an unversioned cached registry');
    return match[1];
  });
  assert.equal(new Set(versions).size, 1);
});
