import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { buildDayPlanner } from '../../dist/js/features/visualization/day-planner.js';
import {
  planningClock,
  freeGaps,
  suggestedApproach,
} from '../../dist/js/features/visualization/planning-time.js';

test('overnight planning stays on the evening through bedtime and free gaps merge overlaps', () => {
  const hours = { from: 480, to: 120 };
  assert.deepEqual(planningClock(new Date(2026, 10, 16, 0, 30), hours), {
    today: '2026-11-15',
    current: 1470,
    start: 480,
    end: 1560,
    remaining: 90,
  });
  assert.equal(planningClock(new Date(2026, 10, 16, 2, 15), hours).remaining, 0);
  assert.equal(planningClock(new Date(2026, 10, 16, 8), hours).today, '2026-11-16');
  const busy = [
    { minute: 1500, commitmentId: 'a', duration: 20 },
    { minute: 1510, commitmentId: 'b', duration: 30 },
    { minute: 1470, commitmentId: 'c', duration: 40, allDay: true },
  ];
  assert.deepEqual(
    freeGaps(1470, 1560, busy, (note) => note.duration),
    [
      [1470, 1500],
      [1540, 1560],
    ],
  );
  assert.equal(suggestedApproach('High', 'High', 20), 'focus');
  assert.equal(suggestedApproach('High', 'Low', 20), 'smaller');
  assert.equal(suggestedApproach('Low', 'Low', 0), 'wrap');
});

test('overnight notes use the next calendar date and a batch can be reviewed and undone', () => {
  const { window, document } = parseHTML('<html><body></body></html>');
  const old = globalThis.document;
  globalThis.document = document;
  window.HTMLElement.prototype.focus = function () {};
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return (
        this.querySelector('option[selected]')?.value || this.querySelector('option')?.value || ''
      );
    },
    set(value) {
      for (const option of this.querySelectorAll('option'))
        option.toggleAttribute('selected', option.value === value);
    },
  });
  const today = '2026-11-15';
  const tomorrow = '2026-11-16';
  const hours = { from: 480, to: 120 };
  let days = {
    [today]: [
      { id: 'old', title: 'Earlier item', text: '', minute: 540, done: false, task: false },
    ],
    [tomorrow]: [],
  };
  let writes = 0;
  try {
    const planner = buildDayPlanner({
      today,
      getTiming: () => planningClock(new Date(2026, 10, 16, 0, 30), hours),
      dayState: { stress: 'Moderate', motivation: 'Moderate' },
      finish() {},
      read: () => ({
        notes: [
          ...days[today],
          ...days[tomorrow]
            .filter((note) => !note.allDay)
            .map((note) => ({ ...note, minute: note.minute + 1440, calendarDay: tomorrow })),
        ],
        oldNotes: [],
        commitments: [],
        pending: [],
        clock: '12',
        hours,
      }),
      writeBatch(edits) {
        const next = { ...days };
        for (const { day, update } of edits) {
          next[day] = update(next[day] || []);
          if (!next[day]) return false;
        }
        days = next;
        writes++;
        return true;
      },
    });
    document.body.append(planner);
    const click = (text, root = planner) =>
      [...root.querySelectorAll('button')].find((button) => button.textContent === text).click();
    assert.match(planner.textContent, /1 hr 30 min left/);
    const evening = planner.querySelector('.meet-day-current');
    click('+ Note', evening);
    const title = evening.querySelector('[aria-label="Note title"]');
    title.value = 'Late dispatch';
    const time = evening.querySelector('[aria-label="Start time"]');
    time.value = '01:00';
    time.closest('details').open = true;
    time.dispatchEvent(new window.Event('input'));
    assert.match(evening.textContent, /Daily date.*Nov 16/);
    evening.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    assert.equal(days[tomorrow][0].minute, 60);
    assert.equal(days[today].length, 1);

    click('Review what’s left');
    const select = [...planner.querySelectorAll('.meet-day-review-editor label')]
      .find((label) => label.textContent.startsWith('Earlier item'))
      .querySelector('select');
    select.value = 'tomorrow';
    select.dispatchEvent(new window.Event('change'));
    click('Review changes');
    assert.match(planner.textContent, /Earlier item · Move to .*Nov 16 · Anytime/);
    assert.equal(writes, 1);
    click('Apply changes');
    assert.equal(days[today].length, 0);
    assert.equal(days[tomorrow].length, 2);
    click('Undo');
    assert.equal(days[today][0].id, 'old');
    assert.equal(days[tomorrow].length, 1);

    for (const name of ['First card', 'Second card']) {
      const period = planner.querySelector('.meet-day-current');
      click('+ Note', period);
      period.querySelector('[aria-label="Note title"]').value = name;
      period.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    }
    const card = (name) =>
      [...planner.querySelectorAll('.meet-day-current .meet-day-row')].find(
        (row) => row.querySelector('strong')?.textContent === name,
      );
    click('Move', card('Second card'));
    click('Move up', card('Second card'));
    assert.equal(days[today].find((note) => note.title === 'Second card').dayPlanOrder, 0);

    card('First card').querySelector('[draggable]').dispatchEvent(new window.Event('dragstart'));
    card('Second card').dispatchEvent(new window.Event('drop', { cancelable: true }));
    assert.equal(days[today].find((note) => note.title === 'First card').dayPlanOrder, 0);

    click('Delete', card('First card'));
    click('Delete note', card('First card'));
    assert.equal(
      days[today].some((note) => note.title === 'First card'),
      false,
    );
    click('Undo');
    assert.equal(days[today].find((note) => note.title === 'First card').dayPlanOrder, 0);
  } finally {
    globalThis.document = old;
  }
});
