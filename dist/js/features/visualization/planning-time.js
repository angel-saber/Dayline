import { dayKey, offsetDay } from '../../shared/dates.js?v=73be664608f3';

export function planningClock(now, hours) {
  const minute = now.getHours() * 60 + now.getMinutes();
  const overnight = hours.to <= hours.from;
  const afterMidnight = overnight && minute < hours.from;
  const today = afterMidnight ? offsetDay(dayKey(now), -1) : dayKey(now);
  const current = minute + (afterMidnight ? 1440 : 0);
  const end = hours.to + (overnight ? 1440 : 0);
  const start = hours.from;
  return { today, current, start, end, remaining: Math.max(0, end - Math.max(start, current)) };
}

export function freeGaps(from, until, notes, durationOf) {
  const busy = notes
    .filter((note) => !note.allDay && !note.done && (note.commitmentId || note.focusBlockMinutes))
    .map((note) => [note.minute, note.minute + durationOf(note)])
    .sort((a, b) => a[0] - b[0]);
  let cursor = from;
  const gaps = [];
  for (const [start, end] of busy) {
    if (start >= until) break;
    if (start > cursor) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < until) gaps.push([cursor, until]);
  return gaps;
}

export function suggestedApproach(stress, motivation, remaining) {
  if (remaining === 0) return 'wrap';
  if (stress === 'High') return motivation === 'High' ? 'focus' : 'smaller';
  if (stress === 'Low' && motivation === 'Low') return 'small';
  if (motivation === 'High') return 'focus';
  return 'review';
}
