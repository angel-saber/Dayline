import { renderFocusReports } from '../focus/reports.js?v=683d01a271f7';
import { renderGuidedReports } from '../activities/view.js?v=683d01a271f7';
import { node } from '../../shared/dom.js?v=683d01a271f7';
import { timeLabel, parseDay } from '../../shared/dates.js?v=683d01a271f7';
import { tagBadges } from '../notes/note-types.js?v=683d01a271f7';
import { commitmentColors } from '../commitments/colors.js?v=683d01a271f7';
import { renderNoteLines } from '../notes/render.js?v=683d01a271f7';
import { noteTasks } from '../notes/formatting/tasks.js?v=683d01a271f7';
import { attachmentList } from '../attachments/attachments.js?v=683d01a271f7';
import { orderedItems, itemKey } from './model.js?v=683d01a271f7';
import { bindListGestures } from './gestures.js?v=683d01a271f7';
const statusFilters = new Map();
const button = (text, action, cls = '') => {
  const b = node('button', cls, text);
  b.type = 'button';
  b.onclick = action;
  return b;
};
export function cardList({ items, view, clock, actions, onEdit, onReschedule, onAdd, onPlan }) {
  const section = node('section', 'planner-list-view'),
    tools = node('div', 'planner-list-tools'),
    list = node('div', 'planner-card-list');
  section.setAttribute('aria-label', `${view} note list`);
  const all = orderedItems(items, view),
    byKey = new Map(all.map((item) => [itemKey(item), item]));
  const filter = node('select');
  filter.setAttribute('aria-label', 'Show notes by completion');
  for (const [value, label] of [
    ['all', 'All'],
    ['open', 'Open'],
    ['done', 'Completed'],
  ]) {
    const option = node('option', '', label);
    option.value = value;
    option.selected = (statusFilters.get(view) || 'all') === value;
    filter.append(option);
  }
  function renderRows() {
    list.replaceChildren();
    const filtered = all.filter(
      (item) => filter.value === 'all' || (filter.value === 'done') === !!item.entry.done,
    );
    if (!filtered.length) list.append(node('p', 'field-hint', 'No notes to show here.'));
    for (const item of filtered) {
      const { entry, date } = item,
        key = itemKey(item),
        card = node('article', 'planner-note-card');
      card.dataset.cardKey = key;
      card.classList.toggle('done', entry.done);
      const colors = commitmentColors(all.indexOf(item));
      card.style.setProperty('--list-card', colors.background);
      card.style.setProperty('--list-ink', colors.ink);
      const handle = button('⠿', () => {}, 'list-reorder');
      handle.setAttribute(
        'aria-label',
        `Reorder ${entry.title || 'note'}. Drag or use arrow keys.`,
      );
      const title = button(
        entry.title?.trim() || entry.text.split('\n')[0]?.slice(0, 100) || 'Untitled note',
        () => onEdit(item),
        'list-note-title',
      );
      const check = button(entry.done ? '✓' : '○', () => actions.complete(item), 'list-complete');
      check.setAttribute('aria-label', entry.done ? 'Reopen note' : 'Complete note');
      check.setAttribute('aria-pressed', String(!!entry.done));
      const head = node('div', 'list-card-header');
      head.append(handle);
      const selection = actions.selection?.(item);
      if (selection) {
        head.classList.add('has-selection');
        head.append(selection);
      }
      head.append(title, check);
      card.append(head);
      const stamp = entry.yearly
        ? `Q${entry.yearly.quarter} · Intention${entry.yearly.status === 'released' ? ' · Set aside' : ''}`
        : `${entry.weekly ? 'Week of ' : ''}${parseDay(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${entry.weekly ? '' : entry.allDay ? ' · All day' : ' · ' + timeLabel(entry.minute, clock)}`;
      const meta = node('div', 'list-card-meta');
      meta.append(node('span', '', stamp));
      const tags = tagBadges(entry);
      if (tags) meta.append(tags);
      card.append(meta);
      const details = node('details', 'list-card-details');
      details.append(node('summary', '', 'Details & actions'));
      const body = node('div', 'list-card-body');
      renderNoteLines(
        body,
        entry.text,
        entry.format,
        noteTasks(entry),
        (start) => actions.checkTask(item, start),
        () => onEdit(item),
        entry.bullets,
        entry.indents,
      );
      details.append(body);
      if (entry.yearly?.nextStep)
        details.append(node('p', '', `Next step: ${entry.yearly.nextStep}`));
      details.append(attachmentList(entry.attachments));
      renderFocusReports(details, entry.focusReports);
      renderGuidedReports(details, entry.guidedActivities);
      const controls = node('div', 'list-card-actions');
      controls.append(
        button('Edit', () => onEdit(item)),
        button(entry.yearly ? 'Move' : 'Reschedule', () => onReschedule(item)),
        button('Delete', () => actions.remove(item)),
      );
      if (entry.yearly && onPlan) controls.prepend(button('Plan a next step', () => onPlan(item)));
      details.append(controls);
      card.append(details);
      list.append(card);
    }
  }
  filter.onchange = () => {
    statusFilters.set(view, filter.value);
    renderRows();
  };
  tools.append(
    node('span', '', `${items.length} ${view === 'yearly' ? 'items' : 'notes'}`),
    filter,
    button('Date order', () => actions.resetOrder(view, all)),
  );
  if (onAdd) tools.append(button('+ Add', onAdd));
  section.append(
    tools,
    node(
      'p',
      'field-hint',
      'Swipe right to complete, left to delete. Drag the handle to change list priority; dates and times stay the same.',
    ),
    list,
  );
  bindListGestures(list, {
    complete: (key) => actions.complete(byKey.get(key)),
    remove: (key) => actions.remove(byKey.get(key)),
    reorder: (source, target, after) => actions.reorder(view, all, source, target, after),
  });
  renderRows();
  return section;
}
