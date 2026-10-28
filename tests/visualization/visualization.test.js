import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { VISUALIZATIONS, rollVisualization } from '../../dist/js/features/visualization/catalog.js';
import {
  setupVisualizations,
  shouldInvite,
  ENABLED_KEY,
  SEEN_KEY,
} from '../../dist/js/features/visualization/controller.js';

test('all approved visualizations are complete and a reroll chooses another exercise', () => {
  assert.equal(VISUALIZATIONS.length, 21);
  assert.equal(new Set(VISUALIZATIONS.map((exercise) => exercise.id)).size, 21);
  for (const exercise of VISUALIZATIONS) {
    assert.ok(exercise.title && exercise.guidance && exercise.prompt);
    for (const random of [() => 0, () => 0.5, () => 0.999])
      assert.notEqual(rollVisualization(exercise.id, random).id, exercise.id);
  }
  assert.equal(shouldInvite(null, null, '2026-10-28'), true);
  assert.equal(shouldInvite('off', null, '2026-10-28'), false);
  assert.equal(shouldInvite('on', '2026-10-28', '2026-10-28'), false);
  assert.equal(shouldInvite('on', '2026-10-27', '2026-10-28'), true);
});

test('daily invitations wait for entry, roll once per local day, respect Settings, and allow optional saved actions', async () => {
  const names = ['window', 'document'];
  const previous = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const { window, document } = parseHTML(
    '<html><body><div id="more"></div><div id="settings"></div></body></html>',
  );
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
    this.setAttribute('open', '');
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.removeAttribute('open');
    this.dispatchEvent(new window.Event('close'));
  };
  window.HTMLElement.prototype.focus = function () {};
  const data = new Map(),
    saves = [],
    messages = [];
  let gate = false,
    date = new Date(2026, 9, 28, 9),
    fail = false;
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      data.set(key, value);
    },
  };
  try {
    for (const [name, value] of Object.entries({ window, document }))
      Object.defineProperty(globalThis, name, { configurable: true, value });
    const api = setupVisualizations({
      root: document.querySelector('#more'),
      settings: document.querySelector('#settings'),
      canInvite: () => gate && !document.querySelector('dialog[open]'),
      saveAction: (exercise, action) => {
        if (fail) return false;
        saves.push({ exercise, action });
        return true;
      },
      toast: (message) => messages.push(message),
      storage,
      now: () => date,
      random: () => 0,
    });
    const click = (text) =>
      [...api.dialog.querySelectorAll('button')]
        .find((button) => button.textContent === text)
        .click();
    await Promise.resolve();
    assert.ok(!api.dialog.open);
    assert.equal(data.has(SEEN_KEY), false);
    gate = true;
    window.dispatchEvent(new window.Event('dayline:entry-view'));
    await Promise.resolve();
    assert.equal(api.dialog.open, true);
    assert.equal(data.get(SEEN_KEY), '2026-10-28');
    assert.ok(!api.dialog.textContent.includes('Not now'));
    assert.match(api.dialog.textContent, /disable the daily pop-up in Settings/);
    const assertExerciseScreen = () => {
      assert.ok(api.dialog.querySelector('.visualization-guidance'));
      assert.ok(api.dialog.querySelector('.visualization-prompt'));
      assert.ok(api.dialog.querySelector('textarea'));
      const labels = [...api.dialog.querySelectorAll('button')].map((button) => button.textContent);
      assert.ok(!labels.includes('Begin'));
      for (const text of ['Finish', 'Save action to Daily', 'Reroll'])
        assert.ok(labels.includes(text));
    };
    assertExerciseScreen();
    const draft = api.dialog.querySelector('textarea');
    draft.value = 'Previous exercise action';
    draft.dispatchEvent(new window.Event('input'));
    const title = api.dialog.querySelector('h3').textContent;
    click('Reroll');
    assert.notEqual(api.dialog.querySelector('h3').textContent, title);
    assertExerciseScreen();
    assert.equal(api.dialog.querySelector('textarea').value, '');
    assert.ok(api.dialog.querySelector('.visualization-guidance'));
    assert.equal(saves.length, 0);
    click('Finish');
    api.check();
    assert.equal(api.dialog.open, false);
    assert.equal(saves.length, 0);
    date = new Date(2026, 9, 29, 9);
    api.check();
    assert.equal(api.dialog.open, true);
    assert.equal(data.get(SEEN_KEY), '2026-10-29');
    api.dialog.close();
    const toggle = document.querySelector('#settings input');
    toggle.checked = false;
    toggle.dispatchEvent(new window.Event('change'));
    assert.equal(data.get(ENABLED_KEY), 'off');
    date = new Date(2026, 9, 30, 9);
    api.check();
    assert.equal(api.dialog.open, false);
    document.querySelector('#more button').click();
    assert.equal(api.dialog.open, true);
    assert.equal(data.get(SEEN_KEY), '2026-10-29');
    assertExerciseScreen();
    click('Save action to Daily');
    assert.equal(saves.length, 0);
    const input = api.dialog.querySelector('textarea');
    input.value = 'Open my notebook';
    input.dispatchEvent(new window.Event('input'));
    fail = true;
    click('Save action to Daily');
    assert.equal(api.dialog.open, true);
    assert.equal(input.value, 'Open my notebook');
    assert.match(api.dialog.textContent, /could not be saved/);
    fail = false;
    click('Save action to Daily');
    assert.equal(api.dialog.open, false);
    assert.equal(saves[0].action, 'Open my notebook');
    assert.equal(messages.length, 0);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
