import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { effectiveEffects, setupPersonalityEffects } from '../../dist/js/personalities/effects.js';
import { PERSONALITIES } from '../../dist/js/personalities/index.js';
import {
  PERSONALITY_IDS,
  DEFAULT_ACCESS_POLICY,
  PAYMENTS_ENABLED,
} from '../../dist/js/features/access/policy.js';
import {
  sharedPreferences,
  validatePreferences,
} from '../../dist/js/features/accounts/preferences-sync.js';
import { musicLength, renderMusic } from '../../dist/js/features/focus/music.js';

test('new personalities remain free, round-trip shared preferences, and have distinct bounded original scores', () => {
  const scores = [];
  for (const id of ['astronaut', 'gamer']) {
    assert.ok(PERSONALITY_IDS.includes(id));
    assert.equal(DEFAULT_ACCESS_POLICY.personalities[id].requirement, 'free');
    const preferences = sharedPreferences({ interval: 60 }, id);
    assert.equal(validatePreferences(JSON.parse(JSON.stringify(preferences))).layout, id);
    assert.equal(PERSONALITIES[id].soundtrack.layout, id);
    const a = new Float32Array(musicLength(1000, id));
    const b = new Float32Array(a.length);
    renderMusic(a, 1000, id);
    renderMusic(b, 1000, id);
    assert.deepEqual(a, b);
    assert.ok(a.every((n) => Number.isFinite(n) && Math.abs(n) <= 0.781));
    assert.ok(a.some((n) => Math.abs(n) > 0.1));
    scores.push(a);
  }
  assert.notDeepEqual(scores[0], scores[1]);
  assert.equal(PAYMENTS_ENABLED, false);
});

test('effects honor reduced motion and hidden tabs, persist device preference, and clean up transient effects', () => {
  for (const level of ['full', 'subtle', 'off']) {
    assert.equal(effectiveEffects(level, true, false), 'off');
    assert.equal(effectiveEffects(level, false, true), 'off');
    assert.equal(effectiveEffects(level, false, false), level);
  }
  const originals = new Map(
    ['window', 'document', 'localStorage'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const { window } = parseHTML(
    '<html data-layout="astronaut"><body><select id="visual-effects"><option>full</option><option>subtle</option><option>off</option></select><p id="effects-status"></p><dialog class="focus-window" open></dialog></body></html>',
  );
  const media = {
    matches: false,
    addEventListener(type, fn) {
      this.listener = fn;
    },
    removeEventListener() {},
  };
  window.matchMedia = () => media;
  const memory = new Map();
  let effects;
  try {
    for (const [key, value] of Object.entries({
      window,
      document: window.document,
      localStorage: {
        getItem: (key) => memory.get(key),
        setItem: (key, value) => memory.set(key, value),
      },
    }))
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    Object.defineProperty(document.querySelector('select'), 'value', {
      value: 'full',
      writable: true,
    });
    window.HTMLElement.prototype.showPopover = function () {
      this.dataset.popoverShown = 'true';
    };
    effects = setupPersonalityEffects();
    const root = document.documentElement,
      select = document.querySelector('select');
    const emit = () =>
      window.dispatchEvent(
        new window.CustomEvent('dayline:effect', { detail: { kind: 'complete' } }),
      );
    emit();
    emit();
    assert.equal(document.querySelectorAll('.personality-burst').length, 1);
    const burst = document.querySelector('.personality-burst');
    assert.equal(burst.parentNode, document.body);
    assert.equal(burst.getAttribute('popover'), 'manual');
    assert.equal(burst.dataset.popoverShown, 'true');
    assert.match(burst.textContent, /Signal secured/);
    document.querySelector('.focus-window').replaceChildren();
    assert.equal(document.querySelector('.personality-burst'), burst);
    media.matches = true;
    media.listener();
    assert.equal(root.dataset.effects, 'off');
    assert.equal(document.querySelectorAll('.personality-burst').length, 0);
    emit();
    assert.equal(document.querySelectorAll('.personality-burst').length, 0);
    media.matches = false;
    select.value = 'subtle';
    select.dispatchEvent(new window.Event('change'));
    assert.equal(root.dataset.effects, 'subtle');
    assert.equal(memory.get('dayline.effects.v1'), 'subtle');
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new window.Event('visibilitychange'));
    assert.equal(root.dataset.effects, 'off');
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new window.Event('visibilitychange'));
    assert.equal(root.dataset.effects, 'subtle');
    assert.equal(document.querySelector('.effects-preview').disabled, true);
    select.value = 'full';
    select.dispatchEvent(new window.Event('change'));
    const snapshot = JSON.stringify([...memory]);
    document.querySelector('.effects-preview').click();
    assert.match(document.querySelector('.personality-burst').textContent, /Course set/);
    assert.equal(JSON.stringify([...memory]), snapshot);
    effects.destroy();
    effects = null;
    assert.equal(document.querySelector('.personality-scene'), null);
    assert.equal(document.querySelector('.effects-preview'), null);
    assert.equal(document.querySelector('.personality-burst'), null);
  } finally {
    effects?.destroy();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
