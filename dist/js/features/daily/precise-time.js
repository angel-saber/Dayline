import { node } from '../../shared/dom.js?v=f2c75fe48c17';
import { timeLabel } from '../../shared/dates.js?v=f2c75fe48c17';
// The gutter's displayed start/end bounds define time, independent of page scroll.
export function minuteAtPosition(start, interval, y, { top, height }) {
  if (
    !Number.isInteger(start) ||
    start < 0 ||
    start >= 1440 ||
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 1440
  )
    throw new Error('Choose a valid interval.');
  if (!Number.isFinite(y) || !Number.isFinite(top) || !Number.isFinite(height) || height <= 0)
    return start;
  const duration = Math.min(interval, 1440 - start),
    fraction = Math.max(0, Math.min(1, (y - top) / height));
  return start + Math.min(duration - 1, Math.round(fraction * duration));
}
export function bindPreciseTime({
  row,
  time,
  notes,
  start,
  interval,
  clock,
  onAdd,
  isSelecting = () => false,
}) {
  const preview = node('span', 'interval-time-preview');
  preview.hidden = true;
  preview.setAttribute('aria-hidden', 'true');
  time.append(preview);
  function suggested(event) {
    // Keyboard and assistive activation use the interval start and the normal editable time field.
    if (event.detail === 0 || !Number.isFinite(event.clientY)) return start;
    return minuteAtPosition(start, interval, event.clientY, time.getBoundingClientRect());
  }
  function add(event) {
    if (event.defaultPrevented || isSelecting()) return;
    if (event.button !== undefined && event.button !== 0) return;
    const minute = suggested(event);
    preview.hidden = true;
    onAdd(minute);
  }
  time.addEventListener('click', add);
  row.addEventListener('click', (event) => {
    if ((event.target === row || event.target === notes) && !notes.querySelector('.editor'))
      add(event);
  });
  row.addEventListener('pointermove', (event) => {
    if (
      event.pointerType === 'touch' ||
      event.buttons ||
      isSelecting() ||
      event.target.closest('.entry,.editor,.slot-add') ||
      row.classList.contains('drop-target')
    ) {
      preview.hidden = true;
      return;
    }
    const minute = minuteAtPosition(start, interval, event.clientY, time.getBoundingClientRect());
    const rect = time.getBoundingClientRect();
    preview.textContent = '+ ' + timeLabel(minute, clock);
    preview.style.top = Math.max(0, Math.min(rect.height, event.clientY - rect.top)) + 'px';
    preview.hidden = false;
  });
  row.addEventListener('pointerleave', () => {
    preview.hidden = true;
  });
  return { add };
}
