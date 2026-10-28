import { safeLink, detectedLinks } from './links.js?v=29ae997dd2e7';
import { lineRange } from './tasks.js?v=29ae997dd2e7';
// Formatting is stored as plain-text ranges, never as executable HTML.
export const HIGHLIGHTS = { blue: '#cde7ff', yellow: '#fff0a6', green: '#d6edcc', red: '#ffd3d3' };
const FLAGS = ['bold', 'italic', 'underline'];
export function validFormat(value, text) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Invalid note formatting.');
  return value.map((mark) => {
    if (
      !mark ||
      !Number.isInteger(mark.start) ||
      !Number.isInteger(mark.end) ||
      mark.start < 0 ||
      mark.end <= mark.start ||
      mark.end > text.length
    )
      throw new Error('Invalid note formatting range.');
    const result = { start: mark.start, end: mark.end };
    for (const flag of FLAGS) {
      if (mark[flag] !== undefined && typeof mark[flag] !== 'boolean')
        throw new Error('Invalid note formatting.');
      if (mark[flag]) result[flag] = true;
    }
    if (mark.highlight !== undefined) {
      if (!Object.hasOwn(HIGHLIGHTS, mark.highlight)) throw new Error('Invalid highlight color.');
      result.highlight = mark.highlight;
    }
    if (mark.href !== undefined) {
      const href = safeLink(mark.href);
      if (!href) throw new Error('Invalid hyperlink.');
      result.href = href;
    }
    return result;
  });
}
export function segments(text, format = []) {
  const cuts = [...new Set([0, text.length, ...format.flatMap((m) => [m.start, m.end])])].sort(
    (a, b) => a - b,
  );
  return cuts.slice(0, -1).map((start, i) => {
    const end = cuts[i + 1],
      style = {};
    for (const mark of format)
      if (mark.start <= start && mark.end >= end) {
        for (const flag of FLAGS) if (mark[flag]) style[flag] = true;
        if (mark.highlight) style.highlight = mark.highlight;
        if (mark.href) style.href = mark.href;
      }
    return { start, end, ...style };
  });
}
function compact(marks) {
  return marks
    .filter((m) => m.end > m.start && (m.bold || m.italic || m.underline || m.highlight || m.href))
    .reduce((result, mark) => {
      const previous = result.at(-1);
      if (
        previous &&
        previous.end === mark.start &&
        [...FLAGS, 'highlight', 'href'].every((k) => previous[k] === mark[k])
      )
        previous.end = mark.end;
      else result.push({ ...mark });
      return result;
    }, []);
}
export function toggleFormat(text, format, start, end, key, value = true) {
  if (start === end) {
    ({ start, end } = lineRange(text, start));
  }
  if (start === end) return format;
  const split = segments(text, [...format, { start, end }]);
  const remove = split
    .filter((m) => m.start >= start && m.end <= end)
    .every((m) => m[key] === value);
  return compact(
    split.map((m) => {
      if (m.start >= start && m.end <= end) {
        m = { ...m };
        if (remove) delete m[key];
        else m[key] = value;
      }
      return m;
    }),
  );
}
export function editFormat(before, after, format, change) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let oldEnd = before.length,
    newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  if (change) {
    start = change.start;
    oldEnd = change.end;
    newEnd = oldEnd + after.length - before.length;
  }
  const delta = newEnd - oldEnd,
    marks = [];
  for (const m of segments(before, format)) {
    if (m.start < start) marks.push({ ...m, end: Math.min(start, m.end) });
    if (m.end > oldEnd)
      marks.push({ ...m, start: Math.max(oldEnd, m.start) + delta, end: m.end + delta });
  }
  // New text inherits the style at the caret (the preceding character at an edge).
  const source =
    before[start - 1] === '\n'
      ? undefined
      : segments(before, format).find(
          (m) => m.start <= Math.max(0, start - 1) && m.end > Math.max(0, start - 1),
        );
  if (source && newEnd > start) marks.push({ ...source, start, end: newEnd });
  return compact(marks.sort((a, b) => a.start - b.start));
}
export function renderFormatted(element, text, format = [], { editable = false } = {}) {
  element.replaceChildren();
  const links = detectedLinks(text);
  for (const part of segments(text, [...links, ...format])) {
    const href = safeLink(part.href);
    const span = document.createElement(href ? 'a' : 'span');
    if (href) {
      span.href = href;
      span.target = '_blank';
      span.rel = 'noopener noreferrer';
      span.addEventListener('click', (event) => {
        if (editable && !event.ctrlKey && !event.metaKey) event.preventDefault();
        event.stopPropagation();
      });
    }
    span.textContent = text.slice(part.start, part.end);
    if (part.bold) span.style.fontWeight = '700';
    if (part.italic) span.style.fontStyle = 'italic';
    if (part.underline) span.style.textDecoration = 'underline';
    if (part.highlight) {
      span.style.backgroundColor = HIGHLIGHTS[part.highlight];
      span.style.color = '#24302a';
      span.style.borderRadius = '2px';
    }
    element.append(span);
  }
}

export function setLink(text, format, start, end, href) {
  if (start === end) return format;
  const value = href === null ? null : safeLink(href);
  if (href !== null && !value) throw new Error('Enter a valid http or https web address.');
  return compact(
    segments(text, [...format, { start, end }]).map((mark) => {
      if (mark.start >= start && mark.end <= end) {
        mark = { ...mark };
        if (value) mark.href = value;
        else delete mark.href;
      }
      return mark;
    }),
  );
}
