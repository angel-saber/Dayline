import { parseDay, dayKey, offsetDay } from '../../shared/dates.js?v=268df83d9262';
import { validDate } from '../bulk/model.js?v=268df83d9262';
export const MAX_OCCURRENCES = 1000;
export function addMonths(date, count) {
  const original = parseDay(date);
  const target = new Date(original.getFullYear(), original.getMonth() + count, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(original.getDate(), last));
  const result = dayKey(target);
  if (!validDate(result)) throw new Error('Choose a date within the supported calendar.');
  return result;
}
export function cycleEnd(start, unit, amount, custom) {
  if (!validDate(start)) throw new Error('Choose a valid start date.');
  if (unit === 'date') {
    if (!validDate(custom) || custom < start)
      throw new Error('The end date must be on or after the start date.');
    return custom;
  }
  if (
    !['days', 'weeks', 'months'].includes(unit) ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 12000
  )
    throw new Error('Choose a whole duration from 1 to 12000.');
  const end =
    unit === 'months'
      ? offsetDay(addMonths(start, amount), -1)
      : offsetDay(start, amount * (unit === 'weeks' ? 7 : 1) - 1);
  if (!validDate(end)) throw new Error('Choose a date within the supported calendar.');
  return end;
}
export function repeatDates({ start, end, frequency, weekdays = [] }) {
  if (!validDate(start) || !validDate(end) || end < start)
    throw new Error('Choose valid start and end dates.');
  if (!['daily', 'weekly', 'monthly', 'weekdays'].includes(frequency))
    throw new Error('Choose a repeat frequency.');
  if (
    frequency === 'weekdays' &&
    (!Array.isArray(weekdays) ||
      !weekdays.length ||
      weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
  )
    throw new Error('Choose at least one weekday.');
  const dates = [];
  const push = (date) => {
    dates.push(date);
    if (dates.length > MAX_OCCURRENCES)
      throw new Error('Use a shorter cycle: up to 1000 occurrences can be created at once.');
  };
  if (frequency === 'monthly') {
    for (let index = 0; ; index++) {
      const date = addMonths(start, index);
      if (date > end) break;
      push(date);
    }
  } else {
    for (let date = start; date <= end; date = offsetDay(date, frequency === 'weekly' ? 7 : 1)) {
      if (frequency !== 'weekdays' || weekdays.includes(parseDay(date).getDay())) push(date);
    }
  }
  if (!dates.length) throw new Error('No occurrences match these dates and weekdays.');
  return dates;
}
export function createRepeatCycle(days, source, id, rule, newId = () => crypto.randomUUID()) {
  const original = (days[source] || []).find(
    (note) => note.id === id && !note.weekly && !note.yearly,
  );
  if (!original)
    throw new Error(
      'This note is no longer available. Schedule weekly notes before repeating them.',
    );
  const dates = repeatPlan(rule, source);
  if (!dates.length)
    throw new Error('This cycle adds no new notes. Choose another date or a longer duration.');
  const next = { ...days },
    previous = {};
  const seen = new Set(
    Object.values(days)
      .flat()
      .map((note) => note.id),
  );
  const cycleId = newId();
  if (typeof cycleId !== 'string' || !cycleId || seen.has(cycleId))
    throw new Error('Could not create a unique cycle.');
  seen.add(cycleId);
  if (repeatDates(rule).includes(source)) {
    previous[source] = structuredClone(days[source]);
    next[source] = days[source].map((note) =>
      note.id === id
        ? { ...note, repeat: { id: cycleId, start: rule.start, end: rule.end, occurrence: source } }
        : note,
    );
  }
  for (const occurrence of dates) {
    const { date } = occurrence;
    const copy = structuredClone(original);
    copy.id = newId();
    if (typeof copy.id !== 'string' || !copy.id || seen.has(copy.id))
      throw new Error('Could not create unique notes. Please try again.');
    seen.add(copy.id);
    copy.repeat = {
      id: cycleId,
      start: rule.start,
      end: rule.end,
      occurrence: occurrence.original,
    };
    if (occurrence.title !== undefined) copy.title = occurrence.title;
    if (occurrence.minute !== undefined) copy.minute = occurrence.minute;
    if (occurrence.text !== undefined && occurrence.text !== copy.text) {
      copy.text = occurrence.text;
      copy.format = [];
      copy.tasks = [];
      copy.bullets = [];
      copy.indents = [];
    }
    copy.done = false;
    if (copy.tasks) copy.tasks = copy.tasks.map((task) => ({ ...task, done: false }));
    delete copy.focusReports;
    delete copy.guidedActivities;
    previous[date] ??= structuredClone(days[date] || []);
    next[date] = [...(next[date] || []), copy].sort((a, b) => a.minute - b.minute);
  }
  return { days: next, previous, count: dates.length, end: rule.end };
}

export function repeatPlan(rule, source) {
  return repeatDates(rule)
    .filter((date) => date !== source)
    .flatMap((original) => {
      const change = rule.exceptions?.[original] || {};
      if (change.skip === true) return [];
      const date = change.date || original;
      if (!validDate(date) || date < rule.start || date > rule.end)
        throw new Error('Adjusted dates must stay within the cycle’s start and end dates.');
      if (
        change.title !== undefined &&
        (typeof change.title !== 'string' || change.title.length > 200)
      )
        throw new Error('Use titles of up to 200 characters.');
      if (change.text !== undefined && typeof change.text !== 'string')
        throw new Error('Enter valid note text.');
      if (
        change.minute !== undefined &&
        (!Number.isInteger(change.minute) || change.minute < 0 || change.minute >= 1440)
      )
        throw new Error('Choose a valid occurrence time.');
      return [
        {
          original,
          date,
          ...(change.title !== undefined ? { title: change.title } : {}),
          ...(change.text !== undefined ? { text: change.text } : {}),
          ...(change.minute !== undefined ? { minute: change.minute } : {}),
        },
      ];
    });
}
