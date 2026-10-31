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
  compactFlow,
  createFlowPreparation,
  recoverySection,
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
test('break defaults use exact session boundaries and remain editable', () => {
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
test('blank compact fields are immediately editable and helper suggestions, steps, warm-ups and recovery use the same draft', () =>
  harness((window, document) => {
    const flow = newFlow();
    let saved = 0,
      back = 0,
      started = 0,
      warmupSaved = '';
    const change = () => saved++;
    const compact = compactFlow(flow, {
      onChange: change,
      categories: { project: 'Project' },
      mantra: 'My commitment',
    });
    document.body.append(compact);
    for (const label of ['Outcome', 'Evidence of progress', 'Next action'])
      assert.ok(compact.querySelector(`[aria-label="${label}"]`));
    assert.equal(compact.querySelector('[aria-label="Approach"]'), null);
    [...compact.querySelectorAll('button')]
      .find((b) => b.textContent === '＋ Add evidence')
      .click();
    const secondEvidence = compact.querySelector('[aria-label="Evidence of progress 2"]');
    secondEvidence.value = 'A second sign of progress';
    secondEvidence.dispatchEvent(new window.Event('input'));
    assert.deepEqual(flow.evidenceExtra, ['A second sign of progress']);
    [...compact.querySelectorAll('button')]
      .find((b) => b.textContent === '＋ Add an approach')
      .click();
    const approach = compact.querySelector('[aria-label="Approach"]');
    approach.value = 'Use an example';
    approach.dispatchEvent(new window.Event('input'));
    assert.equal(flow.steps[0].strategy, 'Use an example');
    const outcome = compact.querySelector('[aria-label="Outcome"]');
    outcome.value = 'Write a draft';
    outcome.dispatchEvent(new window.Event('input'));
    assert.equal(flow.outcome, 'Write a draft');
    compact.querySelector('[data-note-type="project"]').click();
    assert.deepEqual(flow.tags, ['project']);
    const helper = createFlowPreparation({
      flow,
      categories: { project: 'Project' },
      onChange: change,
      onBack: () => back++,
      onBegin: () => started++,
      onAudio() {},
      onSaveWarmup: (text) => {
        warmupSaved = text;
        return true;
      },
    });
    document.body.append(helper.element);
    const click = (text) =>
      [...helper.element.querySelectorAll('button')].find((b) => b.textContent === text).click();
    try {
      assert.ok([...helper.element.querySelectorAll('.flow-part')].every((part) => part.hidden));
      click('Challenge–Skill Balance');
      assert.equal(
        [...helper.element.querySelectorAll('.flow-part')].filter((part) => !part.hidden).length,
        1,
      );
      click('Make it meaningful');
      assert.match(flow.interest, /Accomplishing this would show that/);
      click('Make a rough version');
      click('Make a rough version');
      assert.equal(flow.access, 'Make a rough version before refining it.');
      click('Practice a skill');
      assert.match(flow.interest, /get better/);
      click('Clear Goal and Feedback');
      click('＋ Add action');
      assert.equal(flow.steps.length, 2);
      click('Step Out of Self-Judgment');
      click('Being judged');
      assert.match(flow.permission, /audience/);
      click('Breathe with intention');
      click('Inhale courage. Exhale judgment.');
      assert.equal(flow.breathIn, 'courage');
      click('Move into the task');
      assert.match(
        helper.element.querySelector('.flow-warmup').textContent,
        /make the first small move/,
      );
      click('Make a low-stakes attempt');
      const attempt = helper.element.querySelector('[aria-label="Warm-up attempt"]');
      attempt.value = 'A rough opening';
      attempt.dispatchEvent(new window.Event('input'));
      click('Keep this in my note');
      assert.equal(warmupSaved, 'A rough opening');
      click('Challenge–Skill Balance');
      assert.equal(helper.element.querySelector('[data-support-area=balance]').hidden, true);
      assert.match(flow.interest, /Accomplishing this would show that/);
      assert.deepEqual(validFlow(structuredClone(flow)), flow);
      click('Back to Focus setup');
      assert.equal(back, 1);
      click('Begin Focus');
      assert.equal(started, 1);
      assert.ok(saved > 0);
      const recovery = newRecovery(90 * 60000),
        view = recoverySection(recovery, change);
      document.body.append(view);
      [...view.querySelectorAll('button')].find((b) => b.textContent === 'I showed up').click();
      assert.equal(recovery.acknowledgment, 'I showed up');
      const minutes = view.querySelector('input[type=number]');
      minutes.setCustomValidity = () => {};
      minutes.value = '20';
      minutes.dispatchEvent(new window.Event('input'));
      assert.equal(recovery.minutes, 20);
    } finally {
      helper.destroy();
    }
  }));
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

test('next action advances through unfinished actions and existing approaches stay visible', () =>
  harness((window, document) => {
    const flow = newFlow();
    flow.steps = [
      { action: 'First task', strategy: 'Keep this method', done: true },
      { action: 'Second task', strategy: '', done: false },
    ];
    assert.equal(nextAction(flow), 'Second task');
    const view = compactFlow(flow, { onChange() {}, categories: {} });
    document.body.append(view);
    assert.equal(view.querySelector('[aria-label="Approach"]').value, 'Keep this method');
    assert.equal(view.querySelector('[aria-label="Approach for action 2"]'), null);
    [...view.querySelectorAll('button')].find((b) => b.textContent === 'Remove approach').click();
    assert.equal(flow.steps[0].strategy, '');
    assert.equal(view.querySelector('[aria-label="Approach"]'), null);
    const done = view.querySelector('[aria-label="Action 2 complete"]');
    done.checked = true;
    done.dispatchEvent(new window.Event('change'));
    assert.match(nextAction(flow), /All planned actions are checked off/);
    assert.deepEqual(validFlow(structuredClone(flow)), flow);
  }));
