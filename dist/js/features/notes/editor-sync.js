// An untouched note can keep its editor when other notes or settings sync.
// Never keep a stale editor when its own note was changed or deleted remotely.
export function canKeepEditor(previous, next, date, id) {
  if (!id) return true; // A new empty editor has not created a note yet.
  const before = (previous[date] || []).find((note) => note.id === id);
  const after = (next[date] || []).find((note) => note.id === id);
  return !!before && !!after && JSON.stringify(before) === JSON.stringify(after);
}
