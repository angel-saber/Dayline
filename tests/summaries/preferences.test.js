import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  DEFAULT_SUMMARY_PREFERENCES,
  SUMMARY_PREFERENCES_KEY,
  SUMMARY_PREFERENCES_EVENT,
  validSummaryPreferences,
  readSummaryPreferences,
  setupSummarySettings,
} from '../../dist/js/features/summaries/preferences.js';
import { createPeriodSummary } from '../../dist/js/features/summaries/view.js';
import {
  summarySource,
  summarizePeriod,
  summaryLine,
} from '../../dist/js/features/summaries/model.js';

test('summary preferences validate saved data and fall back safely when storage is unavailable', () => {
  assert.deepEqual(
    readSummaryPreferences({
      getItem() {
        throw Error('blocked');
      },
    }),
    DEFAULT_SUMMARY_PREFERENCES,
  );
  assert.deepEqual(
    readSummaryPreferences({ getItem: () => '{broken' }),
    DEFAULT_SUMMARY_PREFERENCES,
  );
  assert.throws(() => validSummaryPreferences({ tags: 'yes' }));
  assert.throws(() => validSummaryPreferences({ tagMode: 'other' }));
  assert.equal(validSummaryPreferences({ tagMode: 'count' }).tagMode, 'count');
});

test('summary figures switch to exact counts and each compact section can be hidden', () => {
  const data = summarizePeriod(
    summarySource({ '2026-11-26': [{ tags: ['project'] }, { tags: [] }, { tags: [] }] }),
    '2026-11-26',
    '2026-11-26',
  );
  assert.match(summaryLine(data), /Project 33%/);
  assert.match(summaryLine(data, { tagMode: 'count' }), /Project 1 note/);
  assert.doesNotMatch(summaryLine(data, { tags: false }), /Project|Untagged/);
  assert.equal(summaryLine(data, { notes: false, tags: false, focus: false, holidays: false }), '');
});

test('inline tag toggles persist, synchronize views and Settings, and do not open Details or write notes', () => {
  const previous = new Map(
    ['window', 'document', 'localStorage'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const { window } = parseHTML('<html><body><main></main></body></html>');
  const values = new Map([['dayline.v1', 'unchanged notes']]);
  let fail = false;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (fail) throw Error('quota');
      values.set(key, value);
    },
  };
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
  for (const [key, value] of Object.entries({
    window,
    document: window.document,
    localStorage: storage,
  }))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  try {
    const data = summarizePeriod(
      summarySource({ '2026-11-26': [{ tags: ['project', 'admin', 'event', 'personal'] }] }),
      '2026-11-26',
      '2026-11-26',
    );
    const first = createPeriodSummary('Day'),
      second = createPeriodSummary('Week');
    first.update(data);
    second.update(data);
    window.addEventListener(SUMMARY_PREFERENCES_EVENT, () => {
      first.update(data);
      second.update(data);
    });
    const messages = [];
    const settings = setupSummarySettings({
      root: document.body,
      storage,
      toast: (message) => messages.push(message),
    });
    const scroll = first.element.querySelector('.summary-tags-scroll');
    assert.equal(scroll.getAttribute('role'), 'region');
    for (const label of ['Project', 'Admin', 'Event', 'Personal'])
      assert.match(scroll.textContent, new RegExp(label));
    assert.doesNotMatch(scroll.textContent, /\+\d+ tags/);
    scroll.scrollLeft = 0;
    const arrow = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(arrow, 'key', { value: 'ArrowRight' });
    scroll.dispatchEvent(arrow);
    assert.equal(scroll.scrollLeft, 100);
    assert.equal(arrow.defaultPrevented, true);
    assert.equal(first.element.hasAttribute('open'), false);
    assert.equal(readSummaryPreferences(storage).tagMode, 'percentage');
    for (const [type, x] of [
      ['pointerdown', 10],
      ['pointermove', 80],
      ['pointerup', 80],
    ]) {
      const event = new window.Event(type, { bubbles: true });
      Object.defineProperty(event, 'clientX', { value: x });
      scroll.dispatchEvent(event);
    }
    first.element.querySelector('.summary-tags-toggle').click();
    assert.equal(readSummaryPreferences(storage).tagMode, 'percentage');
    assert.equal(first.element.hasAttribute('open'), false);
    first.element.querySelector('.summary-tags-toggle').click();
    assert.equal(first.element.querySelector('.summary-tags-scroll').scrollLeft, 100);
    for (const label of ['Project', 'Admin', 'Event', 'Personal'])
      assert.match(
        first.element.querySelector('.summary-tags-scroll').textContent,
        new RegExp(`${label} 1 note`),
      );
    assert.equal(first.element.hasAttribute('open'), false);
    assert.match(first.element.querySelector('.summary-tags-toggle').textContent, /Project 1 note/);
    assert.match(
      second.element.querySelector('.summary-tags-toggle').textContent,
      /Project 1 note/,
    );
    assert.equal(settings.element.querySelector('select').value, 'count');
    assert.equal(JSON.parse(values.get(SUMMARY_PREFERENCES_KEY)).tagMode, 'count');
    const fresh = createPeriodSummary('Month');
    fresh.update(data);
    assert.match(fresh.element.querySelector('.summary-tags-toggle').textContent, /1 note/);
    first.element.querySelector('.summary-tags-toggle').click();
    assert.match(second.element.querySelector('.summary-tags-toggle').textContent, /100%/);
    const tags = settings.element.querySelector('[data-summary-preference="tags"]');
    tags.checked = false;
    tags.dispatchEvent(new window.Event('change'));
    assert.equal(first.element.querySelector('.summary-tags-toggle'), null);
    assert.match(
      first.element.querySelector('.period-summary-breakdown').textContent,
      /Project: 1 of 1/,
    );
    for (const key of ['notes', 'focus', 'holidays']) {
      const input = settings.element.querySelector(`[data-summary-preference="${key}"]`);
      input.checked = false;
      input.dispatchEvent(new window.Event('change'));
    }
    assert.equal(first.element.hidden, true);
    fail = true;
    tags.checked = true;
    tags.dispatchEvent(new window.Event('change'));
    assert.equal(tags.checked, false);
    assert.equal(messages.length, 1);
    fail = false;
    tags.checked = true;
    tags.dispatchEvent(new window.Event('change'));
    assert.equal(first.element.hidden, false);
    fail = true;
    first.element.querySelector('.summary-tags-toggle').click();
    assert.equal(messages.length, 2);
    assert.match(first.element.querySelector('.summary-tags-toggle').textContent, /100%/);
    assert.equal(values.get('dayline.v1'), 'unchanged notes');
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
