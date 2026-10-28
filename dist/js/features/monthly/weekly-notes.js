import { node } from '../../shared/dom.js?v=11da2bfc29ac';
import { bindFileDrop } from '../attachments/attachments.js?v=11da2bfc29ac';
import { weeklyNotes, weekStart } from './weekly-model.js?v=11da2bfc29ac';
import { dayKey, parseDay, timeLabel } from '../../shared/schedule.js?v=11da2bfc29ac';
import {
  availableHours,
  hourInput,
  inputMinute,
} from '../settings/available-hours.js?v=11da2bfc29ac';
import { createNoteEditor } from '../notes/note-editor.js?v=11da2bfc29ac';
import { categoryOptions, tagBadges } from '../notes/note-types.js?v=11da2bfc29ac';
import { openShareNote } from '../sharing/share-note.js?v=11da2bfc29ac';
import { noteTitle } from './model.js?v=11da2bfc29ac';

const button = (text, fn, cls = 'secondary') => {
  const el = node('button', cls, text);
  el.type = 'button';
  el.onclick = fn;
  return el;
};
export function createWeeklySection({ week, getState, apply, onChanged }) {
  const section = node('section', 'weekly-notes'),
    header = node('div', 'weekly-notes-header'),
    list = node('div', 'weekly-notes-list');
  let editors = [];
  header.append(
    node('h3', '', 'Weekly Notes'),
    button('＋ Add a weekly note', () => {
      flush();
      const result = apply(week, null, { kind: 'create' });
      if (result) render(result.id);
    }),
  );
  section.append(
    header,
    node(
      'p',
      'field-hint',
      'Ideas, tasks, and reminders for this week, without a date or time. Schedule when you’re ready.',
    ),
    list,
  );
  function flush() {
    for (const editor of editors) editor.flush();
  }
  function destroy() {
    for (const editor of editors) {
      editor.flush();
      editor.destroy();
    }
    editors = [];
  }
  function schedule(id, date) {
    flush();
    const entry = weeklyNotes(getState().days, week).find((note) => note.id === id);
    if (!entry) return;
    const dialog = node('dialog', 'weekly-schedule-dialog'),
      form = node('form'),
      label = node('label', '', 'Date'),
      dateInput = node('input'),
      timeLabel = node('label', '', 'Time'),
      time = node('input');
    dateInput.type = 'date';
    dateInput.required = true;
    dateInput.value = date || (weekStart(dayKey()) === week ? dayKey() : week);
    label.append(dateInput);
    time.type = 'time';
    time.required = true;
    time.step = '60';
    time.value = hourInput(availableHours(getState().settings).from);
    timeLabel.append(time);
    const status = node('p', 'field-hint');
    status.setAttribute('role', 'status');
    const actions = node('div', 'inline'),
      submit = node('button', 'primary', 'Schedule note');
    submit.type = 'submit';
    actions.append(
      submit,
      button('Cancel', () => dialog.close()),
    );
    form.append(
      node('h2', '', 'Schedule weekly note'),
      node('p', '', noteTitle(entry)),
      label,
      timeLabel,
      node(
        'p',
        'field-hint',
        'Moves this note into Daily at the chosen time, keeping its contents, tags, and attachments.',
      ),
      status,
      actions,
    );
    dialog.append(form);
    document.body.append(dialog);
    form.onsubmit = (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const result = apply(week, id, {
        kind: 'schedule',
        date: dateInput.value,
        minute: inputMinute(time.value),
      });
      if (result) {
        dialog.close();
        onChanged();
      } else status.textContent = 'Could not schedule this note. It remains in Weekly Notes.';
    };
    const onAccount = () => dialog.close();
    window.addEventListener('dayline:account', onAccount);
    dialog.addEventListener(
      'close',
      () => {
        window.removeEventListener('dayline:account', onAccount);
        dialog.remove();
      },
      { once: true },
    );
    dialog.showModal();
  }
  function moveWeek(id) {
    flush();
    const dialog = node('dialog', 'weekly-schedule-dialog'),
      form = node('form'),
      label = node('label', '', 'Date in the destination week'),
      date = node('input');
    date.type = 'date';
    date.required = true;
    date.value = week;
    label.append(date);
    const actions = node('div', 'inline'),
      submit = node('button', 'primary', 'Move to week');
    submit.type = 'submit';
    actions.append(
      submit,
      button('Cancel', () => dialog.close()),
    );
    form.append(
      node('h2', '', 'Move weekly note'),
      label,
      node('p', 'field-hint', 'Weeks run Sunday through Saturday. This note stays undated.'),
      actions,
    );
    dialog.append(form);
    document.body.append(dialog);
    form.onsubmit = (event) => {
      event.preventDefault();
      if (form.reportValidity() && apply(week, id, { kind: 'move', date: date.value })) {
        dialog.close();
        onChanged();
      }
    };
    const onAccount = () => dialog.close();
    window.addEventListener('dayline:account', onAccount);
    dialog.addEventListener(
      'close',
      () => {
        window.removeEventListener('dayline:account', onAccount);
        dialog.remove();
      },
      { once: true },
    );
    dialog.showModal();
  }
  function render(openId) {
    destroy();
    list.replaceChildren();
    const entries = weeklyNotes(getState().days, week);
    if (!entries.length)
      list.append(
        node(
          'p',
          'field-hint weekly-empty',
          'Nothing to hold here yet. Add a thought without choosing a time.',
        ),
      );
    for (const entry of entries) {
      const card = node('details', 'weekly-note' + (entry.done ? ' completed' : '')),
        summary = node('summary'),
        title = node('span', 'weekly-note-title', noteTitle(entry)),
        body = node('div', 'weekly-note-body'),
        tools = node('div', 'inline weekly-note-tools');
      card.dataset.id = entry.id;
      card.dataset.source = week;
      card.dataset.weekly = 'true';
      card.draggable = true;
      const drag = button('⠿', () => schedule(entry.id), 'month-drag');
      drag.draggable = true;
      drag.title = 'Hold and drag onto a day, or click to schedule';
      drag.setAttribute('aria-label', 'Drag or schedule weekly note: ' + noteTitle(entry));
      drag.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        schedule(entry.id);
      };
      summary.append(drag, title);
      const tags = tagBadges(entry);
      if (tags) summary.append(tags);
      card.append(summary, body);
      list.append(card);
      tools.append(
        button(entry.done ? 'Mark incomplete' : 'Mark complete', () => {
          flush();
          if (apply(week, entry.id, { kind: 'complete' })) render(entry.id);
        }),
        button('Duplicate', () => {
          flush();
          const result = apply(week, entry.id, { kind: 'duplicate' });
          if (result) render(result.id);
        }),
        button('Schedule', () => schedule(entry.id)),
        button('Move to week', () => moveWeek(entry.id)),
        button('Share', () => {
          flush();
          const fresh = weeklyNotes(getState().days, week).find((note) => note.id === entry.id);
          if (fresh) openShareNote(fresh, week, getState().settings.clock);
        }),
        button('Delete', () => {
          flush();
          if (apply(week, entry.id, { kind: 'delete' })) render();
        }),
      );
      let editor = null;
      function edit() {
        if (editor) return;
        const fresh = weeklyNotes(getState().days, week).find((note) => note.id === entry.id);
        if (!fresh) return;
        editor = createNoteEditor({
          entry: fresh,
          undated: true,
          categories: categoryOptions(getState().days, getState().settings.tags),
          label: 'Weekly note',
          onChange(values) {
            const result = apply(week, entry.id, { kind: 'update', values });
            if (result) {
              title.textContent =
                values.title.trim() ||
                values.text.split('\n').find((line) => line.trim()) ||
                'Untitled note';
              summary.querySelector('.note-tag-badges')?.remove();
              const tags = tagBadges(values);
              if (tags) summary.append(tags);
            }
            return !!result;
          },
          onDone() {
            card.open = false;
          },
        });
        editors.push(editor);
        body.replaceChildren(tools, editor.element);
      }
      bindFileDrop(card, (files) => {
        card.open = true;
        edit();
        editor?.attachFiles(files);
      });
      card.addEventListener('toggle', () => {
        if (card.open) edit();
        else if (editor) {
          editor.flush();
          editor.destroy();
          editors = editors.filter((item) => item !== editor);
          editor = null;
          body.replaceChildren();
          card.draggable = true;
        }
      });
      if (entry.id === openId) {
        card.open = true;
        edit();
        editor?.focus();
      }
    }
  }
  render();
  return { element: section, week, flush, destroy, schedule };
}
