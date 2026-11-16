import { parseDay } from './dates.js?v=c2797d5cdbe9';
export { dayKey, parseDay, offsetDay, timeLabel } from './dates.js?v=c2797d5cdbe9';
export const DEFAULT_SETTINGS = { interval: 60, notifications: false, sound: false, clock: '12' };
export function slots(interval) {
  if (!Number.isInteger(interval) || interval < 1 || interval > 1440)
    throw new Error('Choose 1–1440 whole minutes.');
  return Array.from({ length: Math.ceil(1440 / interval) }, (_, i) => i * interval);
}
export function bucket(minute, interval) {
  return Math.floor(minute / interval) * interval;
}
export function grouped(entries, interval) {
  const result = slots(interval).map((minute) => ({ minute, entries: [] }));
  const byMinute = new Map(result.map((slot) => [slot.minute, slot]));
  for (const entry of entries.filter((e) => !e.allDay))
    byMinute.get(bucket(entry.minute, interval))?.entries.push(entry);
  const allDay = entries.filter((e) => e.allDay);
  if (allDay.length) result.unshift({ minute: 0, allDay: true, entries: allDay });
  return result;
}
export const DAY_PERIODS = [
  { label: 'Morning', minute: 0 },
  { label: 'Afternoon', minute: 720 },
  { label: 'Evening', minute: 1020 },
];
export const untimedLabel = (entry) => DAY_PERIODS[entry.dayPeriod]?.label || 'All day';
export const dailySlotKey = (entry, interval) =>
  entry.allDay
    ? DAY_PERIODS[entry.dayPeriod]
      ? -2 - entry.dayPeriod
      : -1
    : bucket(entry.minute, interval);

export function dailyGroups(entries, interval) {
  const groups = grouped(
    entries.filter((entry) => dailySlotKey(entry, interval) >= -1),
    interval,
  );
  for (const [dayPeriod, { minute }] of DAY_PERIODS.entries()) {
    const notes = entries.filter((entry) => entry.allDay && entry.dayPeriod === dayPeriod);
    if (!notes.length) continue;
    notes.sort((a, b) => (a.dayPlanOrder ?? Infinity) - (b.dayPlanOrder ?? Infinity));
    const index = groups.findIndex((slot) => !slot.allDay && slot.minute >= minute);
    groups.splice(index < 0 ? groups.length : index, 0, {
      minute,
      allDay: true,
      dayPeriod,
      entries: notes,
    });
  }
  return groups;
}
// Stable insertion: occupied slots shift toward the space left by the source.
// Notes sharing a bucket after an interval change always travel together when shifted.
export function moveEntry(entries, id, targetMinute, interval) {
  const moved = entries.find((e) => e.id === id);
  const starts = slots(interval);
  if (!moved || !starts.includes(targetMinute)) return entries;
  const source = bucket(moved.minute, interval);
  if (source === targetMinute) return entries;
  return entries
    .map((e) => {
      if (e.id === id) return { ...e, minute: Math.min(1439, targetMinute + e.minute - source) };
      const b = bucket(e.minute, interval);
      if (source < targetMinute && b > source && b <= targetMinute)
        return { ...e, minute: e.minute - interval };
      if (source > targetMinute && b >= targetMinute && b < source)
        return { ...e, minute: Math.min(1439, e.minute + interval) };
      return e;
    })
    .sort((a, b) => a.minute - b.minute);
}
// A normal drop joins a slot. A deliberately held target swaps just those notes.
export function dropEntry(entries, id, targetMinute, interval, targetId = null, exact = false) {
  const moved = entries.find((e) => e.id === id);
  if (!moved) return entries;
  if (Number.isInteger(targetMinute) && targetMinute >= -4 && targetMinute < 0) {
    const dayPeriod = targetMinute === -1 ? undefined : -2 - targetMinute;
    const minute = DAY_PERIODS[dayPeriod]?.minute ?? moved.minute;
    return entries.map((e) =>
      e.id === id
        ? { ...e, allDay: true, remind: false, dayPeriod, minute, dayPlanOrder: undefined }
        : e,
    );
  }
  if (
    exact
      ? !Number.isInteger(targetMinute) || targetMinute < 0 || targetMinute > 1439
      : !slots(interval).includes(targetMinute)
  )
    return entries;
  if (moved.allDay)
    return entries
      .map((e) => (e.id === id ? { ...e, allDay: false, remind: false, minute: targetMinute } : e))
      .sort((a, b) => a.minute - b.minute);
  const target =
    targetId && targetId !== id
      ? entries.find(
          (e) => e.id === targetId && bucket(e.minute, interval) === bucket(targetMinute, interval),
        )
      : null;
  if (target)
    return entries
      .map((e) =>
        e.id === id
          ? { ...e, minute: target.minute }
          : e.id === target.id
            ? { ...e, minute: moved.minute }
            : e,
      )
      .sort((a, b) => a.minute - b.minute);
  const source = bucket(moved.minute, interval);
  if (!exact && source === targetMinute) return entries;
  const minute = exact ? targetMinute : Math.min(1439, targetMinute + moved.minute - source);
  return entries
    .map((e) => (e.id === id ? { ...e, minute } : e))
    .sort((a, b) => a.minute - b.minute);
}
export function dueEntries(entries, key, interval, from, now) {
  return entries.filter((e) => {
    if (
      e.weekly ||
      e.yearly ||
      (e.allDay && !e.remind) ||
      e.done ||
      !(e.title?.trim() || e.text).trim()
    )
      return false;
    const date = parseDay(key);
    date.setHours(0, 0, 0, 0);
    date.setMinutes(e.minute);
    return date.getTime() > from && date.getTime() <= now;
  });
}
