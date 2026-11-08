import { minuteAtPosition } from './precise-time.js?v=c0487c930675';
import { timeLabel } from '../../shared/dates.js?v=c0487c930675';
import { node } from '../../shared/dom.js?v=c0487c930675';
export function snapDropMinute(start, interval, y, rect) {
  if (start === -1) return -1;
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
      const minute = override ?? snapDropMinute(start, interval, y, rect);
      overlay = node('div', 'drop-time-overlay');
      overlay.setAttribute('aria-live', 'polite');
      if (start !== -1 && rect.height > 0) {
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
        minute === -1 ? 'All day' : 'Drop at ' + timeLabel(minute, clock),
      );
      label.style.top =
        (start === -1
          ? 0
          : Math.max(0, ((minute - start) / Math.min(interval, 1440 - start)) * rect.height)) +
        'px';
      overlay.append(label);
      slot.append(overlay);
      return minute;
    },
  };
}
