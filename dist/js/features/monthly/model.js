import { validTags } from '../notes/note-types.js?v=e40ab8c1395f';
import { dayKey, parseDay, offsetDay } from '../../shared/schedule.js?v=e40ab8c1395f';
export function monthWeeks(month) {
  const first = month + '-01',
    start = offsetDay(first, -parseDay(first).getDay()),
    weeks = [];
  let day = start;
  do {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = offsetDay(day, 1);
    }
    weeks.push(week);
  } while (day.slice(0, 7) === month);
  return weeks;
}
export function offsetMonth(month, delta) {
  const date = parseDay(month + '-01');
  date.setMonth(date.getMonth() + delta);
  return dayKey(date).slice(0, 7);
}
export function noteTitle(entry) {
  return (
    entry.title?.trim() ||
    entry.text
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ||
    'Untitled note'
  );
}
export function moveToDay(days, source, id, target) {
  const date = new Date(target + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(target) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== target
  )
    throw new Error('Choose a valid date.');
  const entry = days[source]?.find((e) => e.id === id);
  if (!entry || source === target) return days;
  if (days[target]?.some((e) => e.id === id))
    throw new Error('That date already contains a note with the same ID.');
  return {
    ...days,
    [source]: days[source].filter((e) => e.id !== id),
    [target]: [...(days[target] || []), entry].sort((a, b) => a.minute - b.minute),
  };
}
export function quickNote(title, time, id, text = '') {
  if (typeof text !== 'string') throw new Error('Enter valid note text.');
  title = title.trim();
  if (!title || title.length > 200) throw new Error('Enter a title of 1–200 characters.');
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid time.');
  const [hour, minute] = time.split(':').map(Number);
  return {
    id,
    title,
    text,
    minute: hour * 60 + minute,
    done: false,
    task: false,
    format: [],
    tasks: [],
  };
}

// Build the whole batch before the caller updates planner state.
export function quickNotes(drafts, newId = () => crypto.randomUUID(), existingIds = []) {
  if (!Array.isArray(drafts) || !drafts.length) throw new Error('Add at least one note.');
  const seen = new Set(existingIds);
  return drafts.map(({ title, time, tags, text }) => {
    const id = newId();
    if (typeof id !== 'string' || !id || seen.has(id))
      throw new Error('Could not create a unique note ID.');
    seen.add(id);
    const selected = validTags(tags);
    return { ...quickNote(title, time, id, text), tags: selected, noteType: selected[0] || '' };
  });
}
