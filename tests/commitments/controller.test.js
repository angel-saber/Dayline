import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { setupCommitments } from '../../dist/js/features/commitments/controller.js';
import { COMMITMENTS_KEY } from '../../dist/js/features/commitments/model.js';
test('custom duration edits keep IDs, failed writes retain drafts, removing habits keeps reports, corrupt storage is never replaced', () => {
  const { window, document } = parseHTML(
    '<html><body><div id="planner"><button id="launch-commitments"></button></div></body></html>',
  );
  const old = Object.fromEntries(
    ['window', 'document'].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: window },
    document: { configurable: true, value: document },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  const values = new Map();
  let fail = false;
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => {
      if (fail) throw Error('Full');
      values.set(k, v);
    },
  };
  const state = { days: { '2026-11-05': [{ text: 'Keep report', focusReports: [] }] } };
  try {
    setupCommitments({ storage, getState: () => state, startPractice() {} });
    const dialog = document.querySelector('dialog'),
      title = dialog.querySelector('[aria-label="Habit name"]'),
      minutes = dialog.querySelector('[aria-label="Daily focus minutes"]');
    const submit = () =>
      dialog.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    const click = (text) =>
      [...dialog.querySelectorAll('button')].find((b) => b.textContent === text).click();
    title.value = 'My custom practice';
    minutes.value = '15';
    fail = true;
    submit();
    assert.equal(values.size, 0);
    assert.equal(title.value, 'My custom practice');
    fail = false;
    submit();
    const first = JSON.parse(values.get(COMMITMENTS_KEY))[0];
    assert.equal(first.minutes, 15);
    click('Edit');
    minutes.value = '45';
    submit();
    const edited = JSON.parse(values.get(COMMITMENTS_KEY))[0];
    assert.equal(edited.id, first.id);
    assert.equal(edited.minutes, 45);
    click('Remove');
    assert.deepEqual(JSON.parse(values.get(COMMITMENTS_KEY)), []);
    assert.equal(state.days['2026-11-05'][0].text, 'Keep report');
    values.set(COMMITMENTS_KEY, 'corrupt');
    document.querySelector('#launch-commitments').click();
    title.value = 'Another';
    submit();
    assert.equal(values.get(COMMITMENTS_KEY), 'corrupt');
    assert.match(dialog.textContent, /have not been overwritten/);
  } finally {
    for (const [k, d] of Object.entries(old)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
});
