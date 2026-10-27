import { editIndents, indentLevel } from './formatting/indents.js?v=59dbd0e22808';
import { editBullets, selectedLines } from './formatting/bullets.js?v=59dbd0e22808';
import { segments, toggleFormat, editFormat } from './formatting/format.js?v=59dbd0e22808';
import { lineRange, editTasks } from './formatting/tasks.js?v=59dbd0e22808';

export function replaceText(state, start, end, text, typingStyle) {
  const next = state.text.slice(0, start) + text + state.text.slice(end);
  // Retain the exact selection: repeated words must not move formatting to another line.
  let format = editFormat(state.text, next, state.format, { start, end });
  if (typingStyle && text.length) {
    format = format.flatMap((mark) => [
      ...(mark.start < start ? [{ ...mark, end: Math.min(mark.end, start) }] : []),
      ...(mark.end > start + text.length
        ? [{ ...mark, start: Math.max(mark.start, start + text.length) }]
        : []),
    ]);
    if (Object.keys(typingStyle).length)
      format.push({ start, end: start + text.length, ...typingStyle });
    format.sort((a, b) => a.start - b.start);
  }
  return {
    ...state,
    text: next,
    format,
    tasks: editTasks(state.text, next, state.tasks, { start, end }),
    ...(state.indents
      ? { indents: editIndents(state.text, next, state.indents, { start, end }) }
      : {}),
    ...(state.bullets
      ? { bullets: editBullets(state.text, next, state.bullets, { start, end }) }
      : {}),
  };
}
export function applyStyle(state, start, end, key, value = true) {
  return { ...state, format: toggleFormat(state.text, state.format, start, end, key, value) };
}
export function applyCheckbox(state, start, end = start) {
  const lines = new Set(selectedLines(state.text, start, end)),
    remove = [...lines].every((at) => state.tasks.some((task) => task.start === at));
  const tasks = remove
    ? state.tasks.filter((task) => !lines.has(task.start))
    : [
        ...state.tasks,
        ...[...lines]
          .filter((at) => !state.tasks.some((task) => task.start === at))
          .map((start) => ({ start, done: false })),
      ].sort((a, b) => a.start - b.start);
  return {
    ...state,
    tasks,
    ...(state.bullets
      ? { bullets: remove ? state.bullets : state.bullets.filter((item) => !lines.has(item.start)) }
      : {}),
  };
}
export function checkTask(state, start) {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.start === start ? { ...t, done: !t.done } : t)),
  };
}
export function selectionStyle(state, start, end) {
  if (start === end) ({ start, end } = lineRange(state.text, start));
  const parts = segments(state.text, state.format).filter((m) => m.start < end && m.end > start);
  const style = {};
  for (const key of ['bold', 'italic', 'underline', 'highlight']) {
    if (parts.length && parts[0][key] && parts.every((m) => m[key] === parts[0][key]))
      style[key] = parts[0][key];
  }
  return style;
}

// Enter continues the active tools. Completion belongs to each task, so a new
// checkbox always starts unchecked even when the preceding task is complete.
export function insertLineBreak(state, start, end, typingStyle) {
  const style = { ...(typingStyle ?? selectionStyle(state, start, end)) };
  const task = state.tasks.some((t) => t.start === lineRange(state.text, start).start),
    level = indentLevel(state.indents, lineRange(state.text, start).start);
  const next = replaceText(state, start, end, '\n', style),
    caret = start + 1;
  if (task) {
    next.tasks = next.tasks.filter((t) => t.start !== caret);
    next.tasks.push({ start: caret, done: false });
    next.tasks.sort((a, b) => a.start - b.start);
  }
  if (state.bullets?.some((item) => item.start === lineRange(state.text, start).start)) {
    next.bullets = next.bullets.filter((item) => item.start !== caret);
    next.bullets.push({ start: caret });
    next.bullets.sort((a, b) => a.start - b.start);
  }
  if (level)
    next.indents = [
      ...(next.indents || []).filter((item) => item.start !== caret),
      { start: caret, level },
    ].sort((a, b) => a.start - b.start);
  return { state: next, caret, typingStyle: style };
}

// Only touched lines are recognized; existing notes are never rewritten on open.
export function recognizeBullets(state, start, end, selection = { start: end, end }) {
  const lines = [];
  let at = lineRange(state.text, start).start;
  while (at <= end) {
    lines.push(at);
    const next = state.text.indexOf('\n', at);
    if (next < 0 || next >= end) break;
    at = next + 1;
  }
  let next = state,
    caret = { ...selection };
  for (const lineStart of lines.reverse()) {
    if (next.tasks.some((task) => task.start === lineStart)) continue;
    const prefix = next.text.slice(lineStart).match(/^(?:[-*+•][ \t]+)/)?.[0];
    if (!prefix) continue;
    next = replaceText(next, lineStart, lineStart + prefix.length, '');
    next.bullets = [
      ...(next.bullets || []).filter((item) => item.start !== lineStart),
      { start: lineStart },
    ].sort((a, b) => a.start - b.start);
    const shift = (position) =>
      position <= lineStart ? position : Math.max(lineStart, position - prefix.length);
    caret = { start: shift(caret.start), end: shift(caret.end) };
  }
  return { state: next, selection: caret };
}
