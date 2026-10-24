import test from 'node:test';
import assert from 'node:assert/strict';
import { Reminders, resolveReminder } from '../../dist/js/features/reminders/reminders.js';
import { dayKey } from '../../dist/js/shared/schedule.js';
test('clicking an existing planned notification focuses Dayline, closes the notification, and opens its captured note', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Notification'),
    oldFocus = globalThis.focus,
    oldNow = Date.now;
  const notifications = [],
    opened = [],
    due = [],
    errors = [];
  let focused = 0;
  class MockNotification {
    static permission = 'granted';
    constructor(title, options) {
      this.title = title;
      this.options = options;
      notifications.push(this);
    }
    close() {
      this.closed = true;
    }
  }
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: MockNotification,
  });
  globalThis.focus = () => focused++;
  const today = new Date();
  today.setHours(10, 0, 0, 0);
  const now = today.getTime(),
    date = dayKey(today);
  Date.now = () => now;
  const entry = { id: 'note-1', minute: 600, text: 'Planned text', title: 'Plan', done: false },
    state = {
      settings: { notifications: true, sound: false, interval: 60 },
      days: { [date]: [entry] },
    };
  const reminders = new Reminders(
    () => state,
    (e) => due.push(e),
    (e) => errors.push(e),
    (target) => opened.push(target),
  );
  clearInterval(reminders.timer);
  try {
    reminders.last = now - 1000;
    reminders.tick();
    assert.equal(notifications.length, 1);
    assert.deepEqual(due, [entry]);
    assert.equal(notifications[0].options.body, 'Plan\nPlanned text');
    Date.now = () => now + 86400000;
    notifications[0].onclick();
    assert.deepEqual(opened, [{ date, id: 'note-1', minute: 600 }]);
    assert.equal(focused, 1);
    assert.equal(notifications[0].closed, true);
    assert.deepEqual(errors, []);
    Date.now = () => now;
    reminders.tick();
    assert.equal(notifications.length, 1);
  } finally {
    Date.now = oldNow;
    globalThis.focus = oldFocus;
    if (descriptor) Object.defineProperty(globalThis, 'Notification', descriptor);
    else delete globalThis.Notification;
  }
});
test('notification destinations follow a moved note and the currently selected interval length', () => {
  const target = { date: '2026-10-22', id: 'planned', minute: 600 };
  assert.deepEqual(
    resolveReminder({ '2026-10-23': [{ id: 'planned', minute: 735 }] }, target, 30),
    { date: '2026-10-23', id: 'planned', minute: 720, found: true },
  );
  assert.deepEqual(resolveReminder({}, target, 240), { ...target, minute: 480, found: false });
});
