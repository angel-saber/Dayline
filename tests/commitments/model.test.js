import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validCommitment,
  validCommitments,
  practiceProgress,
} from '../../dist/js/features/commitments/model.js';
import {
  newPracticeFocus,
  newFocus,
  commitFocus,
  advanceFocus,
  focusIntervalNotes,
  validFocusDraft,
  attachFocusReport,
} from '../../dist/js/features/focus/model.js';
import { validState } from '../../dist/js/shared/storage.js';
const practice = { id: 'habit', title: 'Read', minutes: 30 },
  at = new Date(2026, 10, 5, 23, 50).getTime();
const state = {
  version: 1,
  settings: { interval: 60 },
  days: {
    '2026-11-05': [
      {
        id: 'unrelated',
        minute: 1380,
        title: 'Other plan',
        text: 'Keep this',
        tags: ['project'],
        done: false,
      },
    ],
  },
};
test('habit validation bounds durations, trims names and protects unique IDs', () => {
  assert.deepEqual(validCommitment({ ...practice, title: ' Read ' }), practice);
  for (const minutes of [0, -1, 1.5, 1441, NaN, '30'])
    assert.throws(() => validCommitment({ ...practice, minutes }));
  assert.throws(() => validCommitment({ ...practice, title: ' ' }));
  assert.throws(() => validCommitments([practice, practice]));
  assert.deepEqual(validCommitments([practice]), [practice]);
});
test('practice stays pinned across intervals and midnight, retains live edits, and roundtrips through notes/reports/backups', () => {
  const session = newPracticeFocus(state, practice, at, 'session', 'practice-note', 'owner');
  const p = session.pages[0];
  assert.deepEqual(session.flow.tags, []);
  assert.match(p.text, /minutes\nShow/);
  const days = {
    ...state.days,
    '2026-11-05': [
      ...state.days['2026-11-05'],
      { id: p.noteId, title: p.title, text: p.text, minute: p.minute, done: false },
    ],
  };
  commitFocus(session, { ...state, days }, at);
  assert.equal(advanceFocus(session, { ...state, days }, at + 40 * 60000), false);
  assert.equal(session.pages.length, 1);
  assert.deepEqual(
    focusIntervalNotes({ ...state, days }, p).map((n) => n.id),
    ['practice-note'],
  );
  const updated = structuredClone(days);
  updated['2026-11-05'][1].text = 'Live practice notes';
  assert.equal(focusIntervalNotes({ ...state, days: updated }, p)[0].text, 'Live practice notes');
  assert.deepEqual(validFocusDraft(structuredClone(session)), session);
  assert.throws(() =>
    validFocusDraft({ ...structuredClone(session), practice: { ...practice, minutes: 0 } }),
  );
  assert.throws(() => validFocusDraft({ ...structuredClone(session), practice: undefined }));
  session.phase = 'reflect';
  session.endedAt = at + 40 * 60000;
  const saved = attachFocusReport(updated, session);
  assert.deepEqual(validState({ ...state, days: saved }).days, saved);
  assert.equal(saved['2026-11-05'][0].text, 'Keep this');
  assert.deepEqual(saved['2026-11-05'][1].focusReports[0].practice, practice);
  assert.equal(practiceProgress(saved, 'habit', new Date(at)), 10 * 60000);
  assert.equal(practiceProgress(saved, 'habit', new Date(at + 40 * 60000)), 30 * 60000);
  assert.equal(practiceProgress(saved, 'other', new Date(at)), 0);
  const normal = newFocus(state, at, 'normal', 'owner');
  commitFocus(normal, state, at);
  assert.equal(advanceFocus(normal, state, at + 40 * 60000), true);
});
