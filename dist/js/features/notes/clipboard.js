import { validFormat } from './formatting/format.js?v=e40ab8c1395f';
import { validTasks, lineRange } from './formatting/tasks.js?v=e40ab8c1395f';
import { validBullets } from './formatting/bullets.js?v=e40ab8c1395f';
import { validIndents } from './formatting/indents.js?v=e40ab8c1395f';
import { replaceText } from './editor-state.js?v=e40ab8c1395f';
import { richBody } from '../sharing/share-format.js?v=e40ab8c1395f';

export const NOTE_CLIPBOARD = 'application/x-dayline-note+json';
const LIMIT = 1000000;
export function noteFragment(state, start, end) {
  const text = state.text.slice(start, end),
    lines = (key) =>
      (state[key] || [])
        .filter(
          (m) =>
            m.start >= lineRange(state.text, start).start &&
            (m.start < end || (end === state.text.length && m.start === end)),
        )
        .map((m) => ({ ...m, start: Math.max(0, m.start - start) }));
  return {
    version: 1,
    text,
    format: (state.format || [])
      .filter((m) => m.start < end && m.end > start)
      .map((m) => ({
        ...m,
        start: Math.max(0, m.start - start),
        end: Math.min(end, m.end) - start,
      })),
    tasks: lines('tasks'),
    bullets: lines('bullets'),
    indents: lines('indents'),
  };
}
export function writeNoteClipboard(data, fragment) {
  if (!data) return false;
  try {
    data.setData('text/plain', fragment.text);
    const json = JSON.stringify(fragment);
    data.setData(
      'text/html',
      `<div data-dayline-fragment="${encodeURIComponent(json)}" style="white-space:pre-wrap">${richBody(fragment)}</div>`,
    );
    try {
      data.setData(NOTE_CLIPBOARD, json);
    } catch {
      /* HTML carries the same validated fragment. */
    }
    return true;
  } catch {
    return false;
  }
}
export function readNoteClipboard(data) {
  if (!data) return null;
  try {
    const plain = data.getData('text/plain').replace(/\r\n?/g, '\n');
    const raw =
      data.getData(NOTE_CLIPBOARD) ||
      (() => {
        const html = data.getData('text/html');
        if (html.length > LIMIT * 10) return '';
        const encoded = html.match(/data-dayline-fragment="([^"]*)"/)?.[1];
        return encoded ? decodeURIComponent(encoded) : '';
      })();
    if (!raw || raw.length > LIMIT * 10) return null;
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      typeof value.text !== 'string' ||
      value.text.length > LIMIT ||
      value.text !== plain
    )
      return null;
    return {
      text: value.text,
      format: validFormat(value.format, value.text),
      tasks: validTasks(value.tasks, value.text),
      bullets: validBullets(value.bullets, value.text),
      indents: validIndents(value.indents, value.text),
    };
  } catch {
    return null;
  }
}
export function pasteNoteFragment(state, start, end, fragment) {
  const next = replaceText(state, start, end, fragment.text, {});
  next.format.push(
    ...fragment.format.map((m) => ({ ...m, start: start + m.start, end: start + m.end })),
  );
  next.format.sort((a, b) => a.start - b.start);
  // Line tools can only belong to actual destination line starts. Pasting inline
  // keeps the destination line's tools instead of changing surrounding text.
  const imported = (key) =>
    fragment[key]
      .map((m) => ({ ...m, start: start + m.start }))
      .filter((m) => m.start === 0 || next.text[m.start - 1] === '\n');
  for (const key of ['tasks', 'bullets', 'indents']) {
    const incoming = imported(key),
      anchors = new Set(incoming.map((m) => m.start));
    const replacedLine = start === 0 || state.text[start - 1] === '\n';
    next[key] = [
      ...(next[key] || []).filter(
        (m) =>
          !anchors.has(m.start) && !(replacedLine && m.start === start && fragment.text.length),
      ),
      ...incoming,
    ].sort((a, b) => a.start - b.start);
  }
  const tasks = new Set(next.tasks.map((m) => m.start));
  next.bullets = next.bullets.filter((m) => !tasks.has(m.start));
  return next;
}

// Read-only note bodies share the same range payload as the editor. DOM offsets
// count text spans only, excluding checkbox controls and bullet decorations.
export function copyRenderedNote(event, container, state) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return;
  const position = (node, offset) => {
    if (!node) return null;
    if (node === container)
      return container.children[offset]
        ? Number(container.children[offset].dataset.noteStart)
        : state.text.length;
    const row = (node.nodeType === 1 ? node : node.parentElement)?.closest('[data-note-start]');
    if (!row || !container.contains(row)) return null;
    const text = row.querySelector('.note-text');
    if (!text.contains(node))
      return (
        Number(row.dataset.noteStart) +
        (offset
          ? lineRange(state.text, Number(row.dataset.noteStart)).end - Number(row.dataset.noteStart)
          : 0)
      );
    const range = document.createRange();
    range.selectNodeContents(text);
    range.setEnd(node, offset);
    return (
      Number(row.dataset.noteStart) +
      Math.min(
        range.toString().length,
        lineRange(state.text, Number(row.dataset.noteStart)).end - Number(row.dataset.noteStart),
      )
    );
  };
  const a = position(selection.anchorNode, selection.anchorOffset),
    b = position(selection.focusNode, selection.focusOffset);
  if (a === null || b === null || a === b) return;
  if (writeNoteClipboard(event.clipboardData, noteFragment(state, Math.min(a, b), Math.max(a, b))))
    event.preventDefault();
}
