import { lineRange, editTasks, validTasks } from './tasks.js?v=line-tasks-1';
export function validBullets(value, text) {
  if (
    !Array.isArray(value) ||
    value.some((item) => !item || Object.keys(item).some((key) => key !== 'start'))
  )
    throw new Error('Invalid bullet list.');
  return validTasks(
    value.map((item) => ({ ...item, done: false })),
    text,
  ).map(({ start }) => ({ start }));
}
export function editBullets(before, after, bullets = [], change) {
  return editTasks(
    before,
    after,
    bullets.map((item) => ({ ...item, done: false })),
    change,
  ).map(({ start }) => ({ start }));
}
export function selectedLines(text, start, end) {
  const first = lineRange(text, start).start,
    last = lineRange(text, end > start ? end - 1 : end).start,
    lines = [];
  for (let at = first; at <= last;) {
    lines.push(at);
    const next = text.indexOf('\n', at);
    if (next < 0) break;
    at = next + 1;
  }
  return lines;
}
export function toggleBullets(state, start, end = start) {
  const lines = selectedLines(state.text, start, end),
    bullets = state.bullets || [],
    remove = lines.every((at) => bullets.some((item) => item.start === at));
  return {
    ...state,
    bullets: [
      ...bullets.filter((item) => !lines.includes(item.start)),
      ...(remove ? [] : lines.map((start) => ({ start }))),
    ].sort((a, b) => a.start - b.start),
    tasks: remove ? state.tasks : state.tasks.filter((item) => !lines.includes(item.start)),
  };
}
