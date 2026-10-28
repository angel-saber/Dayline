import { duplicateNote } from '../notes/duplicate.js?v=ac12573d358a';
import { dayKey, parseDay, offsetDay } from '../../shared/schedule.js?v=ac12573d358a';
import { validDate } from '../bulk/model.js?v=ac12573d358a';
export function weekStart(date) {
  if (!validDate(date)) throw new Error('Choose a valid date.');
  return offsetDay(date, -parseDay(date).getDay());
}
export function weeklyNotes(days, week) {
  return (days[weekStart(week)] || []).filter((note) => note.weekly === true);
}
export function changeWeekly(days, week, id, action, newId = () => crypto.randomUUID()) {
  week = weekStart(week);
  const list = days[week] || [],
    entry = list.find((note) => note.id === id && note.weekly === true),
    previous = { [week]: structuredClone(list) };
  if (action.kind === 'create') {
    const note = {
      id: newId(),
      weekly: true,
      minute: 0,
      title: '',
      text: '',
      done: false,
      task: false,
      tasks: [],
      format: [],
      bullets: [],
      indents: [],
      tags: [],
      attachments: [],
    };
    return { days: { ...days, [week]: [...list, note] }, previous, id: note.id };
  }
  if (!entry) throw new Error('This weekly note is no longer available.');
  let next = list;
  if (action.kind === 'duplicate') {
    const result = duplicateNote(list, id, newId);
    return { days: { ...days, [week]: result.notes }, previous, id: result.id };
  }
  if (action.kind === 'update') {
    const { minute, weekly, ...values } = action.values;
    next = list.map((note) =>
      note === entry ? { ...note, ...values, weekly: true, minute: 0 } : note,
    );
  } else if (action.kind === 'complete')
    next = list.map((note) => (note === entry ? { ...note, done: !note.done } : note));
  else if (action.kind === 'delete') next = list.filter((note) => note !== entry);
  else if (action.kind === 'move' || action.kind === 'schedule') {
    const target = action.kind === 'move' ? weekStart(action.date) : action.date;
    if (!validDate(target)) throw new Error('Choose a valid date.');
    if (action.kind === 'move' && target === week) return { days, previous, id };
    if (
      action.kind === 'schedule' &&
      (!Number.isInteger(action.minute) || action.minute < 0 || action.minute >= 1440)
    )
      throw new Error('Choose a valid note time.');
    previous[target] ??= structuredClone(days[target] || []);
    const destination =
        target === week ? list.filter((note) => note !== entry) : days[target] || [],
      copy = { ...entry, id: destination.some((note) => note.id === id) ? newId() : id };
    if (action.kind === 'schedule') {
      delete copy.weekly;
      copy.minute = action.minute;
    }
    return {
      days: {
        ...days,
        [week]: list.filter((note) => note !== entry),
        [target]: [...destination, copy].sort((a, b) => a.minute - b.minute),
      },
      previous,
      id: copy.id,
      date: target,
    };
  } else throw new Error('Unknown weekly note action.');
  return { days: { ...days, [week]: next }, previous, id };
}
