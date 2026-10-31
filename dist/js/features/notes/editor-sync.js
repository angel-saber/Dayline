import { validState } from '../../shared/storage.js?v=ebeed1edf97a';

// An untouched note can keep its editor when other notes or settings sync.
// Never keep a stale editor when its own note was changed or deleted remotely.
export function canKeepEditor(previous, next, date, id) {
  if (!id) return true; // A new empty editor has not created a note yet.
  const before = (previous[date] || []).find((note) => note.id === id);
  const after = (next[date] || []).find((note) => note.id === id);
  // Clearing the note removes its saved record while the editor stays open.
  // Only preserve that empty draft when both snapshots agree it is absent.
  if (!before || !after) return !before && !after;
  try {
    // Sync validates notes into a canonical representation, including field order.
    // Compare both versions through that same validation before treating the
    // active note as remotely edited. Invalid data must never keep a stale editor.
    const canonical = (note) => validState({ version: 1, days: { [date]: [note] } }).days[date][0];
    return JSON.stringify(canonical(before)) === JSON.stringify(canonical(after));
  } catch {
    return false;
  }
}
