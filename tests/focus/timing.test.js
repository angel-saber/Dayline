import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  TIMING_DEFAULTS,
  TIMING_KEY,
  validTiming,
  readTiming,
  sessionTiming,
  flowtimeBreak,
  workDeadline,
  timerDue,
  sessionBreakSuggestion,
} from '../../dist/js/features/focus/timing.js';
import { timingControls, setupTimingSettings } from '../../dist/js/features/focus/timing-view.js';
import {
  newPracticeFocus,
  newFocus,
  commitFocus,
  validFocusDraft,
} from '../../dist/js/features/focus/model.js';
import { setupFocus } from '../../dist/js/features/focus/controller.js';
import { BREAK_KEY, setupBreakTimer } from '../../dist/js/features/focus/break-timer.js';
test('timing validates preferences and snapshots; Flowtime bands and work deadlines are customizable', () => {
  for (const patch of [
    { workMinutes: 0 },
    { workMinutes: 1.5 },
    { breakMinutes: 121 },
    { flowThresholds: [50, 25, 90] },
    { flowBreaks: [0, 8, 10, 15] },
    { sound: 'yes' },
    { alerted: 1 },
  ])
    assert.throws(() => validTiming({ ...TIMING_DEFAULTS, ...patch }));
  for (const [minutes, want] of [
    [0, 5],
    [24.99, 5],
    [25, 8],
    [49.99, 8],
    [50, 10],
    [89.99, 10],
    [90, 15],
  ])
    assert.equal(flowtimeBreak(minutes * 60000), want);
  const custom = { ...TIMING_DEFAULTS, flowThresholds: [10, 20, 30], flowBreaks: [2, 4, 6, 8] };
  assert.equal(flowtimeBreak(21 * 60000, custom), 6);
  const p = sessionTiming(custom, 30);
  custom.flowBreaks[0] = 99;
  assert.equal(p.flowBreaks[0], 2);
  const s = { timing: p, phase: 'active', startedAt: 1000 };
  assert.equal(workDeadline(s), 1801000);
  assert.equal(timerDue(s, 1800999), false);
  assert.equal(timerDue(s, 1801000), true);
  p.alerted = true;
  assert.equal(timerDue(s, 2000000), false);
  s.timing = sessionTiming();
  assert.equal(workDeadline(s), null);
  assert.equal(timerDue(s, 1e12), false);
});
function harness(run) {
  const { window, document } = parseHTML(
    '<html><body><div id="planner"><button id="launch-focus"></button></div><main></main></body></html>',
  );
  const keys = [
    'window',
    'document',
    'localStorage',
    'setTimeout',
    'setInterval',
    'clearInterval',
    'Event',
    'CustomEvent',
  ];
  const old = keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  const oldNow = Date.now;
  const originalTimeout = globalThis.setTimeout;
  let now = oldNow();
  const values = new Map(),
    callbacks = [];
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  Object.assign(globalThis, {
    window,
    document,
    localStorage: storage,
    setTimeout: (fn, delay) => (delay === 1100 ? (fn(), 0) : originalTimeout(fn, delay)),
    setInterval: (fn) => {
      callbacks.push(fn);
      return callbacks.length;
    },
    clearInterval: () => {},
    Event: window.Event,
    CustomEvent: window.CustomEvent,
  });
  Date.now = () => now;
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  window.HTMLElement.prototype.focus = function () {};
  window.HTMLElement.prototype.setCustomValidity = function () {};
  window.HTMLElement.prototype.reportValidity = function () {
    return true;
  };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return (
        [...this.options].find((o) => o.hasAttribute('selected'))?.value ||
        this.options[0]?.value ||
        ''
      );
    },
    set(v) {
      for (const o of this.options) o.toggleAttribute('selected', o.value === v);
    },
  });
  try {
    return run({ window, document, storage, callbacks, setNow: (v) => (now = v), now: () => now });
  } finally {
    Date.now = oldNow;
    for (const [k, d] of old) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
}
test('Daily practice sounds once at its target, keeps overtime, and starts its adjusted break on actual finish without duplicate alerts', () =>
  harness(({ document, storage, callbacks, setNow, now }) => {
    const state = { version: 1, settings: { interval: 60, clock: '24' }, days: {} };
    let primed = 0;
    const sounds = [];
    const api = setupFocus({
      getState: () => state,
      flushEditor() {},
      toast() {},
      refresh() {},
      primeTimerSound() {
        primed++;
      },
      ringTimer: (m) => sounds.push(m),
      createPracticeNote(p) {
        state.days[p.date] = [
          { id: p.noteId, minute: p.minute, title: p.title, text: p.text, done: false },
        ];
        return true;
      },
    });
    assert.equal(api.startPractice({ id: 'habit', title: 'Read', minutes: 30 }), true);
    assert.equal(primed, 0);
    assert.equal(JSON.parse(storage.getItem('dayline.focus.v1')).phase, 'prepare');
    assert.equal(JSON.parse(storage.getItem('dayline.focus.v1')).startedAt, null);
    setNow(now() + 5 * 60000);
    for (const fn of callbacks) fn();
    assert.deepEqual(sounds, []);
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Commit').click();
    assert.equal(primed, 1);
    let draft = JSON.parse(storage.getItem('dayline.focus.v1'));
    assert.equal(draft.timing.mode, 'timed');
    const end = workDeadline(draft);
    setNow(end + 10000);
    for (const fn of callbacks) fn();
    draft = JSON.parse(storage.getItem('dayline.focus.v1'));
    assert.equal(draft.phase, 'active');
    assert.equal(draft.endedAt, null);
    assert.equal(draft.timing.alerted, true);
    assert.equal(draft.recovery, undefined);
    assert.equal(draft.timing.breakStarted, false);
    assert.deepEqual(validFocusDraft(structuredClone(draft)), draft);
    assert.deepEqual(sounds, ['Practice target reached']);
    assert.equal(storage.getItem(BREAK_KEY), null);
    assert.match(document.querySelector('.practice-time-target').textContent, /overtime/);
    for (const fn of callbacks) fn();
    assert.equal(sounds.length, 1);
    const stopped = end + 30 * 60000;
    setNow(stopped);
    document.querySelector('.focus-finish').click();
    draft = JSON.parse(storage.getItem('dayline.focus.v1'));
    assert.equal(draft.endedAt, stopped);
    assert.equal(draft.recovery.minutes, 10);
    assert.equal(JSON.parse(storage.getItem(BREAK_KEY)).until, stopped + 10 * 60000);
    setNow(stopped + 10 * 60000);
    for (const fn of callbacks) fn();
    assert.deepEqual(sounds, ['Practice target reached', 'Break complete']);
    const reloaded = setupBreakTimer({ storage, now, onComplete: () => sounds.push('duplicate') });
    reloaded.tick();
    assert.equal(sounds.length, 2);
    reloaded.destroy();
    assert.match(document.querySelector('.focus-window').textContent, /Break complete/);
  }));
test('regular Focus timing choices switch; Settings validate and retain failed drafts', () =>
  harness(({ document, window, storage }) => {
    const value = sessionTiming();
    let saves = 0;
    const controls = timingControls(value, () => saves++);
    document.body.append(controls);
    controls.querySelector('[data-mode="timed"]').click();
    assert.equal(value.mode, 'timed');
    assert.equal(controls.querySelector('.focus-timing-fields').hidden, false);
    controls.querySelector('[data-mode="untimed"]').click();
    assert.equal(value.mode, 'untimed');
    assert.ok(saves === 2);
    setupTimingSettings({
      root: document.querySelector('main'),
      toast() {},
      primeSound() {},
      playSound() {},
      storage,
    });
    const form = document.querySelector('.focus-timing-settings');
    const input = form.querySelector('[aria-label="Default timed work minutes"]');
    input.value = '45';
    form.dispatchEvent(new window.Event('submit', { cancelable: true }));
    assert.equal(readTiming(storage).workMinutes, 45);
    input.value = '0';
    form.dispatchEvent(new window.Event('submit', { cancelable: true }));
    assert.equal(readTiming(storage).workMinutes, 45);
    assert.equal(input.value, '0');
    assert.match(form.textContent, /Could not save/);
    assert.ok(storage.getItem(TIMING_KEY));
  }));

test('untimed Focus never expires and uses its customized Flowtime snapshot when finished', () =>
  harness(({ document, storage, callbacks, setNow, now }) => {
    const state = { version: 1, settings: { interval: 60, clock: '24' }, days: {} };
    const draft = newFocus(state, now(), 'untimed', 'original-owner');
    draft.timing = sessionTiming({
      ...TIMING_DEFAULTS,
      sound: false,
      flowThresholds: [10, 20, 40],
      flowBreaks: [2, 4, 9, 15],
    });
    commitFocus(draft, state, now());
    storage.setItem('dayline.focus.v1', JSON.stringify(draft));
    setupFocus({ getState: () => state, flushEditor() {}, toast() {}, refresh() {} });
    document.querySelector('#launch-focus').click();
    storage.setItem(TIMING_KEY, JSON.stringify(TIMING_DEFAULTS));
    setNow(now() + 30 * 60000);
    document.querySelector('.focus-finish').click();
    const saved = JSON.parse(storage.getItem('dayline.focus.v1'));
    assert.equal(saved.phase, 'reflect');
    assert.equal(saved.recovery.minutes, 9);
    assert.equal(saved.timing.mode, 'untimed');
    assert.equal(storage.getItem(BREAK_KEY), null);
    assert.match(
      document.querySelector('.focus-window').textContent,
      /Suggested break: about 9 minutes/,
    );
  }));

test('choosing a commitment retargets an unstarted preparation with its own duration and restores the old draft on note-save failure', () =>
  harness(({ document, window, storage }) => {
    const state = { version: 1, settings: { interval: 60, clock: '24' }, days: {} };
    let failNote = true;
    const created = [];
    storage.setItem(
      TIMING_KEY,
      JSON.stringify({ ...TIMING_DEFAULTS, workMinutes: 60, breakMinutes: 10, sound: false }),
    );
    const api = setupFocus({
      getState: () => state,
      flushEditor() {},
      toast() {},
      refresh() {},
      createPracticeNote(p) {
        if (failNote) return false;
        created.push(structuredClone(p));
        state.days[p.date] = [
          { id: p.noteId, title: p.title, text: p.text, minute: p.minute, done: false },
        ];
        return true;
      },
    });
    document.querySelector('#launch-focus').click();
    const mantra = document.querySelector('.focus-mantra-input');
    mantra.value = 'Keep showing up';
    mantra.dispatchEvent(new window.Event('input'));
    api.minimize();
    const original = JSON.parse(storage.getItem('dayline.focus.v1'));
    assert.equal(original.phase, 'prepare');
    const habit = { id: 'practice', title: 'Read', minutes: 15, breakMinutes: 0 };
    assert.equal(api.startPractice(habit), false);
    assert.deepEqual(JSON.parse(storage.getItem('dayline.focus.v1')), original);
    assert.equal(created.length, 0);
    failNote = false;
    assert.equal(api.startPractice(habit), true);
    const selected = JSON.parse(storage.getItem('dayline.focus.v1'));
    assert.equal(selected.phase, 'prepare');
    assert.equal(selected.startedAt, null);
    assert.equal(selected.timing.workMinutes, 15);
    assert.equal(selected.timing.mode, 'timed');
    assert.equal(selected.timing.autoBreak, false);
    assert.equal(selected.mantra, 'Keep showing up');
    assert.equal(selected.pages[0].title, 'Read');
    assert.equal(created.length, 1);
  }));

test('overtime commitment break suggestions use actual work duration and customized Flowtime preferences', () => {
  const base = {
    practice: { id: 'read', title: 'Read', minutes: 30 },
    timing: sessionTiming(TIMING_DEFAULTS, 30),
    startedAt: 1000,
  };
  assert.equal(sessionBreakSuggestion({ ...base, endedAt: 1000 + 30 * 60000 }), 5);
  assert.equal(sessionBreakSuggestion({ ...base, endedAt: 1000 + 35 * 60000 }), 8);
  assert.equal(sessionBreakSuggestion({ ...base, endedAt: 1000 + 60 * 60000 }), 10);
  assert.equal(sessionBreakSuggestion({ ...base, endedAt: 1000 + 100 * 60000 }), 15);
  const custom = {
    ...base,
    timing: { ...base.timing, flowThresholds: [15, 45, 75], flowBreaks: [3, 7, 12, 20] },
  };
  assert.equal(sessionBreakSuggestion({ ...custom, endedAt: 1000 + 60 * 60000 }), 12);
  assert.equal(
    sessionBreakSuggestion({ ...base, practice: undefined, endedAt: 1000 + 60 * 60000 }),
    5,
  );
});
