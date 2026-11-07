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

test('commitment categories validate, retain multiple/default/custom tags and initialize practice context', () => {
  const tagged = { ...practice, tags: ['project', 'personal', 'custom:Creative'] };
  assert.deepEqual(validCommitment(tagged).tags, tagged.tags);
  assert.throws(() => validCommitment({ ...practice, tags: ['project', 'project'] }));
  assert.throws(() => validCommitment({ ...practice, tags: ['invalid'] }));
  const session = newPracticeFocus(state, tagged, at, 'tag-session', 'tag-note', 'owner');
  assert.deepEqual(session.flow.tags, tagged.tags);
  assert.deepEqual(session.practice.tags, tagged.tags);
  assert.notEqual(session.flow.tags, tagged.tags);
});

test('optional commitment bodies retain lines through Focus drafts and reject malformed or oversized input', () => {
  const detailed = {
    ...practice,
    body: 'Read one chapter.\nWrite a thought.\n<script>literal text</script>',
  };
  assert.deepEqual(validCommitment(detailed), detailed);
  const session = newPracticeFocus(state, detailed, at, 'body-session', 'body-note', 'owner');
  assert.equal(session.pages[0].text, detailed.body);
  assert.equal(validFocusDraft(JSON.parse(JSON.stringify(session))).practice.body, detailed.body);
  for (const body of [null, 42, 'x'.repeat(10001)])
    assert.throws(() => validCommitment({ ...practice, body }));
});
