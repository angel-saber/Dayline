import { dayKey, offsetDay } from '../../shared/dates.js?v=00369c7627f6';
import { rescheduleNote } from '../daily/reschedule.js?v=00369c7627f6';
export const EXPERIMENT_KEY = 'dayline.adjust-my-day.enabled.v1';
export function enabled(storage = globalThis.localStorage) {
  try {
    return storage.getItem(EXPERIMENT_KEY) !== 'false';
  } catch {
    return true;
  }
}
export function candidates(days, date) {
  return (days[date] || [])
    .filter((n) => !n.weekly && !n.yearly && !n.done && !n.repeat)
    .sort((a, b) => a.minute - b.minute);
}
function validDate(date) {
  const value = new Date(date + 'T12:00:00Z');
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(value.getTime()) &&
    value.toISOString().slice(0, 10) === date
  );
}
const time = (minute) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export function previewSchedule(days, source, ids, target, start, spacing, now = new Date()) {
  if (!validDate(source) || !validDate(target)) throw Error('Choose a valid date.');
  if (
    !Number.isInteger(start) ||
    start < 0 ||
    start >= 1440 ||
    !Number.isInteger(spacing) ||
    spacing < 1 ||
    spacing > 1440
  )
    throw Error('Choose a valid start time and spacing of 1–1440 minutes.');
  if (!ids.length || new Set(ids).size !== ids.length) throw Error('Select at least one note.');
  const today = dayKey(now),
    minuteNow = now.getHours() * 60 + now.getMinutes();
  if (target < today || (target === today && start < minuteNow))
    throw Error('Choose a start time that has not passed.');
  const notes = ids.map((id) => candidates(days, source).find((n) => n.id === id));
  if (notes.some((n) => !n))
    throw Error(
      'A selected note changed. Refresh your choices. Repeating notes use their existing Reschedule controls.',
    );
  notes.sort((a, b) => a.minute - b.minute);
  const moves = notes.map((note, i) => {
    const total = start + i * spacing;
    return {
      id: note.id,
      date: offsetDay(target, Math.floor(total / 1440)),
      minute: total % 1440,
      title: note.title?.trim() || note.text?.split('\n')[0] || 'Untitled note',
    };
  });
  const dates = [...new Set([source, ...moves.map((m) => m.date)])];
  const before = Object.fromEntries(dates.map((d) => [d, structuredClone(days[d] || [])]));
  const warnings = [];
  for (const move of moves) {
    if (
      (days[move.date] || []).some(
        (n) =>
          !n.weekly &&
          !n.yearly &&
          !n.allDay &&
          n.minute === move.minute &&
          !(move.date === source && ids.includes(n.id)),
      )
    )
      warnings.push(
        `${move.title}: another note is already scheduled at this time. Both will be kept.`,
      );
  }
  return { source, moves, before, warnings };
}
export function applySchedule(days, draft, now = new Date()) {
  for (const [date, notes] of Object.entries(draft.before))
    if (JSON.stringify(days[date] || []) !== JSON.stringify(notes))
      throw Error('Notes changed since this preview. Preview again before applying.');
  const today = dayKey(now),
    minuteNow = now.getHours() * 60 + now.getMinutes();
  if (draft.moves.some((m) => m.date < today || (m.date === today && m.minute < minuteNow)))
    throw Error('The preview start time has passed. Preview a new time.');
  let next = days;
  for (const move of draft.moves)
    next = rescheduleNote(next, draft.source, move.id, move.date, time(move.minute));
  return next;
}
