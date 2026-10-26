import { node } from '../../shared/dom.js?v=99c68c40b4e2';
import { indentLevel } from './formatting/indents.js?v=99c68c40b4e2';
import { renderFormatted } from './formatting/format.js?v=99c68c40b4e2';
// Render line controls beside text; never nest a checkbox inside an edit button.
export function renderNoteLines(
  container,
  text,
  format = [],
  tasks = [],
  onCheck,
  onEdit,
  bullets = [],
  indents = [],
) {
  container.replaceChildren();
  let start = 0;
  for (const line of text.split('\n')) {
    const row = node('div', 'note-line');
    row.style.setProperty('--indent-level', indentLevel(indents, start));
    const task = tasks.find((t) => t.start === start),
      anchor = start;
    if (task) {
      const check = node('input', 'line-checkbox');
      check.type = 'checkbox';
      check.checked = task.done;
      check.setAttribute('aria-label', `Complete task: ${line || 'Empty line'}`);
      check.addEventListener('change', () => onCheck(anchor));
      row.append(check);
    }
    if (!task && bullets.some((item) => item.start === start)) {
      const marker = node('span', 'bullet-marker', '•');
      marker.setAttribute('aria-hidden', 'true');
      row.append(marker);
    }
    const textNode = node('span', 'note-text');
    if (onEdit) {
      textNode.tabIndex = 0;
      textNode.setAttribute('role', 'button');
      textNode.setAttribute('aria-label', `Edit note: ${line || 'Empty line'}`);
      textNode.addEventListener('click', onEdit);
      textNode.addEventListener('keydown', (event) => {
        if (event.target === textNode && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onEdit();
        }
      });
    }
    const marks = format
      .filter((m) => m.start < start + line.length && m.end > start)
      .map((m) => ({
        ...m,
        start: Math.max(0, m.start - start),
        end: Math.min(line.length, m.end - start),
      }));
    renderFormatted(textNode, line, marks);
    if (!line) textNode.append(document.createTextNode('\u200b'));
    textNode.classList.toggle('task-completed', !!task?.done);
    row.append(textNode);
    container.append(row);
    start += line.length + 1;
  }
}
