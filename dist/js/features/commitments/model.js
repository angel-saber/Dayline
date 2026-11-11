import { validTags } from '../notes/note-types.js?v=a482c04a82dd';
export const COMMITMENTS_KEY = 'dayline.daily-commitments.v1';
export const SUGGESTIONS = [
  'Exercise',
  'Work on a Passion Project',
  'Practice a Hobby',
  'Learn a Lesson',
  'Read',
  'Write',
  'Meditate',
  'Practice a Skill',
  'Make Art',
  'Spend Time Outdoors',
];
export function validCommitment(value) {
  if (
    !value ||
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > 100 ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.trim().length > 100 ||
    !Number.isInteger(value.minutes) ||
    value.minutes < 1 ||
    value.minutes > 1440
  )
    throw Error('Choose a habit name and a whole number of minutes from 1 to 1440.');
  if (
    value.breakMinutes !== undefined &&
    (!Number.isInteger(value.breakMinutes) || value.breakMinutes < 0 || value.breakMinutes > 120)
  )
    throw Error('Choose 0–120 break minutes.');
  if (value.body !== undefined && (typeof value.body !== 'string' || value.body.length > 10000))
    throw Error('Keep commitment details to 10,000 characters.');
  return {
    ...(value.body !== undefined ? { body: value.body } : {}),
    id: value.id,
    title: value.title.trim(),
    minutes: value.minutes,
    ...(value.tags !== undefined ? { tags: validTags(value.tags) } : {}),
    ...(value.breakMinutes !== undefined ? { breakMinutes: value.breakMinutes } : {}),
  };
}
export function validCommitments(value) {
  if (!Array.isArray(value) || value.length > 100) throw Error('Save up to 100 daily commitments.');
  const items = value.map(validCommitment);
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw Error('Duplicate habit IDs.');
  return items;
}
export function practiceProgress(days, id, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  let ms = 0;
  const seen = new Set();
  for (const notes of Object.values(days))
    for (const note of notes)
      for (const report of note.focusReports || []) {
        if (
          report.practice?.id !== id ||
          seen.has(report.id) ||
          !Number.isFinite(report.startedAt) ||
          !Number.isFinite(report.endedAt)
        )
          continue;
        seen.add(report.id);
        ms += Math.max(0, Math.min(+end, report.endedAt) - Math.max(+start, report.startedAt));
      }
  return ms;
}
