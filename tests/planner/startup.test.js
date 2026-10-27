import { MockContext } from '../focus/mock-audio-context.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { dayKey } from '../../dist/js/shared/dates.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    key: (index) => [...data.keys()][index],
    get length() {
      return data.size;
    },
  };
}

test('the assembled planner starts, switches views/personalities, edits settings and opens Focus without replacing saved notes', async () => {
  const names = [
    'window',
    'document',
    'localStorage',
    'sessionStorage',
    'Event',
    'Node',
    'CustomEvent',
    'matchMedia',
    'CSS',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'setInterval',
    'clearInterval',
    'fetch',
    'AudioContext',
  ];
  const previous = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const { window } = parseHTML(
    readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8'),
  );
  const { document, HTMLElement, HTMLInputElement, HTMLSelectElement } = window;
  const local = memoryStorage(),
    today = dayKey(),
    now = new Date(),
    minute = now.getHours() * 60;
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 12);
  const days = {
    [today]: [
      {
        id: 'saved-note',
        minute,
        title: 'Saved plan',
        text: 'Keep this plan',
        done: false,
        format: [{ start: 0, end: 4, bold: true }],
        tasks: [{ start: 0, done: false }],
      },
    ],
  };
  const anchor = dayKey(week);
  days[anchor] = [
    ...(days[anchor] || []),
    {
      id: 'weekly',
      title: 'Weekly direction',
      text: 'Keep weekly notes too',
      minute: 0,
      done: false,
      weekly: true,
    },
  ];
  const fixture = {
    version: 1,
    days,
    settings: { interval: 60, clock: '12', sound: false, notifications: false },
  };
  const raw = JSON.stringify(fixture);
  local.setItem('dayline.v1', raw);
  local.setItem('dayline.welcome.v1', 'done');
  HTMLElement.prototype.focus = function () {};
  HTMLElement.prototype.setCustomValidity = function () {};
  HTMLElement.prototype.showPopover = function () {
    this.dataset.popoverShown = 'true';
  };
  HTMLElement.prototype.scrollIntoView = function () {};
  HTMLElement.prototype.reportValidity = function () {
    return true;
  };
  HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLElement.prototype.close = function (value = '') {
    this.open = false;
    this.returnValue = value;
    this.dispatchEvent(new window.Event('close'));
  };
  Object.defineProperty(HTMLInputElement.prototype, 'checked', {
    configurable: true,
    get() {
      return this.hasAttribute('checked');
    },
    set(value) {
      this.toggleAttribute('checked', value);
    },
  });
  Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return (
        this.querySelector('option[selected]')?.value || this.querySelector('option')?.value || ''
      );
    },
    set(value) {
      for (const option of this.querySelectorAll('option'))
        option.toggleAttribute('selected', option.value === String(value));
    },
  });
  window.location = {
    href: 'https://dayline.example/Dayline/',
    origin: 'https://dayline.example',
    pathname: '/Dayline/',
  };
  window.history = { replaceState() {} };
  window.scrollTo = () => {};
  const network = [];
  try {
    const values = {
      window,
      document,
      localStorage: local,
      sessionStorage: memoryStorage(),
      Event: window.Event,
      Node: window.Node,
      CustomEvent: window.CustomEvent,
      matchMedia: (query) => ({
        matches: query !== '(prefers-reduced-motion: reduce)',
        addEventListener() {},
        removeEventListener() {},
      }),
      CSS: { escape: (text) => text },
      requestAnimationFrame: () => 0,
      cancelAnimationFrame() {},
      setInterval: () => 0,
      clearInterval() {},
      AudioContext: MockContext,
      fetch: async (url) => {
        network.push(url);
        throw new Error('Unexpected network request');
      },
    };
    for (const [name, value] of Object.entries(values))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    await import('../../dist/js/personalities/appearance.js');
    await import('../../dist/js/app.js');
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    assert.equal(document.querySelector('#auth-view').hidden, true);
    assert.match(document.querySelector('#timeline').textContent, /Saved plan/);
    assert.equal(document.querySelectorAll('.line-checkbox').length, 1);
    const duplicate = document.querySelector('[aria-label="Duplicate note"]');
    assert.ok(duplicate);
    duplicate.click();
    let copied = JSON.parse(local.getItem('dayline.v1')).days[today].filter((note) => !note.weekly);
    assert.equal(copied.length, 2);
    assert.notEqual(copied[0].id, copied[1].id);
    assert.equal(copied[1].text, 'Keep this plan');
    document.querySelector('#undo').click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    document.querySelector('#more-tab').click();
    [...document.querySelectorAll('#more-view button')]
      .find((button) => button.textContent === 'Explore the library')
      .click();
    assert.equal(document.querySelector('.inspiration-library').open, true);
    [...document.querySelectorAll('.inspiration-library button')]
      .find((button) => button.textContent === 'Save to Daily')
      .click();
    assert.equal(document.querySelector('.inspiration-library').open, false);
    assert.equal(document.querySelector('#daily-view').hidden, false);
    const storyNotes = JSON.parse(local.getItem('dayline.v1')).days[today];
    assert.ok(
      storyNotes.some(
        (note) =>
          note.title === 'Inspiration · Octavia Butler' &&
          note.text.includes('Read the source: https://'),
      ),
    );
    document.querySelector('#undo').click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    document.querySelector('#monthly-tab').click();
    assert.equal(document.querySelector('#monthly-view').hidden, false);
    assert.match(document.querySelector('#monthly-view').textContent, /Weekly direction/);
    // An open weekly editor must still be draggable, and dropping must preserve its contents.
    let weeklyCard = document.querySelector('.weekly-note[data-id="weekly"]');
    weeklyCard.open = true;
    weeklyCard.dispatchEvent(new window.Event('toggle'));
    assert.ok(weeklyCard.querySelector('.editor'));
    assert.equal(weeklyCard.draggable, true);
    let dragHandle = weeklyCard.querySelector('.month-drag');
    assert.equal(dragHandle.draggable, true);
    let targetDay = document.querySelector(`.month-day[data-date="${today}"]`);
    // A held touch on the handle also opens the scheduler for the dropped day.
    document.elementFromPoint = () => targetDay;
    const pointer = (type) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      for (const [name, value] of Object.entries({
        pointerType: 'touch',
        pointerId: 1,
        clientX: 100,
        clientY: 200,
      }))
        Object.defineProperty(event, name, { value });
      return event;
    };
    dragHandle.dispatchEvent(pointer('pointerdown'));
    assert.equal(weeklyCard.draggable, false);
    const touchUpdate = new window.Event('storage');
    Object.defineProperty(touchUpdate, 'key', { value: 'dayline.v1' });
    window.dispatchEvent(touchUpdate);
    assert.equal(document.querySelector('.weekly-note[data-id="weekly"]'), weeklyCard);
    await new Promise((resolve) => setTimeout(resolve, 380));
    window.dispatchEvent(pointer('pointerup'));
    let touchSchedule = document.querySelector('.weekly-schedule-dialog');
    assert.ok(touchSchedule);
    assert.equal(touchSchedule.querySelector('input[type="date"]').value, today);
    assert.equal(weeklyCard.draggable, true);
    touchSchedule.close();
    weeklyCard = document.querySelector('.weekly-note[data-id="weekly"]');
    dragHandle = weeklyCard.querySelector('.month-drag');
    targetDay = document.querySelector(`.month-day[data-date="${today}"]`);
    const dragToToday = (duringSync = false) => {
      const start = new window.Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(start, 'dataTransfer', { value: { setData() {} } });
      dragHandle.dispatchEvent(start);
      if (duringSync) {
        const update = new window.Event('storage');
        Object.defineProperty(update, 'key', { value: 'dayline.v1' });
        window.dispatchEvent(update);
        // A cross-tab update must not replace the source or destination mid-drag.
        assert.equal(document.querySelector('.weekly-note[data-id="weekly"]'), weeklyCard);
        assert.equal(document.querySelector(`.month-day[data-date="${today}"]`), targetDay);
      }
      targetDay.dispatchEvent(new window.Event('drop', { bubbles: true, cancelable: true }));
    };
    dragToToday(true);
    let schedule = document.querySelector('.weekly-schedule-dialog');
    assert.ok(schedule);
    assert.equal(schedule.querySelector('input[type="date"]').value, today);
    [...schedule.querySelectorAll('button')]
      .find((button) => button.textContent === 'Cancel')
      .click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    // The deferred refresh runs after the drop, so acquire the new elements.
    weeklyCard = document.querySelector('.weekly-note[data-id="weekly"]');
    dragHandle = weeklyCard.querySelector('.month-drag');
    targetDay = document.querySelector(`.month-day[data-date="${today}"]`);
    dragToToday();
    schedule = document.querySelector('.weekly-schedule-dialog');
    schedule.querySelector('input[type="time"]').value = '10:15';
    schedule
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    const scheduled = JSON.parse(local.getItem('dayline.v1')).days[today].find(
      (note) => note.id === 'weekly',
    );
    assert.equal(scheduled.title, 'Weekly direction');
    assert.equal(scheduled.text, 'Keep weekly notes too');
    assert.equal(scheduled.minute, 615);
    assert.equal(scheduled.weekly, undefined);
    document.querySelector('#undo').click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    // On a phone, a floating focus control can sit over a later day. While
    // dragging, hit testing must reach that future day underneath the control.
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
    const futureDate = dayKey(tomorrow);
    let futureDay = document.querySelector(`.month-day[data-date="${futureDate}"]`);
    if (!futureDay) {
      futureDay = document.createElement('section');
      futureDay.className = 'month-day';
      futureDay.dataset.date = futureDate;
      document.querySelector('.month-grid').append(futureDay);
    }
    weeklyCard = document.querySelector('.weekly-note[data-id="weekly"]');
    dragHandle = weeklyCard.querySelector('.month-drag');
    document.elementFromPoint = () =>
      document.body.classList.contains('month-dragging')
        ? futureDay
        : document.querySelector('#launch-focus');
    dragHandle.dispatchEvent(pointer('pointerdown'));
    await new Promise((resolve) => setTimeout(resolve, 380));
    assert.equal(document.body.classList.contains('month-dragging'), true);
    window.dispatchEvent(pointer('pointerup'));
    assert.equal(document.body.classList.contains('month-dragging'), false);
    const futureSchedule = document.querySelector('.weekly-schedule-dialog');
    assert.ok(futureSchedule);
    assert.equal(futureSchedule.querySelector('input[type="date"]').value, futureDate);
    futureSchedule.querySelector('input[type="time"]').value = '10:15';
    futureSchedule
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    const futureSaved = JSON.parse(local.getItem('dayline.v1')).days[futureDate].find(
      (note) => note.id === 'weekly',
    );
    assert.equal(futureSaved.text, 'Keep weekly notes too');
    assert.equal(futureSaved.minute, 615);
    assert.equal(futureSaved.weekly, undefined);
    document.querySelector('#undo').click();
    const afterUndo = JSON.parse(local.getItem('dayline.v1'));
    assert.deepEqual(afterUndo.days[futureDate], []);
    delete afterUndo.days[futureDate];
    assert.deepEqual(afterUndo.days, fixture.days);
    local.setItem('dayline.v1', JSON.stringify(afterUndo));
    const restore = new window.Event('storage');
    Object.defineProperty(restore, 'key', { value: 'dayline.v1' });
    window.dispatchEvent(restore);
    // A real single tap on the day’s empty notes area opens quick add after the
    // double-tap window, rather than requiring the small date heading.
    const emptyArea = document.querySelector(`.month-day[data-date="${today}"] .month-notes`);
    const quickClick = new window.Event('click', { bubbles: true });
    Object.defineProperty(quickClick, 'detail', { value: 1 });
    emptyArea.dispatchEvent(quickClick);
    await new Promise((resolve) => setTimeout(resolve, 450));
    const quick = document.querySelector('.month-quick-dialog');
    assert.equal(quick.open, true);
    const firstRow = quick.querySelector('.month-quick-note');
    firstRow.querySelector('[aria-label="Quick note title"]').value = 'Plan production';
    firstRow.querySelector('[aria-label="Quick note time"]').value = '10:15';
    firstRow.querySelector('[aria-label="Quick note text"]').value =
      'Call the team\nReview the plan';
    firstRow.querySelector('[data-note-type="project"]').click();
    firstRow.querySelector('[data-note-type="event"]').click();
    quick.querySelector('[aria-label="Add another note"]').click();
    const secondRow = quick.querySelectorAll('.month-quick-note')[1];
    assert.equal(secondRow.querySelector('[aria-label="Quick note time"]').value, '10:15');
    secondRow.querySelector('[aria-label="Quick note title"]').value = 'Send email';
    secondRow.querySelector('[aria-label="Quick note time"]').value = '10:45';
    secondRow.querySelector('[aria-label="Quick note text"]').value = 'Share the update.';
    secondRow.querySelector('[data-note-type="admin"]').click();
    quick.querySelector('[aria-label="Add another note"]').click();
    assert.equal(quick.querySelectorAll('.month-quick-note').length, 3);
    quick.querySelector('[aria-label="Remove quick note 3"]').click();
    assert.equal(quick.querySelectorAll('.month-quick-note').length, 2);
    const previousSetItem = local.setItem;
    local.setItem = (key, value) => {
      if (key === 'dayline.v1') throw new Error('Storage full');
      previousSetItem(key, value);
    };
    quick
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(quick.open, true);
    assert.match(quick.textContent, /Could not save these notes/);
    assert.equal(secondRow.querySelector('[aria-label="Quick note title"]').value, 'Send email');
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    local.setItem = previousSetItem;
    quick
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(document.querySelector('.month-quick-dialog'), null);
    const added = JSON.parse(local.getItem('dayline.v1')).days[today].filter((note) =>
      ['Plan production', 'Send email'].includes(note.title),
    );
    assert.equal(added.length, 2);
    assert.deepEqual(
      added.map((note) => [note.minute, note.tags, note.text]),
      [
        [615, ['project', 'event'], 'Call the team\nReview the plan'],
        [645, ['admin'], 'Share the update.'],
      ],
    );
    document.querySelector('#undo').click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    // Expanded Monthly view shows empty intervals and supports mouse, touch,
    // and a non-drag move while preserving Undo and the weekly note.
    const openExpanded = () => {
      document.querySelector(`.month-day[data-date="${today}"] .month-expand-day`).click();
      return document.querySelector('.month-expanded-day');
    };
    let expanded = openExpanded();
    assert.equal(expanded.querySelectorAll('.month-expanded-slot').length, 24);
    assert.equal(expanded.textContent.includes('Duplicate'), false);
    const targetMinute = minute === 60 ? 120 : 60;
    let card = expanded.querySelector('.month-expanded-note[data-id="saved-note"]');
    assert.ok(card.querySelector('[aria-label^="Delete note:"]'));
    let handle = card.querySelector('.month-expanded-handle');
    let target = expanded.querySelector(`.month-expanded-slot[data-minute="${targetMinute}"]`);
    const nativeStart = new window.Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(nativeStart, 'dataTransfer', { value: { setData() {} } });
    handle.dispatchEvent(nativeStart);
    target.dispatchEvent(new window.Event('drop', { bubbles: true, cancelable: true }));
    assert.equal(
      JSON.parse(local.getItem('dayline.v1')).days[today].find((n) => n.id === 'saved-note').minute,
      targetMinute,
    );
    expanded.close();
    document.querySelector('#undo').click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);

    expanded = openExpanded();
    card = expanded.querySelector('.month-expanded-note[data-id="saved-note"]');
    handle = card.querySelector('.month-expanded-handle');
    target = expanded.querySelector(`.month-expanded-slot[data-minute="${targetMinute}"]`);
    document.elementFromPoint = () => target;
    handle.dispatchEvent(pointer('pointerdown'));
    await new Promise((resolve) => setTimeout(resolve, 380));
    window.dispatchEvent(pointer('pointerup'));
    assert.equal(
      JSON.parse(local.getItem('dayline.v1')).days[today].find((n) => n.id === 'saved-note').minute,
      targetMinute,
    );
    expanded.close();
    document.querySelector('#undo').click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);

    expanded = openExpanded();
    card = expanded.querySelector('.month-expanded-note[data-id="saved-note"]');
    [...card.querySelectorAll('button')].find((button) => button.textContent === 'Move').click();
    card.querySelector('.month-expanded-move select').value = String(targetMinute);
    card
      .querySelector('.month-expanded-move')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(
      JSON.parse(local.getItem('dayline.v1')).days[today].find((n) => n.id === 'saved-note').minute,
      targetMinute,
    );
    expanded.close();
    document.querySelector('#undo').click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);

    expanded = openExpanded();
    card = expanded.querySelector('.month-expanded-note[data-id="saved-note"]');
    card.querySelector('[aria-label^="Delete note:"]').click();
    assert.ok(
      !JSON.parse(local.getItem('dayline.v1')).days[today].some((n) => n.id === 'saved-note'),
    );
    expanded.close();
    document.querySelector('#undo').click();
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    document.querySelector('#settings-tab').click();
    assert.equal(document.querySelector('#google-settings'), null);
    assert.equal(document.querySelectorAll('script[src*="google"]').length, 0);
    for (const mode of ['astronaut', 'gamer', 'zen', 'builder', 'founder']) {
      const choice = document.querySelector(`input[name="layout"][value="${mode}"]`);
      choice.checked = true;
      choice.dispatchEvent(new window.Event('change'));
      assert.equal(document.documentElement.dataset.layout, mode);
      assert.equal(local.getItem('dayline.appearance.v1'), mode);
      assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    }
    document.querySelector('#reopen-welcome').click();
    const welcome = document.querySelector('.welcome-window');
    assert.equal(welcome.open, true);
    assert.equal(welcome.querySelectorAll('input[name="welcome-personality"]').length, 6);
    for (const input of welcome.querySelectorAll('input[name="welcome-personality"]')) {
      input.checked = input.value === 'builder';
    }
    welcome.querySelector('input[value="builder"]').dispatchEvent(new window.Event('change'));
    assert.equal(
      welcome.querySelector('#welcome-title').textContent,
      'Study carefully. Build deliberately.',
    );
    assert.match(welcome.textContent, /Methodical and visionary/);
    welcome.querySelector('.welcome-cancel').click();
    assert.equal(welcome.open, false);
    for (const [id, heading] of [
      ['builder', 'Prepare for thoughtful work.'],
      ['founder', 'Set the board in your favor.'],
      ['poet', 'Make room for a different argument.'],
      ['gamer', 'Make progress feel like play.'],
      ['zen', 'Find a pace you can sustain.'],
    ]) {
      const choice = document.querySelector(`input[name="layout"][value="${id}"]`);
      choice.checked = true;
      choice.dispatchEvent(new window.Event('change'));
      assert.equal(document.documentElement.dataset.layout, id);
      assert.equal(document.querySelector('#settings-heading').textContent, heading);
    }
    const interval = document.querySelector('#interval');
    interval.value = '30';
    interval.dispatchEvent(new window.Event('change'));
    const saved = JSON.parse(local.getItem('dayline.v1'));
    assert.equal(saved.settings.interval, 30);
    assert.deepEqual(saved.days, fixture.days);
    document.querySelector('#daily-tab').click();
    assert.match(document.querySelector('#timeline').textContent, /Saved plan/);
    document.querySelector('#launch-focus-audio').click();
    assert.equal(document.querySelector('.focus-audio-window').open, true);
    assert.equal(local.getItem('dayline.focus.v1'), null);
    [...document.querySelectorAll('.focus-audio-window button')]
      .find((button) => button.textContent === 'Minimize audio')
      .click();
    document.querySelector('#launch-focus').click();
    assert.equal(document.querySelector('.focus-window').open, true);
    document.querySelector('.focus-open-shortcuts').click();
    assert.equal(document.querySelector('.shortcuts-panel').open, true);
    assert.equal(document.querySelector('.focus-window').open, true);
    [...document.querySelectorAll('.shortcuts-panel button')]
      .find((button) => button.textContent === 'Close shortcuts')
      .click();
    assert.equal(document.querySelector('.shortcuts-panel').open, false);
    assert.match(
      document.querySelector('.focus-window').textContent,
      /Choose how you will move through this/,
    );
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
    const gamer = document.querySelector('input[name="layout"][value="gamer"]');
    gamer.checked = true;
    gamer.dispatchEvent(new window.Event('change'));
    assert.equal(
      document.querySelector('.focus-window h1').textContent,
      'Choose your quest. Get ready to win.',
    );
    const astronaut = document.querySelector('input[name="layout"][value="astronaut"]');
    astronaut.checked = true;
    astronaut.dispatchEvent(new window.Event('change'));
    const commit = [...document.querySelectorAll('.focus-window button')].find(
      (button) => button.textContent === 'Commit',
    );
    assert.ok(commit);
    commit.click();
    await new Promise((resolve) => setTimeout(resolve, 1150));
    assert.equal(document.querySelector('.personality-burst')?.dataset.kind, 'focus-commit');
    assert.equal(document.querySelector('.personality-burst')?.parentNode, document.body);
    [...document.querySelectorAll('.focus-window button')]
      .find((button) => button.textContent === 'Explore real stories')
      .click();
    assert.equal(document.querySelector('.inspiration-library').open, true);
    assert.equal(document.querySelector('.focus-window').open, true);
    [...document.querySelectorAll('.inspiration-library button')]
      .find((button) => button.textContent === 'Close')
      .click();
    assert.equal(document.querySelector('.focus-window').open, true);
    document.querySelector('.focus-open-audio').click();
    assert.equal(document.querySelector('.focus-audio-window').open, true);
    assert.equal(document.querySelector('.focus-window .focus-soundtrack-select'), null);
    for (const [mode, label] of [
      ['zen', 'Still temple'],
      ['builder', 'Cyberpunk mission'],
      ['founder', 'Symphonic horizon'],
      ['poet', 'Undertow'],
      ['astronaut', 'Orbital drift'],
      ['gamer', 'Next level'],
    ]) {
      const choice = document.querySelector(`input[name="layout"][value="${mode}"]`);
      choice.checked = true;
      choice.dispatchEvent(new window.Event('change'));
      const soundtrack = document.querySelector('.focus-soundtrack-select');
      assert.ok(soundtrack);
      assert.equal(soundtrack.value, mode);
      assert.match(
        soundtrack.querySelector(`option[value="${mode}"]`).textContent,
        new RegExp(label),
      );
    }
    [...document.querySelectorAll('.focus-audio-window button')]
      .find((button) => button.textContent === 'Play audio')
      .click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      document.querySelector('#launch-focus-audio').textContent,
      'Focus Audio · Playing',
    );
    const independentAudio = local.getItem('dayline.focus-audio.v1');
    [...document.querySelectorAll('.focus-audio-window button')]
      .find((button) => button.textContent === 'Minimize audio')
      .click();
    document.querySelector('.focus-finish').click();
    const skip = [...document.querySelectorAll('.focus-window button')].find(
      (button) => button.textContent === 'Skip reflection & close',
    );
    assert.ok(skip);
    skip.click();
    assert.equal(document.querySelector('.focus-window').open, false);
    assert.equal(document.querySelector('.personality-burst')?.dataset.kind, 'focus-finish');
    assert.match(document.querySelector('.personality-burst').textContent, /Progress saved!/);
    assert.equal(
      document.querySelector('#launch-focus-audio').textContent,
      'Focus Audio · Playing',
    );
    assert.equal(local.getItem('dayline.focus-audio.v1'), independentAudio);
    document.querySelector('#launch-focus-audio').click();
    [...document.querySelectorAll('.focus-audio-window button')]
      .find((button) => button.textContent === 'Pause audio')
      .click();
    await new Promise((resolve) => setTimeout(resolve, 850));
    assert.equal(document.querySelector('#launch-focus-audio').textContent, 'Launch Focus Audio');

    assert.deepEqual(network, []);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
