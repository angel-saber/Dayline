import { duplicateNote } from '../notes/duplicate.js?v=b8179ad8cdac';
import { dayKey, parseDay, offsetDay } from '../../shared/schedule.js?v=b8179ad8cdac';
import { validDate } from '../bulk/model.js?v=b8179ad8cdac';
export function weekStart(date) {
  if (!validDate(date)) throw new Error('Choose a valid date.');
  return offsetDay(date, -parseDay(date).getDay());
}
export function weeklyNotes(days, week) {
  return (days[weekStart(week)] || []).filter((note) => note.weekly === true);
}
export function changeWeekly(days, week, id, action, newId = () => crypto.randomUUID()) {
  week = weekStart(week);
  if (action.kind === 'unschedule') {
    if (!validDate(action.date)) throw new Error('Choose a valid source date.');
    const source = days[action.date] || [],
      entry = source.find((note) => note.id === id && !note.weekly && !note.yearly);
    if (!entry) throw new Error('This Daily note is no longer available.');
    const destination = (days[week] || []).filter((note) => action.date !== week || note !== entry),
      copy = { ...entry, weekly: true, minute: 0 };
    // Only this occurrence becomes undated; its repeat cycle continues unchanged.
    delete copy.repeat;
    delete copy.allDay;
    delete copy.remind;
    if (destination.some((note) => note.id === copy.id)) copy.id = newId();
    if (!copy.id || destination.some((note) => note.id === copy.id))
      throw new Error('Could not create a unique note.');
    return {
      days: {
        ...days,
        [action.date]: source.filter((note) => note !== entry),
        [week]: [...destination, copy],
      },
      previous: Object.fromEntries(
        [...new Set([action.date, week])].map((date) => [date, structuredClone(days[date] || [])]),
      ),
      id: copy.id,
      date: week,
    };
  }
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
