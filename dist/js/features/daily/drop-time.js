import { untimedLabel } from '../../shared/schedule.js?v=b97af5500a9f';
import { minuteAtPosition } from './precise-time.js?v=b97af5500a9f';
import { timeLabel } from '../../shared/dates.js?v=b97af5500a9f';
import { node } from '../../shared/dom.js?v=b97af5500a9f';
export function snapDropMinute(start, interval, y, rect) {
  if (start < 0) return start;
  const raw = minuteAtPosition(start, interval, y, rect);
  const end = Math.min(1440, start + interval);
  const candidates = [start];
  for (let m = Math.ceil(start / 15) * 15; m < end; m += 15) candidates.push(m);
  return candidates.reduce(
    (best, m) => (Math.abs(m - raw) < Math.abs(best - raw) ? m : best),
    start,
  );
}
export function dropTimePreview(root) {
  let overlay = null;
  function clear() {
    overlay?.remove();
    overlay = null;
  }
  return {
    clear,
    show(slot, y, interval, clock = '24h', override = null) {
      clear();
      if (!slot || !root.contains(slot)) return undefined;
      const start = Number(slot.dataset.minute);
      const rect = (slot.querySelector('.slot-time') || slot).getBoundingClientRect();
      const minute = start < 0 ? start : (override ?? snapDropMinute(start, interval, y, rect));
      overlay = node('div', 'drop-time-overlay');
      overlay.setAttribute('aria-live', 'polite');
      if (start >= 0 && rect.height > 0) {
        const end = Math.min(1440, start + interval);
        for (let m = Math.ceil(start / 15) * 15; m < end; m += 15) {
          const tick = node('span', 'drop-time-tick', timeLabel(m, clock));
          tick.style.top = ((m - start) / (end - start)) * rect.height + 'px';
          overlay.append(tick);
        }
      }
      const label = node(
        'strong',
        'drop-time-lock',
        minute < 0
          ? untimedLabel({ dayPeriod: -2 - minute })
          : 'Drop at ' + timeLabel(minute, clock),
      );
      label.style.top =
        (start < 0
          ? 0
          : Math.max(0, ((minute - start) / Math.min(interval, 1440 - start)) * rect.height)) +
        'px';
      overlay.append(label);
      slot.append(overlay);
      return minute;
    },
  };
}
