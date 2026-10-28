import test from 'node:test';
import assert from 'node:assert/strict';
import {
  yearPosition,
  validYearly,
  writeYearly,
  yearRecords,
  planNextStep,
  linkedNotes,
  carryIntentions,
} from '../../dist/js/features/yearly/model.js';
import { validState } from '../../dist/js/shared/storage.js';
import {
  validateDay,
  mergeEntries,
  mergeGuestDays,
  SyncEngine,
} from '../../dist/js/features/accounts/sync.js';
import { dueEntries } from '../../dist/js/shared/schedule.js';
import { focusIntervalNotes } from '../../dist/js/features/focus/model.js';
import { summarySource, summarizePeriod } from '../../dist/js/features/summaries/model.js';
import { matchingNotes } from '../../dist/js/features/bulk/model.js';
import { emptyIntervals } from '../../dist/js/features/sharing/availability-model.js';
const intention = (quarter = 4) => ({
  title: 'Make room for painting',
  text: 'Explore, without a deadline.',
  yearly: {
    year: 2026,
    quarter,
    kind: 'intention',
    dimension: 'learning',
    nextStep: 'Try one color',
  },
});

test('year position is calendar-based across leap years, DST, past and future years', () => {
  assert.deepEqual(yearPosition(2024, new Date(2024, 0, 1)), {
    elapsed: 0,
    total: 366,
    remaining: 366,
    percent: 0,
    currentQuarter: 1,
  });
  assert.equal(yearPosition(2024, new Date(2024, 11, 31)).remaining, 1);
  assert.equal(yearPosition(2026, new Date(2026, 9, 28)).currentQuarter, 4);
  assert.equal(yearPosition(2026, new Date(2027, 0, 1)).percent, 100);
  assert.equal(yearPosition(2028, new Date(2026, 0, 1)).percent, 0);
  assert.throws(() => yearPosition(9999));
});
test('Yearly metadata validates and roundtrips through backups and the existing sync contract', () => {
  const result = writeYearly({}, intention(), () => 'paint');
  const state = validState({ version: 1, days: result.days });
  assert.deepEqual(state.days['2026-01-01'], validateDay('2026-01-01', result.days['2026-01-01']));
  assert.equal(state.days['2026-01-01'][0].yearly.nextStep, 'Try one color');
  assert.throws(() => validYearly({ ...intention().yearly, quarter: 0 }));
  assert.throws(() => validYearly({ ...intention().yearly, dimension: 'other' }));
  assert.throws(() =>
    validState({ version: 1, days: { '2026-01-02': result.days['2026-01-01'] } }),
  );
  assert.throws(() =>
    validState({
      version: 1,
      days: { '2026-01-01': [{ ...result.days['2026-01-01'][0], weekly: true }] },
    }),
  );
});
test('independent intentions merge and simultaneous edits retain both versions', () => {
  const one = writeYearly({}, intention(), () => 'one').days['2026-01-01'];
  const two = writeYearly({}, intention(2), () => 'two').days['2026-01-01'];
  const combined = mergeEntries([], one, two);
  assert.equal(combined.entries.length, 2);
  const edited = mergeEntries(one, [{ ...one[0], text: 'local' }], [{ ...one[0], text: 'remote' }]);
  assert.equal(edited.conflicts, 1);
  assert.deepEqual(new Set(edited.entries.map((note) => note.text)), new Set(['local', 'remote']));
  assert.ok(edited.entries.every((note) => note.yearly.kind === 'intention'));
  assert.equal(
    mergeGuestDays({ '2026-01-01': one }, { '2026-01-01': one })['2026-01-01'].length,
    1,
  );
});
test('quarter moves, release and reshape preserve the identity, history and other notes', () => {
  const ordinary = { id: 'daily', text: 'Keep', minute: 540, done: false };
  let days = writeYearly({ '2026-01-01': [ordinary] }, intention(), () => 'paint').days;
  let record = yearRecords(days, 2026)[0];
  days = writeYearly(days, {
    ...record,
    yearly: { ...record.yearly, quarter: 2, status: 'released' },
  }).days;
  record = yearRecords(days, 2026)[0];
  assert.equal(record.id, 'paint');
  assert.equal(record.yearly.quarter, 2);
  assert.equal(record.yearly.status, 'released');
  days = writeYearly(days, {
    ...record,
    title: 'A smaller painting',
    yearly: { ...record.yearly, status: 'active' },
  }).days;
  assert.deepEqual(days['2026-01-01'][0], ordinary);
  assert.equal(yearRecords(days, 2026)[0].yearly.nextStep, 'Try one color');
  assert.throws(() => writeYearly(days, { ...record, id: 'missing' }));
});
test('next steps create linked dated or Weekly Notes without completing or moving the intention', () => {
  let days = writeYearly({}, intention(), () => 'paint').days;
  const record = yearRecords(days, 2026)[0],
    original = structuredClone(record);
  days = planNextStep(
    days,
    record,
    { mode: 'weekly', date: '2026-10-28', title: 'Pick colors', text: '' },
    () => 'weekly',
  ).days;
  days = planNextStep(
    days,
    record,
    { mode: 'daily', date: '2026-10-30', time: '10:15', title: 'Try a swatch', text: 'Blue' },
    () => 'dated',
  ).days;
  assert.equal(days['2026-10-25'][0].weekly, true);
  assert.equal(days['2026-10-30'][0].minute, 615);
  assert.deepEqual(yearRecords(days, 2026)[0], original);
  const checked = validState({ version: 1, days }).days;
  assert.equal(linkedNotes(checked, record).length, 2);
  assert.throws(() =>
    planNextStep(days, record, {
      mode: 'daily',
      date: '2026-02-30',
      time: '10:00',
      title: 'bad',
      text: '',
    }),
  );
  assert.throws(() =>
    planNextStep(days, record, {
      mode: 'daily',
      date: '2026-10-30',
      time: '25:00',
      title: 'bad',
      text: '',
    }),
  );
});
test('carry forward copies only reviewed selections, retaining source years and existing future plans', () => {
  let days = writeYearly({}, intention(), () => 'one').days;
  days = writeYearly(days, intention(2), () => 'two').days;
  days = writeYearly(
    days,
    { ...intention(), yearly: { ...intention().yearly, year: 2027 } },
    () => 'future',
  ).days;
  const before = structuredClone(days);
  const next = carryIntentions(days, 2026, ['two'], () => 'new');
  assert.deepEqual(next['2026-01-01'], before['2026-01-01']);
  assert.equal(yearRecords(next, 2027).length, 2);
  assert.equal(yearRecords(next, 2027).find((note) => note.id === 'new').yearly.quarter, 1);
  assert.throws(() => carryIntentions(days, 2026, []));
});
test('Yearly records never become reminders, focus notes, busy slots, category selections or summary totals', () => {
  const days = writeYearly({}, intention(), () => 'paint').days,
    list = days['2026-01-01'];
  assert.equal(
    dueEntries(
      list,
      '2026-01-01',
      60,
      new Date(2025, 11, 31, 23, 59).getTime(),
      new Date(2026, 0, 1, 0, 1).getTime(),
    ).length,
    0,
  );
  assert.deepEqual(
    focusIntervalNotes({ days, settings: { interval: 60 } }, { date: '2026-01-01', minute: 0 }),
    [],
  );
  assert.equal(summarizePeriod(summarySource(days), '2026-01-01', '2026-12-31', true).count, 0);
  assert.equal(matchingNotes(days, '2026-01-01', 'day', []).length, 0);
  const slots = emptyIntervals(
    days,
    { start: '2026-01-01', end: '2026-01-01', interval: 60, from: 0, to: 60, weekdays: [4] },
    new Date(2025, 11, 31).getTime(),
  );
  assert.equal(slots.length, 1);
});

test('two account clients sync Yearly and linked notes through the existing revision-aware notes port', async () => {
  const rows = new Map();
  const cloud = {
    async loadDays() {
      return [...rows].map(([day, row]) => ({ day, ...structuredClone(row) }));
    },
    async saveDay(day, entries, revision) {
      const row = rows.get(day) || { revision: 0, entries: [] };
      if (row.revision !== revision) return { conflict: true, ...structuredClone(row) };
      rows.set(day, { entries: structuredClone(entries), revision: revision + 1 });
      return { conflict: false, revision: revision + 1 };
    },
  };
  const storage = () => {
    const data = new Map();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
      key: (index) => [...data.keys()][index],
      get length() {
        return data.size;
      },
    };
  };
  const engine = (id) =>
    new SyncEngine({
      cloud,
      userId: 'same-account',
      cacheId: id,
      storage: storage(),
      onDays() {},
      onStatus() {},
      onConflict() {},
    });
  const desktop = engine('desktop'),
    phone = engine('phone');
  try {
    const days = writeYearly({}, intention(), () => 'paint').days;
    desktop.stage(days);
    await desktop.sync();
    await phone.sync();
    assert.equal(yearRecords(phone.days, 2026)[0].title, 'Make room for painting');
    const record = yearRecords(phone.days, 2026)[0];
    phone.stage(
      planNextStep(
        phone.days,
        record,
        { mode: 'daily', date: '2026-10-30', time: '10:15', title: 'Swatch', text: '' },
        () => 'swatch',
      ).days,
    );
    await phone.sync();
    await desktop.sync();
    assert.equal(linkedNotes(desktop.days, record).length, 1);
    assert.equal(desktop.days['2026-10-30'][0].yearlySource.id, 'paint');
  } finally {
    desktop.stop();
    phone.stop();
  }
});

test('direction conflicts remain independently editable and the chosen version becomes current', () => {
  const source = {
    title: 'Annual direction',
    text: 'Explore',
    yearly: { year: 2026, quarter: 0, kind: 'direction' },
  };
  const first = writeYearly({}, source, () => 'one').days['2026-01-01'][0];
  const second = { ...first, id: 'conflict', text: 'Rest' };
  let days = { '2026-01-01': [first, second] };
  days = writeYearly(days, second).days;
  assert.equal(yearRecords(days, 2026)[0].text, 'Rest');
  assert.equal(yearRecords(days, 2026).length, 2);
  assert.throws(() => writeYearly(days, source, () => 'new'));
  assert.throws(() => writeYearly({}, { ...intention(), title: '   ' }));
});

test('overlarge year histories fail atomically and portable exports retain planning metadata', async () => {
  const { exportAccountData, readAccountData } =
    await import('../../dist/js/features/portability/account-data.js');
  const days = writeYearly({}, intention(), () => 'paint').days;
  const portable = exportAccountData({
    accountId: '11111111-1111-4111-8111-111111111111',
    days,
    preferences: { interval: 60, clock: '12', sound: false, notifications: false, layout: 'zen' },
  });
  assert.equal(readAccountData(portable).days['2026-01-01'][0].yearly.nextStep, 'Try one color');
  const huge = {
    title: 'Direction',
    text: 'Keep it small',
    yearly: {
      year: 2026,
      quarter: 0,
      kind: 'direction',
      history: Array.from({ length: 60 }, () => ({ text: 'x'.repeat(20000), at: 0 })),
    },
  };
  assert.throws(() => writeYearly(days, huge, () => 'large'), /storage limit/);
  assert.equal(yearRecords(days, 2026).length, 1);
});

test('Monthly Compass reports and their four Weekly Notes retain the Yearly context link', async () => {
  const { attachGuidedPlan, validGuidedReports } =
    await import('../../dist/js/features/activities/model.js');
  const { activityFields } = await import('../../dist/js/features/activities/catalog.js');
  const report = {
    id: 'compass',
    activity: 'compass',
    completedAt: new Date(2026, 9, 28, 10).getTime(),
    answers: Object.fromEntries(
      activityFields('compass').map((field) => [field.key, 'One small step']),
    ),
    schedule: { mode: 'weekly' },
    yearlySource: { year: 2026, id: 'paint' },
  };
  const validated = validGuidedReports([report])[0];
  const result = attachGuidedPlan({}, 60, validated);
  const state = validState({ version: 1, days: result.days });
  const weekly = Object.values(state.days)
    .flat()
    .filter((note) => note.weekly);
  assert.equal(weekly.length, 4);
  assert.ok(weekly.every((note) => note.yearlySource.id === 'paint'));
  assert.equal(
    Object.values(state.days)
      .flat()
      .find((note) => note.guidedActivities)?.guidedActivities[0].yearlySource.id,
    'paint',
  );
});
