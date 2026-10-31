import { offsetDay } from '../../shared/dates.js?v=f99b8ac250a9';
import { noteTasks } from '../notes/formatting/tasks.js?v=f99b8ac250a9';
import { noteTags } from '../notes/note-types.js?v=f99b8ac250a9';
import { validDate } from '../bulk/model.js?v=f99b8ac250a9';
export function validRepeat(value) {
  if (
    !value ||
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > 200 ||
    !validDate(value.start) ||
    !validDate(value.end) ||
    !validDate(value.occurrence) ||
    value.start > value.end ||
    value.occurrence < value.start ||
    value.occurrence > value.end
  )
    throw new Error('Invalid repeat-cycle information.');
  return { id: value.id, start: value.start, end: value.end, occurrence: value.occurrence };
}
export function changeRepeatNotes(days, date, id, action, scope = 'one') {
  const source = (days[date] || []).find((note) => note.id === id && !note.weekly && !note.yearly);
  if (!source) throw new Error('This note is no longer available.');
  if (!['one', 'following'].includes(scope)) throw new Error('Choose which notes to change.');
  const current = source.repeat && validRepeat(source.repeat);
  const next = { ...days },
    previous = {};
  const values = action.values || {},
    patch = {};
  const keys = [
    'title',
    'text',
    'minute',
    'allDay',
    'remind',
    'format',
    'tasks',
    'bullets',
    'indents',
    'noteType',
    'tags',
    'attachments',
    'task',
  ];
  if (action.kind === 'edit') {
    const defaults = {
      title: '',
      format: [],
      tasks: noteTasks(source),
      bullets: [],
      indents: [],
      tags: noteTags(source),
      noteType: '',
      attachments: [],
      task: false,
    };
    for (const key of keys)
      if (
        Object.hasOwn(values, key) &&
        JSON.stringify(source[key] ?? defaults[key]) !== JSON.stringify(values[key])
      )
        patch[key] = structuredClone(values[key]);
    if (['text', 'format', 'bullets', 'indents'].some((key) => Object.hasOwn(patch, key))) {
      patch.text = values.text ?? source.text;
      for (const key of ['format', 'tasks', 'bullets', 'indents'])
        patch[key] = structuredClone(values[key] ?? source[key] ?? []);
    }
  } else if (action.kind !== 'delete') throw new Error('Unknown repeat-note action.');
  let count = 0;
  for (const [key, notes] of Object.entries(days)) {
    const matches = (note) =>
      (note.id === id && key === date) ||
      (scope === 'following' &&
        current &&
        note.repeat?.id === current.id &&
        note.repeat.occurrence >= current.occurrence &&
        note.repeat.occurrence <= current.end);
    if (!notes.some(matches)) continue;
    previous[key] = structuredClone(notes);
    next[key] = notes
      .flatMap((note) => {
        if (!matches(note)) return [note];
        count++;
        if (action.kind === 'delete') return [];
        const updated = { ...note, ...structuredClone(patch) };
        // Checkbox completion belongs to each occurrence, even when its content changes.
        if (note.id !== id && patch.tasks)
          updated.tasks = patch.tasks.map((task) => ({
            ...task,
            done: note.tasks?.find((old) => old.start === task.start)?.done || false,
          }));
        return [updated];
      })
      .sort((a, b) => a.minute - b.minute);
  }
  return { days: next, previous, count };
}

// Rescheduling all remaining occurrences shifts their dates together, within the
// original finite bounds. A single occurrence moved outside is detached instead.
export function rescheduleRepeatNotes(days, date, id, target, time, scope = 'one') {
  if (!['one', 'following'].includes(scope)) throw new Error('Choose which notes to change.');
  if (!validDate(target) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error('Choose a valid date and time.');
  const source = (days[date] || []).find((note) => note.id === id);
  if (!source?.repeat) throw new Error('This repeat note is no longer available.');
  const repeat = validRepeat(source.repeat);
  const selected =
    scope === 'following'
      ? Object.entries(days).flatMap(([day, notes]) =>
          notes
            .filter(
              (note) =>
                note.repeat?.id === repeat.id &&
                note.repeat.occurrence >= repeat.occurrence &&
                note.repeat.occurrence <= repeat.end,
            )
            .map((note) => ({ day, note })),
        )
      : [{ day: date, note: source }];
  const delta = Math.round(
    (Date.parse(target + 'T12:00:00Z') - Date.parse(date + 'T12:00:00Z')) / 86400000,
  );
  const [hours, minutes] = time.split(':').map(Number);
  const moves = selected.map(({ day, note }) => {
    const to = offsetDay(day, delta);
    if (scope === 'following' && (to < repeat.start || to > repeat.end))
      throw new Error(
        'That would move repeats outside this cycle. Move only this note or create a new finite cycle.',
      );
    const copy = {
      ...note,
      minute: hours * 60 + minutes,
      ...(note.allDay ? { allDay: false, remind: false } : {}),
    };
    if (to < repeat.start || to > repeat.end) delete copy.repeat;
    return { day, to, note: copy };
  });
  const previous = {},
    next = { ...days };
  for (const key of new Set(moves.flatMap((move) => [move.day, move.to])))
    previous[key] = structuredClone(days[key] || []);
  for (const { day, note } of moves)
    next[day] = (next[day] || []).filter((item) => item.id !== note.id);
  for (const { to, note } of moves) {
    if ((next[to] || []).some((item) => item.id === note.id))
      throw new Error('The destination already contains this note identity.');
    next[to] = [...(next[to] || []), note].sort((a, b) => a.minute - b.minute);
  }
  return { days: next, previous, count: moves.length };
}
