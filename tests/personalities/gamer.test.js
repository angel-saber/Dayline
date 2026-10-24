import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITIES, focusMantras, voice } from '../../dist/js/personalities/index.js';
import { newFocus, commitFocus, validFocusDraft } from '../../dist/js/features/focus/model.js';
import { musicProfile } from '../../dist/js/features/focus-audio/music.js';
import { DEFAULT_ACCESS_POLICY, PAYMENTS_ENABLED } from '../../dist/js/features/access/policy.js';

const approved = [
  'Press start. Build momentum.',
  'Find the fun. Follow through.',
  'Beat your last attempt.',
  'Switch tactics. Keep moving.',
  'Finish the quest. Claim victory.',
  'Make one move. Start a combo.',
  'Practice the move. Nail the execution.',
  'Use what you learned. Run it back.',
  'Spot the opening. Go for it.',
  'Clear one checkpoint. Unlock the next.',
  'Face the challenge. Play to win.',
  'Put in the reps. Level up.',
];

test('Gamer uses the twelve approved mantras and exact requested headings in the shared pipeline', () => {
  assert.deepEqual(focusMantras([], 'gamer'), approved);
  assert.equal(voice('daily.headingToday', 'gamer'), 'LET’S LEVEL UP.');
  assert.equal(voice('focus.preparationHeading', 'gamer'), 'Choose your quest. Get ready to win.');
  assert.equal(PERSONALITIES.gamer.description, 'Playful and driven.');
  assert.equal(musicProfile('gamer').label, 'Next level');
  assert.equal(musicProfile('gamer').bpm, 112);
  assert.equal(DEFAULT_ACCESS_POLICY.personalities.gamer.requirement, 'free');
  assert.equal(PAYMENTS_ENABLED, false);
});

test('the rework leaves existing commitments and session progress intact', () => {
  const state = { version: 1, days: {}, settings: { interval: 60 } };
  const at = new Date(2026, 9, 24, 12).getTime();
  const session = newFocus(state, at, 'gamer-restore', 'test-owner');
  session.mantra = 'Choose one skill. Practice it with intention.';
  commitFocus(session, state, at);
  const restored = validFocusDraft(JSON.parse(JSON.stringify(session)));
  assert.equal(restored.mantra, session.mantra);
  assert.equal(restored.startedAt, session.startedAt);
  assert.equal(restored.phase, 'active');
});
