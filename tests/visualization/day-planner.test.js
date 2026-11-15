import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { buildDayPlanner } from '../../dist/js/features/visualization/day-planner.js';
import { validState } from '../../dist/js/shared/storage.js';

test('quick planning schedules commitments, saves checklists, carries open work, and closes yesterday’s notes', () => {
  const { window, document } = parseHTML('<html><body></body></html>');
  const oldDocument = globalThis.document;
  globalThis.document = document;
  window.HTMLElement.prototype.focus = function () {};
  const today = '2026-11-15';
  const yesterday = '2026-11-14';
  const items = [{ id: 'walk', title: 'Walk', minutes: 30 }];
  const days = {
    [today]: [],
    [yesterday]: [
      { id: 'close', title: 'Send email', text: '', task: false, done: false, minute: 600 },
      {
        id: 'carry',
        title: 'Film prep',
        text: 'Context\nSent\nCall',
        done: false,
        minute: 600,
        tasks: [
          { start: 8, done: true },
          { start: 13, done: false },
        ],
      },
    ],
  };
  let finished = false;
  try {
    const planner = buildDayPlanner({
      today,
      read: () => ({
        notes: days[today],
        oldNotes: days[yesterday],
        commitments: items,
        pending: items,
        clock: '12',
        hours: { from: 420, to: 1380 },
      }),
      write(date, update) {
        days[date] = update(days[date]);
        return true;
      },
      finish: () => {
        finished = true;
      },
    });
    document.body.append(planner);
    const click = (text, root = planner) =>
      [...root.querySelectorAll('button')].find((button) => button.textContent === text).click();
    const submit = () =>
      planner.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));

    click('Morning', planner.querySelector('.meet-day-queue'));
    planner.querySelector('input[type="time"]').value = '09:30';
    submit();
    assert.equal(days[today][0].minute, 570);
    assert.equal(days[today][0].commitmentId, 'walk');

    click('+ Note', planner.querySelectorAll('.meet-day-column')[1]);
    planner.querySelector('input[aria-label="Note title"]').value = 'Production';
    planner.querySelector('textarea').value = 'Book room\nCall crew';
    submit();
    assert.equal(days[today][1].dayPeriod, 1);
    assert.deepEqual(days[today][1].tasks, [
      { start: 0, done: false },
      { start: 10, done: false },
    ]);

    click('Mark done');
    assert.equal(days[yesterday][0].done, true);
    click('Undo');
    assert.equal(days[yesterday][0].done, false);
    click('Mark done');

    click('Carry forward');
    click('Evening');
    submit();
    assert.equal(days[yesterday][1].text, 'Context\nSent\nCall');
    assert.equal(days[today][2].text, 'Context\nCall');
    assert.equal(days[today][2].dayPeriod, 2);
    assert.equal(planner.textContent.includes('Carried to evening'), true);

    click('Mark done');
    click('Complete all and close');
    assert.equal(
      days[yesterday][1].tasks.every((task) => task.done),
      true,
    );
    assert.equal(
      validState({ version: 1, days, settings: {} }).days[today][2].carriedFrom,
      `${yesterday}/carry`,
    );
    click('Done');
    assert.equal(finished, true);
  } finally {
    globalThis.document = oldDocument;
  }
});
