import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  newFlow,
  validFlow,
  newRecovery,
  validRecovery,
  suggestedBreak,
  nextAction,
} from '../../dist/js/features/focus/flow-model.js';
import {
  newFocus,
  commitFocus,
  focusReport,
  validFocusDraft,
  attachFocusReport,
} from '../../dist/js/features/focus/model.js';
import {
  createFlowPreparation,
  recoverySection,
  preparationReference,
} from '../../dist/js/features/focus/flow-view.js';
import { setupBreakTimer, BREAK_KEY } from '../../dist/js/features/focus/break-timer.js';
import { validState } from '../../dist/js/shared/storage.js';
import { shareNoteText } from '../../dist/js/features/sharing/share-note.js';
const at = new Date(2026, 9, 31, 9).getTime();
const state = {
  version: 1,
  settings: { interval: 60 },
  days: {
    '2026-10-31': [
      { id: 'note', minute: 540, text: 'Task', title: 'Project', done: false, tags: ['project'] },
    ],
  },
};
test('preparation copies initial tags without aliasing, preserves old drafts, validates new metadata and saves it in reports without expanding work time', () => {
  const session = newFocus(state, at, 'session', 'owner');
  assert.deepEqual(session.flow.tags, ['project']);
  session.flow.tags.push('personal');
  assert.deepEqual(state.days['2026-10-31'][0].tags, ['project']);
  session.flow.outcome = 'Private outcome';
  session.flow.evidenceExtra = ['Private second evidence'];
  session.flow.steps[0].strategy = 'Existing approach';
  session.flow.steps[0].approachOpen = true;
  session.flow.parked = 'Private distraction';
  session.flow.steps[0].action = 'First move';
  commitFocus(session, state, at + 120000);
  session.endedAt = at + 720000;
  session.phase = 'reflect';
  session.recovery = newRecovery(600000);
  session.recovery.win = 'Private acknowledgment';
  const report = focusReport(session);
  assert.equal(report.durationMs, 600000);
  assert.match(report.logs[0].text, /Before starting:\nPrivate distraction/);
  assert.deepEqual(validFocusDraft(structuredClone(session)), session);
  const days = attachFocusReport(state.days, session);
  assert.deepEqual(validState({ ...state, days }).days, days);
  const note = days['2026-10-31'][0];
  assert.ok(!shareNoteText(note, '2026-10-31').includes('Private'));
  const shared = shareNoteText(note, '2026-10-31', { focusReports: true });
  assert.match(shared, /Private outcome/);
  assert.match(shared, /Private second evidence/);
  assert.match(shared, /Private acknowledgment/);
  const old = structuredClone(session);
  delete old.flow;
  delete old.recovery;
  assert.deepEqual(validFocusDraft(old), old);
  for (const patch of [
    { tags: ['bad'] },
    { steps: [] },
    { hideClock: 'yes' },
    { outcome: 'x'.repeat(10001) },
    { space: {} },
    { evidenceExtra: [42] },
    { steps: [{ action: '', strategy: '', done: false, approachOpen: 'yes' }] },
  ])
    assert.throws(() => validFlow({ ...newFlow(), ...patch }));
  assert.throws(() => validRecovery({ ...newRecovery(0), minutes: NaN }));
  assert.throws(() => validRecovery({ ...newRecovery(0), minutes: 0 }));
});
test('break defaults use exact session boundaries and retain legacy duration compatibility', () => {
  for (const [m, n] of [
    [0, 3],
    [24.99, 3],
    [25, 5],
    [49.99, 5],
    [50, 10],
    [89.99, 10],
    [90, 15],
    [180, 15],
  ])
    assert.equal(suggestedBreak(m * 60000), n);
  assert.equal(validRecovery({ ...newRecovery(0), minutes: 37 }).minutes, 37);
});
function harness(run) {
  const keys = ['window', 'document', 'localStorage'];
  const old = keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  const { window } = parseHTML('<html><body></body></html>');
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  Object.assign(globalThis, { window, document: window.document, localStorage: storage });
  try {
    return run(window, window.document, storage);
  } finally {
    for (const [k, d] of old) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
}
test('recovery timer uses elapsed wall time, survives reload, synchronizes, and clears without launching a session', () =>
  harness((window, document, storage) => {
    let now = 100000;
    const timer = setupBreakTimer({ storage, now: () => now });
    let reloaded;
    try {
      timer.start(3);
      assert.match(timer.element.textContent, /3:00/);
      now += 90000;
      timer.tick();
      assert.match(timer.element.textContent, /1:30/);
      reloaded = setupBreakTimer({ storage, now: () => now });
      assert.match(reloaded.element.textContent, /1:30/);
      now += 100000;
      timer.tick();
      assert.match(timer.element.textContent, /Break complete/);
      timer.stop();
      assert.equal(storage.getItem(BREAK_KEY), null);
      assert.equal(timer.element.hidden, true);
      const event = new window.Event('storage');
      Object.defineProperty(event, 'key', { value: BREAK_KEY });
      window.dispatchEvent(event);
      assert.equal(reloaded.element.hidden, true);
      assert.throws(() => timer.start(0));
      assert.throws(() => timer.start(121));
    } finally {
      timer.destroy();
      reloaded?.destroy();
    }
  }));

test('active preparation reference includes all completed support areas and omits empty prompts', () =>
  harness((window, document) => {
    const flow = newFlow();
    flow.interest = 'Build a useful skill';
    flow.access = 'Start small';
    flow.ifStuck = 'Ask for help';
    flow.fear = 'Being judged';
    flow.permission = 'I can try';
    flow.warmup = 'breathing';
    flow.breathIn = 'courage';
    flow.breathOut = 'judgment';
    flow.parked = 'Reply later';
    flow.space.materials = true;
    let edited = false;
    const view = preparationReference(flow, () => (edited = true));
    document.body.append(view);
    for (const value of [
      'Build a useful skill',
      'Start small',
      'Ask for help',
      'Being judged',
      'I can try',
      'Inhale courage. Exhale judgment.',
      'Reply later',
      'Materials ready',
    ])
      assert.ok(view.textContent.includes(value), value);
    assert.equal(view.querySelectorAll('.focus-reference-group').length, 4);
    assert.equal(view.querySelector('textarea'), null);
    view.querySelector('button').click();
    assert.equal(edited, true);
  }));

test('inline help has four collapsed questions and only two brief goal answers', () =>
  harness((window, document) => {
    const flow = newFlow();
    flow.outcome = 'Keep an earlier outcome';
    flow.evidenceExtra = ['Keep earlier evidence'];
    let saves = 0;
    const helper = createFlowPreparation({
      flow,
      onChange() {
        saves++;
      },
      onAudio() {},
      onSaveWarmup() {
        return true;
      },
    });
    document.body.append(helper.element);
    try {
      const parts = [...helper.element.querySelectorAll('.flow-part')];
      assert.equal(parts.length, 4);
      assert.ok(
        parts.every(
          (part) =>
            !part.open && !part.hidden && part.querySelector('summary').textContent.endsWith('?'),
        ),
      );
      assert.equal(helper.element.querySelector('.flow-support-choices'), null);
      assert.equal(helper.element.querySelector('.flow-preparation-actions'), null);
      const goals = helper.element.querySelector('[data-support-area="goals"]');
      assert.equal(goals.querySelectorAll('textarea').length, 2);
      [...goals.querySelectorAll('button')]
        .find((b) => b.textContent === 'A rough version')
        .click();
      assert.equal(flow.evidence, 'A rough version of…');
      assert.equal(
        goals.querySelector('[aria-label="Progress I want to see"]').parentElement.hidden,
        false,
      );
      const action = goals.querySelector(
        '[aria-label="What is the smallest action that would move that forward?"]',
      );
      action.value = 'Write an opening';
      action.dispatchEvent(new window.Event('input'));
      assert.equal(flow.steps[0].action, 'Write an opening');
      assert.ok(saves > 0);
      assert.deepEqual(flow.evidenceExtra, ['Keep earlier evidence']);
      assert.equal(flow.outcome, 'Keep an earlier outcome');
      const reference = preparationReference(flow, () => {});
      assert.match(reference.textContent, /A rough version of/);
      assert.match(reference.textContent, /Write an opening/);
    } finally {
      helper.destroy();
    }
  }));
test('recovery offers a suggestion and brief guidance without answer buttons or editable duration', () =>
  harness((window, document) => {
    const recovery = newRecovery(60 * 60000);
    recovery.win = 'Keep an earlier reflection';
    recovery.activity = 'Quiet rest';
    let saved = 0;
    const view = recoverySection(recovery, () => saved++);
    document.body.append(view);
    assert.match(view.textContent, /Suggested break: about 10 minutes/);
    assert.match(view.textContent, /even if things did not go according to plan/);
    assert.equal(view.querySelector('button'), null);
    assert.equal(view.querySelector('textarea'), null);
    assert.equal(view.querySelector('input[type=number]'), null);
    const timer = view.querySelector('[aria-label^="Start the suggested"]');
    timer.checked = true;
    timer.dispatchEvent(new window.Event('change'));
    assert.equal(recovery.startTimer, true);
    assert.equal(saved, 1);
    assert.equal(recovery.win, 'Keep an earlier reflection');
    assert.equal(recovery.activity, 'Quiet rest');
    assert.equal(recovery.minutes, 10);
  }));
