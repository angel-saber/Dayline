import { node } from '../../shared/dom.js?v=f7bbc01b5bdc';
import { hourInput, inputMinute } from '../settings/available-hours.js?v=f7bbc01b5bdc';
export const NIGHT_ORDER_KEY = 'dayline.daily-order.v1';
export function readNightOrder(storage = localStorage) {
  try {
    const p = JSON.parse(storage.getItem(NIGHT_ORDER_KEY) || 'null');
    if (
      p &&
      typeof p.enabled === 'boolean' &&
      Number.isInteger(p.start) &&
      p.start >= 0 &&
      p.start < 1440
    )
      return p;
  } catch {}
  return { enabled: false, start: 1080 };
}
export function orderDailySlots(slots, preference) {
  if (!preference.enabled) return slots;
  const timed = slots.filter((s) => !s.allDay).map((s) => s.minute);
  const start = Math.max(0, ...timed.filter((m) => m <= preference.start));
  return slots
    .slice()
    .sort((a, b) =>
      a.allDay
        ? -1
        : b.allDay
          ? 1
          : ((a.minute - start + 1440) % 1440) - ((b.minute - start + 1440) % 1440),
    );
}
export function setupNightOrder({ root, onChange, toast, storage = localStorage }) {
  const card = node('section', 'settings-card');
  card.append(
    node('h2', '', 'Night-first Daily timetable'),
    node(
      'p',
      '',
      'Show evening intervals first, then earlier hours of the same calendar date. This changes display order only; note dates, times and reminders stay unchanged.',
    ),
  );
  const label = node('label'),
    toggle = node('input');
  toggle.type = 'checkbox';
  toggle.setAttribute('aria-label', 'Night-first Daily timetable');
  toggle.checked = readNightOrder(storage).enabled;
  label.append(toggle, document.createTextNode('Flip Daily into night-first order'));
  const startLabel = node('label', '', 'Start the timetable at'),
    start = node('input');
  start.type = 'time';
  start.setAttribute('aria-label', 'Night timetable start time');
  start.value = hourInput(readNightOrder(storage).start);
  startLabel.append(start);
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  function write() {
    const minute = inputMinute(start.value);
    if (!Number.isInteger(minute)) {
      status.textContent = 'Choose a valid start time.';
      return;
    }
    try {
      storage.setItem(NIGHT_ORDER_KEY, JSON.stringify({ enabled: toggle.checked, start: minute }));
      status.textContent = 'Daily timetable order saved on this device.';
      onChange();
    } catch {
      toast('Could not save timetable order.');
    }
  }
  toggle.onchange = write;
  start.onchange = write;
  card.append(label, startLabel, status);
  root.append(card);
  window.addEventListener('storage', (e) => {
    if (e.key === NIGHT_ORDER_KEY || e.key === null) {
      const p = readNightOrder(storage);
      toggle.checked = p.enabled;
      start.value = hourInput(p.start);
      onChange();
    }
  });
}
