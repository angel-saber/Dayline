// A new plan shares linked/local file references, but not completion or history.
export function duplicateNote(notes, id, newId = () => crypto.randomUUID()) {
  const index = notes.findIndex((note) => note.id === id);
  if (index < 0) throw new Error('This note is no longer available.');
  const copy = structuredClone(notes[index]);
  copy.id = newId();
  if (!copy.id || notes.some((note) => note.id === copy.id))
    throw new Error('Could not create a unique note.');
  delete copy.repeat;
  copy.done = false;
  if (copy.tasks) copy.tasks = copy.tasks.map((task) => ({ ...task, done: false }));
  delete copy.focusReports;
  delete copy.guidedActivities;
  return { notes: [...notes.slice(0, index + 1), copy, ...notes.slice(index + 1)], id: copy.id };
}
