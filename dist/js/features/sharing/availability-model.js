import {
  dayKey,
  offsetDay,
  parseDay,
  slots,
  bucket,
} from '../../shared/schedule.js?v=15ded251c55d';
import { validDate } from '../bulk/model.js?v=15ded251c55d';
export const availabilityKey = (date, minute) => `${date}:${minute}`;
export function emptyIntervals(
  days,
  { start, end, from = 540, to = 1020, weekdays = [1, 2, 3, 4, 5], interval = 60 },
  now = Date.now(),
) {
  if (!validDate(start) || !validDate(end) || end < start)
    throw new Error('Choose a valid start and end date.');
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > 1440 || from >= to)
    throw new Error('Available hours must end after they start.');
  if (
    !Array.isArray(weekdays) ||
    !weekdays.length ||
    weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new Error('Choose at least one day of the week.');
  const times = slots(interval),
    result = [];
  let count = 0;
  for (let date = start; date <= end; date = offsetDay(date, 1)) {
    if (++count > 31) throw new Error('Choose a range of up to 31 days.');
    if (!weekdays.includes(parseDay(date).getDay())) continue;
    const occupied = new Set(
      (days[date] || [])
        .filter((note) => !note.weekly)
        .map((note) => bucket(note.minute, interval)),
    );
    for (const minute of times) {
      const finish = Math.min(1440, minute + interval);
      if (minute < from || finish > to || occupied.has(minute)) continue;
      const begins = parseDay(date);
      begins.setHours(0, minute, 0, 0);
      // A spring-forward wall-clock time may not exist in this device's zone.
      if (dayKey(begins) !== date || begins.getHours() * 60 + begins.getMinutes() !== minute)
        continue;
      if (begins.getTime() <= now) continue;
      const ends = parseDay(date);
      ends.setHours(0, finish, 0, 0);
      if (ends <= begins) continue;
      result.push({
        key: availabilityKey(date, minute),
        date,
        minute,
        endMinute: finish,
        startAt: begins.getTime(),
        endAt: ends.getTime(),
      });
    }
  }
  return result;
}
export function mergeAvailability(candidates, selected) {
  const ranges = [];
  for (const slot of [...candidates]
    .filter((slot) => selected.has(slot.key))
    .sort((a, b) => a.startAt - b.startAt)) {
    const previous = ranges.at(-1);
    if (
      previous &&
      previous.date === slot.date &&
      previous.endMinute === slot.minute &&
      previous.endAt === slot.startAt
    ) {
      previous.endMinute = slot.endMinute;
      previous.endAt = slot.endAt;
    } else ranges.push({ ...slot });
  }
  return ranges;
}
export function validTimeZone(zone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format();
    return typeof zone === 'string' && !!zone.trim();
  } catch {
    return false;
  }
}
export function availabilityText(
  candidates,
  selected,
  {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    clock = '12',
    now = Date.now(),
  } = {},
) {
  if (!validTimeZone(timeZone))
    throw new Error('Choose a valid time zone, such as America/Los_Angeles.');
  const ranges = mergeAvailability(
    candidates.filter((slot) => slot.startAt > now),
    selected,
  );
  if (!ranges.length) return '';
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: clock !== '24',
    timeZoneName: 'short',
  });
  const groups = new Map();
  for (const range of ranges) {
    const date = dateFormat.format(range.startAt),
      endsDate = dateFormat.format(range.endAt);
    const text = `${timeFormat.format(range.startAt)} – ${timeFormat.format(range.endAt)}${date === endsDate ? '' : ` (${endsDate})`}`;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(text);
  }
  const snapshot = new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(now);
  return [
    'My availability',
    `Time zone: ${timeZone}`,
    '',
    ...[...groups].map(([date, times]) => `${date}: ${times.join(', ')}`),
    '',
    `Availability as of ${snapshot}. Please confirm before booking.`,
  ].join('\n');
}
