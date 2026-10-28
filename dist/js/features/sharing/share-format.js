import { segments, HIGHLIGHTS } from '../notes/formatting/format.js?v=a49de864b933';
import { detectedLinks, safeLink } from '../notes/formatting/links.js?v=a49de864b933';
import { noteTasks } from '../notes/formatting/tasks.js?v=a49de864b933';
import { indentLevel } from '../notes/formatting/indents.js?v=a49de864b933';

export function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
export function richBody(entry) {
  const tasks = noteTasks(entry),
    links = detectedLinks(entry.text);
  let start = 0;
  return entry.text
    .split('\n')
    .map((line) => {
      const marks = [...links, ...(entry.format || [])]
        .filter((m) => m.start < start + line.length && m.end > start)
        .map((m) => ({
          ...m,
          start: Math.max(0, m.start - start),
          end: Math.min(line.length, m.end - start),
        }));
      let content = segments(line, marks)
        .map((part) => {
          let value = escapeHtml(line.slice(part.start, part.end));
          if (part.bold) value = `<strong>${value}</strong>`;
          if (part.italic) value = `<em>${value}</em>`;
          if (part.underline) value = `<u>${value}</u>`;
          if (HIGHLIGHTS[part.highlight])
            value = `<span style="background-color:${HIGHLIGHTS[part.highlight]};color:#24302a">${value}</span>`;
          const href = safeLink(part.href);
          if (href) value = `<a href="${escapeHtml(href)}">${value}</a>`;
          return value;
        })
        .join('');
      const task = tasks.find((t) => t.start === start),
        marker = task
          ? task.done
            ? '☑ '
            : '☐ '
          : entry.bullets?.some((b) => b.start === start)
            ? '• '
            : '',
        indent = '  '.repeat(indentLevel(entry.indents, start));
      if (task?.done) content = `<s>${content}</s>`;
      start += line.length + 1;
      return `${indent}${marker}${content}`;
    })
    .join('\n');
}
export async function copyFormatted(
  html,
  text,
  clipboard = navigator.clipboard,
  Item = globalThis.ClipboardItem,
) {
  if (typeof Item === 'function' && typeof clipboard?.write === 'function') {
    try {
      await clipboard.write([
        new Item({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch {
      // A denied or unsupported rich write can still allow a plain-text copy.
    }
  }
  await clipboard.writeText(text);
  return false;
}
