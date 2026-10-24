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
    'CustomEvent',
    'matchMedia',
    'CSS',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'setInterval',
    'clearInterval',
    'fetch',
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
    document.querySelector('#monthly-tab').click();
    assert.equal(document.querySelector('#monthly-view').hidden, false);
    assert.match(document.querySelector('#monthly-view').textContent, /Weekly direction/);
    document.querySelector('#settings-tab').click();
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
    assert.equal(welcome.querySelectorAll('input[name="welcome-personality"]').length, 5);
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
    document.querySelector('#launch-focus').click();
    assert.equal(document.querySelector('.focus-window').open, true);
    assert.match(
      document.querySelector('.focus-window').textContent,
      /Choose how you will move through this/,
    );
    assert.deepEqual(JSON.parse(local.getItem('dayline.v1')).days, fixture.days);
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
    for (const [mode, label] of [
      ['zen', 'Still temple'],
      ['builder', 'Cyberpunk mission'],
      ['founder', 'Symphonic horizon'],
      ['astronaut', 'Orbital drift'],
      ['gamer', 'Ascension protocol'],
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
    document.querySelector('.focus-finish').click();
    const skip = [...document.querySelectorAll('.focus-window button')].find(
      (button) => button.textContent === 'Skip reflection & close',
    );
    assert.ok(skip);
    skip.click();
    assert.equal(document.querySelector('.focus-window').open, false);
    assert.equal(document.querySelector('.personality-burst')?.dataset.kind, 'focus-finish');
    assert.deepEqual(network, []);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
