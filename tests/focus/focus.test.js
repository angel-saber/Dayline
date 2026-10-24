import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newFocus,
  commitFocus,
  advanceFocus,
  extendFocusNote,
  attachFocusReport,
  validFocusReports,
  validFocusDraft,
  focusReport,
  intervalAt,
} from '../../dist/js/features/focus/model.js';
import { validState, save, load } from '../../dist/js/shared/storage.js';
import { moveToDay } from '../../dist/js/features/monthly/model.js';
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const entry = (id, minute, extra = {}) => ({
  id,
  title: id,
  text: 'Plan',
  minute,
  done: false,
  task: false,
  ...extra,
});
const state = (days = {}, interval = 60) => ({
  version: 1,
  days,
  settings: { interval, clock: '12', notifications: false, sound: false },
});
function active(s, now = at(22, 9, 10), id = 'session-one') {
  const draft = newFocus(s, now, id, 'tab-one');
  commitFocus(draft, s, now);
  return draft;
}
function ended(s, draft) {
  draft.endedAt = draft.startedAt + 12345;
  draft.phase = 'reflect';
  draft.reflection = { progress: 'Made a draft', learned: 'Ask earlier', next: 'Review it' };
  return attachFocusReport(s.days, draft);
}

test('preparation follows the current interval and requires a nonempty commitment', () => {
  const s = state({ '2026-10-22': [entry('nine', 540), entry('ten', 600)] });
  const draft = newFocus(s, at(22, 9, 59), 'one', 'tab');
  assert.equal(draft.pages[0].noteId, 'nine');
  assert.equal(draft.startedAt, null);
  advanceFocus(draft, s, at(22, 10));
  assert.equal(draft.pages.length, 1);
  assert.equal(draft.pages[0].noteId, 'ten');
  draft.mantra = '  ';
  assert.throws(() => commitFocus(draft, s, at(22, 10)));
});
test('interval changes create independent log pages and recover missed intervals after sleep', () => {
  const s = state({ '2026-10-22': [entry('nine', 540), entry('ten', 600), entry('eleven', 660)] });
  const draft = active(s);
  draft.pages[0].log = 'Remember the email';
  assert.equal(advanceFocus(draft, s, at(22, 9, 59)), false);
  assert.equal(advanceFocus(draft, s, at(22, 11, 5)), true);
  assert.deepEqual(
    draft.pages.map((p) => p.noteId),
    ['nine', 'ten', 'eleven'],
  );
  assert.deepEqual(
    draft.pages.map((p) => p.log),
    ['Remember the email', '', ''],
  );
  assert.equal(draft.viewIndex, 2);
  draft.pages[2].log = 'Check the source';
  draft.viewIndex = 0;
  assert.equal(draft.pages[0].log, 'Remember the email');
});
test('custom intervals cross midnight into a fresh date and note', () => {
  const s = state({ '2026-10-22': [entry('late', 1435)], '2026-10-23': [entry('new day', 0)] }, 17);
  const draft = active(s, at(22, 23, 59));
  advanceFocus(draft, s, at(23, 0, 1));
  assert.equal(draft.pages.at(-1).date, '2026-10-23');
  assert.equal(draft.pages.at(-1).noteId, 'new day');
  assert.equal(draft.pages.at(-1).log, '');
  assert.equal(intervalAt(at(22, 23, 59), 17).minute, 1428);
});
test('changing interval settings keeps earlier logs and adopts the new rhythm', () => {
  const s = state({ '2026-10-22': [entry('one', 540)] });
  const draft = active(s);
  draft.pages[0].log = 'Kept';
  s.settings.interval = 30;
  advanceFocus(draft, s, at(22, 9, 45));
  assert.equal(draft.interval, 30);
  assert.equal(draft.pages[0].log, 'Kept');
  assert.equal(draft.pages.at(-1).minute, 570);
});
test('extending unfinished work moves all displaced current notes into the next empty slot', () => {
  const old = entry('old', 540, {
    format: [{ start: 0, end: 4, bold: true }],
    tasks: [{ start: 0, done: false }],
  });
  const days = {
    '2026-10-22': [
      old,
      entry('current one', 600),
      entry('current two', 605),
      entry('occupied', 660),
    ],
  };
  const original = structuredClone(days);
  const next = extendFocusNote(days, 'old', '2026-10-22', '2026-10-22', 600, 60);
  assert.deepEqual(days, original);
  assert.equal(next['2026-10-22'].find((e) => e.id === 'old').minute, 600);
  assert.equal(next['2026-10-22'].find((e) => e.id === 'current one').minute, 720);
  assert.equal(next['2026-10-22'].find((e) => e.id === 'current two').minute, 720);
  assert.equal(next['2026-10-22'].find((e) => e.id === 'occupied').minute, 660);
  assert.deepEqual(next['2026-10-22'].find((e) => e.id === 'old').format, old.format);
});
test('extension finds an empty slot on the next day without losing any note', () => {
  const days = {
    '2026-10-22': [entry('old', 1320), entry('current', 1380)],
    '2026-10-23': [entry('midnight', 0)],
  };
  const next = extendFocusNote(days, 'old', '2026-10-22', '2026-10-22', 1380, 60);
  assert.equal(next['2026-10-23'].find((e) => e.id === 'current').minute, 60);
  assert.equal(Object.values(next).flat().length, 3);
  assert.throws(() =>
    extendFocusNote(
      { '2026-10-22': [entry('done', 0, { done: true })] },
      'done',
      '2026-10-22',
      '2026-10-22',
      60,
      60,
    ),
  );
});
test('ending saves a report on the last referenced note, including every interruption page', () => {
  const s = state({ '2026-10-22': [entry('nine', 540), entry('ten', 600)] });
  const draft = active(s);
  draft.pages[0].log = 'First distraction';
  advanceFocus(draft, s, at(22, 10));
  draft.pages[1].log = 'Second distraction';
  draft.endedAt = at(22, 10, 5);
  draft.phase = 'reflect';
  const days = attachFocusReport(s.days, draft),
    report = days['2026-10-22'][1].focusReports[0];
  assert.equal(report.mantra, draft.mantra);
  assert.equal(report.durationMs, 55 * 60 * 1000);
  assert.deepEqual(
    report.logs.map((l) => l.text),
    ['First distraction', 'Second distraction'],
  );
  assert.equal(days['2026-10-22'][0].focusReports, undefined);
  assert.deepEqual(validFocusReports([report]), [report]);
});
test('two sessions in the same interval append distinct reports and retries are idempotent', () => {
  const s = state({ '2026-10-22': [entry('one', 540)] }),
    first = active(s);
  s.days = ended(s, first);
  assert.equal(attachFocusReport(s.days, first), s.days);
  const second = active(s, at(22, 9, 20), 'session-two');
  assert.equal(second.pages[0].noteId, 'one');
  s.days = ended(s, second);
  assert.deepEqual(
    s.days['2026-10-22'][0].focusReports.map((r) => r.id),
    ['session-one', 'session-two'],
  );
});
test('reports survive storage, backups and moving the note across dates', () => {
  const s = state({ '2026-10-22': [entry('one', 540)] });
  s.days = ended(s, active(s));
  let raw;
  const storage = {
    setItem(k, v) {
      raw = v;
    },
    getItem() {
      return raw;
    },
  };
  save(s, storage);
  assert.deepEqual(load(storage), s);
  const moved = moveToDay(s.days, '2026-10-22', 'one', '2026-10-23');
  assert.deepEqual(moved['2026-10-23'][0].focusReports, s.days['2026-10-22'][0].focusReports);
});
test('a moved or deleted note does not lose the report, and empty intervals get a report note', () => {
  const s = state({ '2026-10-22': [entry('one', 540)] }),
    draft = active(s);
  s.days = moveToDay(s.days, '2026-10-22', 'one', '2026-10-23');
  assert.equal(ended(s, draft)['2026-10-23'][0].focusReports.length, 1);
  const empty = state(),
    session = active(empty);
  assert.equal(ended(empty, session)['2026-10-22'][0].focusReports.length, 1);
  s.days = {};
  assert.equal(ended(s, draft)['2026-10-22'][0].focusReports.length, 1);
});
test('active drafts retain the mantra, reflection and interval pages after reload', () => {
  const s = state(),
    draft = active(s);
  draft.pages[0].log = '<script>literal text</script>';
  draft.mantra = 'My own commitment';
  assert.deepEqual(validFocusDraft(JSON.parse(JSON.stringify(draft))), draft);
  assert.throws(() => validFocusDraft({ ...draft, viewIndex: 99 }));
  assert.throws(() => validFocusDraft({ ...draft, phase: 'invalid' }));
  assert.throws(() => validFocusDraft({ ...draft, pages: [{ ...draft.pages[0], log: 12 }] }));
});
test('malformed report data cannot enter a backup or erase valid existing notes silently', () => {
  const s = state({ '2026-10-22': [entry('one', 540)] });
  s.days = ended(s, active(s));
  const report = s.days['2026-10-22'][0].focusReports[0];
  for (const bad of [
    { ...report, mantra: 12 },
    { ...report, durationMs: -1 },
    { ...report, logs: [{ date: '2026-02-30', minute: 0, text: 'bad' }] },
  ]) {
    assert.throws(() =>
      validState(state({ '2026-10-22': [entry('one', 540, { focusReports: [bad] })] })),
    );
  }
});
test('reflection time is excluded from the fixed report duration', () => {
  const s = state(),
    draft = active(s);
  draft.phase = 'reflect';
  draft.endedAt = draft.startedAt + 5000;
  assert.equal(advanceFocus(draft, s, at(22, 15)), false);
  assert.equal(focusReport(draft).durationMs, 5000);
});
