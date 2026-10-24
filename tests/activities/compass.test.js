import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityCatalog,
  activityFields,
  lifeDimensions,
} from '../../dist/js/features/activities/catalog.js';
import {
  attachGuidedPlan,
  validGuidedReports,
  compassDates,
  compassTitle,
} from '../../dist/js/features/activities/model.js';
import { validState } from '../../dist/js/shared/storage.js';
import { dayKey } from '../../dist/js/shared/schedule.js';
const answers = Object.fromEntries(
  lifeDimensions.flatMap(([key]) => [
    [`${key}.project`, `${key} project`],
    ...[1, 2, 3, 4].map((w) => [`${key}.week${w}`, `${key} task ${w}`]),
  ]),
);
const report = {
  id: 'monthly-1',
  activity: 'compass',
  completedAt: new Date(2026, 11, 20, 14, 35).getTime(),
  answers,
};
test('only the three selected new activities are registered', () =>
  assert.deepEqual(Object.keys(activityCatalog), ['untangle', 'two-minute', 'compass']));
test('Compass schedules four notes on seven-day boundaries at the selected time, without replacing existing notes', () => {
  const date = dayKey(new Date(report.completedAt)),
    existing = { id: 'keep', text: 'Keep this', minute: 870, done: false };
  const original = { [date]: [existing] },
    result = attachGuidedPlan(original, 60, { ...report, schedule: { time: '14:30' } });
  assert.deepEqual(compassDates(date), ['2026-12-20', '2026-12-27', '2027-01-03', '2027-01-10']);
  assert.equal(compassTitle(date), 'Monthly Compass [2026-12-20 - 2027-01-17]');
  for (const [i, target] of compassDates(date).entries()) {
    const note = result.days[target].find((e) => e.id === `compass-monthly-1-week-${i + 1}`);
    assert.equal(note.minute, 870);
    assert.equal(note.title, compassTitle(date));
    assert.equal(note.tasks.length, 5);
    assert.equal(note.text.split('\n').length, 5);
    for (const [key] of lifeDimensions) assert.ok(note.text.includes(`${key} task ${i + 1}`));
  }
  assert.equal(original[date][0].guidedActivities, undefined);
  assert.equal(result.days[date].find((e) => e.id === 'keep').text, 'Keep this');
  assert.equal(result.days[date].find((e) => e.id === 'keep').guidedActivities.length, 1);
  const restored = validState(JSON.parse(JSON.stringify({ version: 1, days: result.days })));
  assert.deepEqual(restored.days, result.days);
  assert.equal(
    attachGuidedPlan(result.days, 60, { ...report, schedule: { time: '14:30' } }).days,
    result.days,
  );
});
test('Compass without scheduling records only a report and retains every project and weekly task', () => {
  const result = attachGuidedPlan({}, 45, report);
  assert.equal(Object.keys(result.days).length, 1);
  assert.equal(result.days[result.date].length, 1);
  assert.deepEqual(result.days[result.date][0].guidedActivities[0], report);
});
test('Compass validates all 25 answers and scheduling times', () => {
  assert.equal(activityFields('compass').length, 25);
  for (const bad of [
    { ...report, answers: { ...answers, 'work.week4': '' } },
    { ...report, schedule: { time: '24:00' } },
    { ...report, activity: 'constructor' },
    { ...report, activity: 'unknown' },
  ])
    assert.throws(() => validGuidedReports([bad]));
});
test('Untangle allows empty categories, requires one sorted thought, and saves a separate report each time', () => {
  const r = {
    id: 'thoughts1',
    activity: 'untangle',
    completedAt: report.completedAt,
    answers: {
      thoughts: 'Too much on my mind',
      act: 'Write one paragraph',
      ask: '',
      later: '',
      next: 'Open my document',
    },
  };
  const one = attachGuidedPlan({}, 60, r),
    two = attachGuidedPlan(one.days, 60, { ...r, id: 'thoughts2' });
  assert.equal(two.days[one.date][0].guidedActivities.length, 2);
  assert.deepEqual(validState({ version: 1, days: two.days }).days, two.days);
  assert.throws(() => validGuidedReports([{ ...r, answers: { ...r.answers, act: '' } }]));
});
test('Two-Minute Start stores action, reflection, decision, and accurate timer completion', () => {
  const r = {
    id: 'start1',
    activity: 'two-minute',
    completedAt: report.completedAt,
    answers: {
      avoiding: 'Draft',
      action: 'Write one line',
      progress: 'I wrote a line',
      decision: 'Continue',
    },
    timer: { elapsedMs: 120000, completed: true },
  };
  assert.deepEqual(validGuidedReports([r])[0], r);
  assert.throws(() => validGuidedReports([{ ...r, timer: { elapsedMs: 10, completed: true } }]));
});
test('Compass creates exactly five checkbox tasks even if an answer contains line breaks', () => {
  const r = {
      ...report,
      answers: { ...answers, 'work.week1': 'First line\nsecond line' },
      schedule: { time: '00:00' },
    },
    result = attachGuidedPlan({}, 17, r);
  const note = result.days[result.date].find((e) => e.id === 'compass-monthly-1-week-1');
  assert.equal(note.tasks.length, 5);
  assert.equal(note.text.split('\n').length, 5);
  assert.equal(note.minute, 0);
});
