import { bucket } from '../../shared/schedule.js?v=6d1be00d390d';
// Older dragged plans had no ID link. Only recognize an unchanged title/body pair.
export function plannedCommitmentNote(notes, practice, minute, interval) {
  return (
    notes
      .filter(
        (note) =>
          !note.weekly &&
          !note.yearly &&
          !note.allDay &&
          !note.done &&
          !note.focusReports?.length &&
          (note.commitmentId === practice.id ||
            (note.commitmentId === undefined &&
              note.title === practice.title &&
              note.text === (practice.body || ''))),
      )
      .sort(
        (a, b) =>
          Number(bucket(b.minute, interval) === bucket(minute, interval)) -
            Number(bucket(a.minute, interval) === bucket(minute, interval)) ||
          Math.abs(a.minute - minute) - Math.abs(b.minute - minute) ||
          a.minute - b.minute ||
          a.id.localeCompare(b.id),
      )[0] || null
  );
}

export function activatePracticeNote(days, page, practice) {
  const existing = (days[page.date] || []).find((note) => note.id === page.noteId);
  const note = {
    ...(existing || {}),
    id: page.noteId,
    commitmentId: practice.id,
    minute: page.minute,
    title: page.title,
    text: page.text,
    ...(!existing && practice.tags !== undefined ? { tags: [...practice.tags] } : {}),
    done: false,
    ...(!existing ? { task: false } : {}),
  };
  return {
    ...days,
    [page.date]: [...(days[page.date] || []).filter((entry) => entry.id !== note.id), note].sort(
      (a, b) => a.minute - b.minute,
    ),
  };
}
