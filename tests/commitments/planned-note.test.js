import test from 'node:test';
import assert from 'node:assert/strict';
import {
  plannedCommitmentNote,
  activatePracticeNote,
} from '../../dist/js/features/commitments/planned-note.js';
import { newPracticeFocus } from '../../dist/js/features/focus/model.js';
import { validState } from '../../dist/js/shared/storage.js';
const practice = { id: 'read', title: 'Read', minutes: 30, body: 'Read a chapter' };
const make = (id, minute, extra = {}) => ({
  id,
  minute,
  text: 'Edited instructions',
  title: 'My reading',
  done: false,
  commitmentId: 'read',
  ...extra,
});
test('practice selects current interval first, nearest within it, otherwise nearest plan today', () => {
  const notes = [make('outside', 599), make('late', 650), make('early', 610)];
  assert.equal(plannedCommitmentNote(notes, practice, 601, 60).id, 'early');
  assert.equal(plannedCommitmentNote(notes, practice, 640, 60).id, 'late');
  assert.equal(plannedCommitmentNote(notes, practice, 700, 60).id, 'late');
  assert.equal(plannedCommitmentNote(notes, practice, 630, 60).id, 'early');
  const invalid = [
    make('done', 630, { done: true }),
    make('weekly', 630, { weekly: true }),
    make('all', 630, { allDay: true }),
    make('used', 630, { focusReports: [{}] }),
    make('other', 630, { commitmentId: 'other' }),
  ];
  assert.equal(plannedCommitmentNote(invalid, practice, 630, 60), null);
});
test('older unlinked plans require unchanged title and body; linked plan keeps edited content and metadata', () => {
  const old = make('legacy', 630, {
    commitmentId: undefined,
    title: practice.title,
    text: practice.body,
  });
  assert.equal(plannedCommitmentNote([old], practice, 630, 60), old);
  assert.equal(plannedCommitmentNote([{ ...old, text: 'Unrelated' }], practice, 630, 60), null);
  const now = new Date(2026, 10, 8, 10, 30).getTime();
  const plan = make('saved', 650, {
    tags: ['personal'],
    format: [{ start: 0, end: 6, bold: true }],
  });
  const state = { version: 1, settings: { interval: 60 }, days: { '2026-11-08': [plan] } };
  const session = newPracticeFocus(state, practice, now, 'session', 'new-note', 'owner');
  assert.equal(session.pages[0].noteId, 'saved');
  assert.equal(session.pages[0].text, plan.text);
  assert.equal(session.pages[0].minute, 630);
  assert.deepEqual(session.flow.tags, ['personal']);
  assert.equal(state.days['2026-11-08'][0].minute, 650);
  // Link survives the same validator used by local persistence, sync and backups.
  delete plan.format;
  assert.equal(validState(state).days['2026-11-08'][0].commitmentId, 'read');
  assert.throws(() =>
    validState({ ...state, days: { '2026-11-08': [{ ...plan, commitmentId: 42 }] } }),
  );
});

test('starting replaces only the chosen plan, preserves its fields and other occurrences', () => {
  const chosen = make('chosen', 650, {
    tags: ['personal'],
    format: [{ start: 0, end: 6, bold: true }],
    bullets: [0],
    repeat: { id: 'series' },
  });
  const other = make('other', 680);
  const days = { '2026-11-08': [chosen, other], '2026-11-09': [make('tomorrow', 650)] };
  const page = {
    date: '2026-11-08',
    noteId: 'chosen',
    minute: 630,
    title: chosen.title,
    text: chosen.text,
  };
  const result = activatePracticeNote(days, page, practice);
  assert.equal(result[page.date].length, 2);
  assert.deepEqual(result[page.date][0], { ...chosen, minute: 630 });
  assert.equal(result[page.date][1], other);
  assert.equal(result['2026-11-09'], days['2026-11-09']);
  assert.equal(chosen.minute, 650);
  const fresh = activatePracticeNote(days, { ...page, noteId: 'fresh' }, practice);
  assert.equal(fresh[page.date].length, 3);
  assert.equal(fresh[page.date][0].commitmentId, 'read');
});
