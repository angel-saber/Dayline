import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachGuidedPlan,
  breathingFrame,
  validGuidedReports,
} from '../../dist/js/features/activities/model.js';
import { validState } from '../../dist/js/shared/storage.js';
import { dayKey } from '../../dist/js/shared/schedule.js';
const answers = {
  work: 'Draft one paragraph',
  health: 'Walk',
  learning: 'Read',
  relationships: 'Call a friend',
  spirituality: 'Reflect',
};
const report = { id: 'plan-1', completedAt: new Date(2026, 9, 22, 10, 37).getTime(), answers };
test('planning appends a separate report to the current interval without replacing existing content', () => {
  const date = dayKey(new Date(report.completedAt)),
    entry = {
      id: 'existing',
      minute: 610,
      text: 'Keep this',
      done: false,
      format: [],
      tasks: [],
      focusReports: [],
    },
    days = { [date]: [entry] };
  const result = attachGuidedPlan(days, 60, report);
  assert.equal(result.minute, 600);
  assert.equal(result.days[date].length, 1);
  assert.equal(result.days[date][0].text, 'Keep this');
  assert.equal(entry.guidedActivities, undefined);
  assert.deepEqual(result.days[date][0].guidedActivities, [report]);
  assert.equal(attachGuidedPlan(result.days, 60, report).days, result.days);
  const second = attachGuidedPlan(result.days, 60, { ...report, id: 'plan-2' });
  assert.equal(second.days[date][0].guidedActivities.length, 2);
});
test('planning uses completion day and custom interval and survives backup validation', () => {
  const result = attachGuidedPlan({}, 45, report);
  assert.equal(result.minute, 630);
  assert.equal(result.date, '2026-10-22');
  const state = validState(JSON.parse(JSON.stringify({ version: 1, days: result.days })));
  assert.deepEqual(state.days[result.date][0].guidedActivities, [report]);
});
test('invalid and incomplete journal reports are rejected', () => {
  assert.throws(() => validGuidedReports([{ ...report, answers: { ...answers, work: ' ' } }]));
  assert.throws(() => validGuidedReports([report, report]));
  assert.throws(() => validGuidedReports([{ ...report, completedAt: NaN }]));
});
test('both breathing rhythms run exactly two minutes with continuous inhale/exhale and no holds', () => {
  for (const mode of ['calm', 'energize']) {
    assert.equal(breathingFrame(0, mode).remaining, 120);
    assert.equal(breathingFrame(0, mode).instruction, 'Inhale gently');
    const inhale = mode === 'calm' ? 4000 : 3000,
      period = mode === 'calm' ? 10000 : 6000;
    assert.equal(breathingFrame(inhale, mode).instruction, 'Exhale gently');
    assert.equal(breathingFrame(inhale, mode).expansion, 1);
    assert.equal(breathingFrame(period, mode).expansion, 0);
    assert.equal(breathingFrame(119999, mode).done, false);
    assert.equal(breathingFrame(120000, mode).done, true);
    assert.equal(breathingFrame(130000, mode).remaining, 0);
  }
});
