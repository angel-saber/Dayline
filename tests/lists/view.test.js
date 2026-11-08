import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { cardList } from '../../dist/js/features/lists/view.js';
import { layoutToggle, readLayout, writeLayout } from '../../dist/js/features/lists/preferences.js';
function harness(run) {
  const { window, document } = parseHTML('<html><body></body></html>');
  const keys = [
    'window',
    'document',
    'localStorage',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  const old = keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  Object.assign(globalThis, {
    window,
    document,
    localStorage: storage,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  });
  window.scrollBy = () => {};
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return (
        [...this.options].find((o) => o.hasAttribute('selected'))?.value ||
        this.options[0]?.value ||
        ''
      );
    },
    set(v) {
      for (const o of this.options) o.toggleAttribute('selected', o.value === v);
    },
  });
  try {
    run({ window, document, storage });
  } finally {
    for (const [k, d] of old) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
}
test('Schedule/List controls remember independent views and tolerate unavailable/corrupt storage', () =>
  harness(({ document, storage }) => {
    assert.equal(readLayout('daily'), 'schedule');
    let renders = 0;
    const toggle = layoutToggle('daily', () => renders++);
    document.body.append(toggle);
    assert.deepEqual(
      [...toggle.querySelectorAll('button')].map((b) => b.textContent),
      ['Schedule', 'List'],
    );
    toggle.querySelector('[data-layout-option="list"]').click();
    assert.equal(renders, 1);
    assert.equal(readLayout('daily'), 'list');
    assert.equal(readLayout('monthly'), 'schedule');
    assert.equal(writeLayout('monthly', 'list'), true);
    assert.equal(readLayout('daily'), 'list');
    storage.setItem('dayline.list-layout.v1', 'broken');
    assert.equal(readLayout('daily'), 'schedule');
    assert.equal(
      writeLayout('daily', 'list', {
        getItem() {
          throw Error('blocked');
        },
        setItem() {
          throw Error('blocked');
        },
      }),
      false,
    );
  }));
test('card list exposes full details safely, completion filters, swipe actions, pointer/keyboard reorder and cancellation', () =>
  harness(({ window, document }) => {
    const items = [
      {
        date: '2026-11-01',
        entry: {
          id: 'a',
          title: 'Past plan',
          text: '<script>literal</script>',
          minute: 600,
          done: false,
        },
      },
      {
        date: '2026-11-08',
        entry: { id: 'b', title: 'Done', text: 'Keep', minute: 700, done: true },
      },
    ];
    const events = [];
    const actions = {
      complete: (item) => events.push(['complete', item.entry.id]),
      remove: (item) => events.push(['remove', item.entry.id]),
      checkTask() {},
      reorder: (...args) => events.push(['reorder', ...args.slice(2)]),
      resetOrder() {},
    };
    const section = cardList({
      items,
      view: 'monthly',
      clock: '24',
      actions,
      onEdit: (item) => events.push(['edit', item.entry.id]),
      onReschedule: (item) => events.push(['move', item.entry.id]),
    });
    document.body.append(section);
    assert.equal(section.querySelectorAll('.planner-note-card').length, 2);
    assert.equal(section.querySelector('script'), null);
    assert.match(section.querySelector('.list-card-body').textContent, /<script>literal/);
    const filter = section.querySelector('select');
    filter.value = 'open';
    filter.dispatchEvent(new window.Event('change'));
    assert.equal(section.querySelectorAll('.planner-note-card').length, 1);
    filter.value = 'all';
    filter.dispatchEvent(new window.Event('change'));
    const cards = section.querySelectorAll('.planner-note-card');
    const send = (el, type, x, y = 150, id = 1) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { button: 0, clientX: x, clientY: y, pointerId: id });
      el.dispatchEvent(event);
    };
    const title = cards[0].querySelector('.list-note-title');
    send(title, 'pointerdown', 100);
    send(title, 'pointerup', 190);
    assert.deepEqual(events.pop(), ['complete', 'a']);
    send(title, 'pointerdown', 100);
    send(title, 'pointerup', 0);
    assert.deepEqual(events.pop(), ['remove', 'a']);
    const handle = cards[0].querySelector('.list-reorder');
    document.elementFromPoint = () => cards[1];
    cards[1].getBoundingClientRect = () => ({ top: 100, height: 80 });
    send(handle, 'pointerdown', 100);
    send(handle, 'pointermove', 100, 170);
    send(handle, 'pointerup', 100, 170);
    assert.deepEqual(events.pop(), ['reorder', '2026-11-01/a', '2026-11-08/b', true]);
    send(handle, 'pointerdown', 100);
    send(handle, 'pointercancel', 100);
    send(handle, 'pointerup', 100);
    assert.equal(events.length, 0);
    const key = new window.Event('keydown', { bubbles: true, cancelable: true });
    key.key = 'ArrowDown';
    handle.dispatchEvent(key);
    assert.deepEqual(events.pop(), ['reorder', '2026-11-01/a', '2026-11-08/b', true]);
  }));
