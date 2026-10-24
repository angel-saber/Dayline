import { moveToDay } from '../monthly/model.js?v=6880fc00acca';

export function rescheduleNote(days, source, id, target, time) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid time.');
  const entry = days[source]?.find((note) => note.id === id && !note.weekly);
  if (!entry) throw new Error('This note is no longer on its original day. Please reopen it.');
  const moved = moveToDay(days, source, id, target);
  const [hour, minute] = time.split(':').map(Number);
  return {
    ...moved,
    [target]: [
      ...moved[target].filter((note) => note.id !== id),
      { ...entry, minute: hour * 60 + minute },
    ].sort((a, b) => a.minute - b.minute),
  };
}
