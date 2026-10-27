import { selectedLines } from './bullets.js?v=5841dd2bd659';
import { editTasks, validTasks } from './tasks.js?v=5841dd2bd659';
export const MAX_INDENT = 8;
export const indentLevel = (indents = [], start) =>
  indents.find((item) => item.start === start)?.level || 0;
export function validIndents(value, text) {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        Object.keys(item).some((key) => !['start', 'level'].includes(key)) ||
        !Number.isInteger(item.level) ||
        item.level < 1 ||
        item.level > MAX_INDENT,
    )
  )
    throw new Error('Invalid line indentation.');
  validTasks(
    value.map((item) => ({ start: item.start, done: false })),
    text,
  );
  return value.map(({ start, level }) => ({ start, level })).sort((a, b) => a.start - b.start);
}
export function editIndents(before, after, indents = [], change) {
  return editTasks(
    before,
    after,
    indents.map((item) => ({ ...item, done: false })),
    change,
  ).map(({ start, level }) => ({ start, level }));
}
export function applyIndent(state, start, end = start, delta = 1) {
  const lines = new Set(selectedLines(state.text, start, end)),
    current = state.indents || [],
    next = current.filter((item) => !lines.has(item.start));
  let changed = false;
  for (const at of lines) {
    const old = indentLevel(current, at),
      level = Math.max(0, Math.min(MAX_INDENT, old + delta));
    if (level !== old) changed = true;
    if (level) next.push({ start: at, level });
  }
  return changed ? { ...state, indents: next.sort((a, b) => a.start - b.start) } : state;
}
