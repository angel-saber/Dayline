import { dayKey, parseDay, offsetDay } from '../../shared/schedule.js?v=3bc29ba06496';
import {
  validNoteType,
  validTags,
  noteTags,
  withTags,
  matchesNoteType,
} from '../notes/note-types.js?v=3bc29ba06496';
export const selectionKey = (date, id) => JSON.stringify([date, id]);
export function selectedNotes(days, keys) {
  return Object.entries(days)
    .flatMap(([date, list]) =>
      list
        .filter((entry) => keys.has(selectionKey(date, entry.id)))
        .map((entry) => ({ date, entry })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.entry.minute - b.entry.minute);
}
export function validDate(date) {
  const value = new Date(date + 'T12:00:00Z');
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(value.getTime()) &&
    value.toISOString().slice(0, 10) === date
  );
}
export function scopeRange(anchor, scope) {
  if (!validDate(anchor) || !['day', 'week', 'month'].includes(scope))
    throw new Error('Choose a valid date and selection range.');
  if (scope === 'day') return { start: anchor, end: anchor };
  if (scope === 'week') {
    const start = offsetDay(anchor, -parseDay(anchor).getDay());
    return { start, end: offsetDay(start, 6) };
  }
  const start = anchor.slice(0, 7) + '-01',
    next = parseDay(start);
  next.setMonth(next.getMonth() + 1);
  return { start, end: offsetDay(dayKey(next), -1) };
}
export function matchingNotes(days, anchor, scope, categories) {
  const { start, end } = scopeRange(anchor, scope);
  return Object.entries(days)
    .filter(([date]) => date >= start && date <= end)
    .flatMap(([date, list]) =>
      list
        .filter((e) => !e.weekly && matchesNoteType(e, categories))
        .map((entry) => ({ date, entry })),
    );
}
export function bulkChange(days, keys, action, newId = () => crypto.randomUUID()) {
  const items = selectedNotes(days, keys);
  if (!items.length) throw new Error('Select at least one note.');
  if (!['delete', 'category', 'move'].includes(action.kind))
    throw new Error('Choose a bulk action.');
  if (action.kind === 'category') {
    if (action.tags !== undefined) validTags(action.tags);
    else validNoteType(action.category);
    if (action.mode && !['add', 'remove', 'replace'].includes(action.mode))
      throw new Error('Choose a tag action.');
  }
  if (action.kind === 'move' && !validDate(action.date))
    throw new Error('Choose a valid destination date.');
  let timeDelta = 0;
  if (action.kind === 'move' && action.minute !== undefined) {
    if (!Number.isInteger(action.minute) || action.minute < 0 || action.minute > 1439)
      throw new Error('Choose a valid destination time.');
    if (items.some(({ entry }) => entry.weekly))
      throw new Error('Schedule undated weekly notes before shifting their times.');
    timeDelta = action.minute - items[0].entry.minute;
    if (items.some(({ entry }) => entry.minute + timeDelta < 0 || entry.minute + timeDelta > 1439))
      throw new Error(
        'These notes would cross midnight. Choose a time that keeps the whole group within each day.',
      );
  }
  const next = { ...days },
    previous = {};
  function touch(date) {
    if (!Object.hasOwn(previous, date)) {
      previous[date] = structuredClone(days[date] || []);
      next[date] = [...(days[date] || [])];
    }
  }
  if (action.kind === 'move') {
    const ordinal = (date) => Date.parse(date + 'T12:00:00Z') / 86400000,
      delta = ordinal(action.date) - ordinal(items[0].date);
    const destinations = items.map((item) =>
      action.keepSpacing ? offsetDay(item.date, delta) : action.date,
    );
    for (const date of destinations)
      if (!validDate(date)) throw new Error('The destination is outside the supported calendar.');
    for (const { date, entry } of items) {
      touch(date);
      next[date] = next[date].filter((e) => e.id !== entry.id);
    }
    for (let i = 0; i < items.length; i++) {
      const date = destinations[i];
      touch(date);
      let entry = timeDelta
        ? { ...items[i].entry, minute: items[i].entry.minute + timeDelta }
        : items[i].entry;
      if (next[date].some((e) => e.id === entry.id)) {
        const id = newId();
        if (next[date].some((e) => e.id === id))
          throw new Error('Could not create a unique note ID.');
        entry = { ...entry, id };
      }
      next[date].push(entry);
    }
  } else
    for (const { date, entry } of items) {
      touch(date);
      next[date] =
        action.kind === 'delete'
          ? next[date].filter((e) => e.id !== entry.id)
          : next[date].map((e) =>
              e.id === entry.id
                ? action.tags === undefined
                  ? {
                      ...e,
                      noteType: action.category,
                      ...(e.tags !== undefined
                        ? { tags: action.category ? [action.category] : [] }
                        : {}),
                    }
                  : withTags(
                      e,
                      action.mode === 'replace'
                        ? action.tags
                        : action.mode === 'remove'
                          ? noteTags(e).filter((tag) => !action.tags.includes(tag))
                          : [...new Set([...noteTags(e), ...action.tags])],
                    )
                : e,
            );
    }
  for (const date of Object.keys(previous)) next[date].sort((a, b) => a.minute - b.minute);
  return { days: next, previous, count: items.length };
}
