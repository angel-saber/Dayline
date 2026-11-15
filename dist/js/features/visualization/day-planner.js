import { node } from '../../shared/dom.js?v=997915ecfd91';
import { offsetDay, parseDay, timeLabel } from '../../shared/dates.js?v=997915ecfd91';
import { noteTasks } from '../notes/formatting/tasks.js?v=997915ecfd91';
import { isAwake } from '../settings/awake-hours.js?v=997915ecfd91';

const periods = ['Morning', 'Afternoon', 'Evening'];
const starts = [0, 720, 1020, 1440];
const periodOf = (note) =>
  note.allDay ? (note.dayPeriod ?? 0) : note.minute < 720 ? 0 : note.minute < 1020 ? 1 : 2;
const titleOf = (note) => note.title || note.text.split('\n')[0] || 'Untitled note';

export function carryForward(note, id) {
  const tasks = noteTasks(note);
  if (!tasks.some((task) => task.done)) return { ...note, id, tasks, done: false };
  const byStart = new Map(tasks.map((task) => [task.start, task]));
  let start = 0;
  const lines = [];
  const open = [];
  let length = 0;
  for (const line of note.text.split('\n')) {
    const task = byStart.get(start);
    if (!task?.done) {
      if (task) open.push({ start: length, done: false });
      lines.push(line);
      length += line.length + 1;
    }
    start += line.length + 1;
  }
  const { format, bullets, indents, ...rest } = note;
  return { ...rest, id, text: lines.join('\n'), tasks: open, done: false };
}

export function buildDayPlanner({ today, read, write, finish, reflection }) {
  const yesterday = offsetDay(today, -1);
  const frame = node('div', 'meet-day');
  const body = node('div', 'meet-day-body');
  const footer = node('div', 'meet-day-footer');
  const status = node('div', 'field-hint');
  status.setAttribute('role', 'status');
  const date = parseDay(today).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  let current = 0;
  let undo = null;
  const button = (text, action, style = 'secondary') => {
    const element = node('button', style, text);
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
  };
  const undoButton = button('Undo', () => {
    if (undo) undo();
  });
  undoButton.hidden = true;
  footer.append(status, undoButton, button('Done', finish, 'primary'));
  frame.append(node('p', 'field-hint', date), body, footer);

  function apply(date, before, after, message) {
    const changed = (notes, previous, next) => {
      const id = previous?.id ?? next.id;
      const index = notes.findIndex((note) => note.id === id);
      if (previous ? JSON.stringify(notes[index]) !== JSON.stringify(previous) : index !== -1)
        return null;
      if (index === -1) return [...notes, next];
      return next
        ? notes.map((note) => (note.id === id ? next : note))
        : notes.filter((note) => note.id !== id);
    };
    if (!write(date, (notes) => changed(notes, before, after))) {
      status.textContent = 'Could not save this change. Please try again.';
      return;
    }
    undo = () => {
      if (!write(date, (notes) => changed(notes, after, before))) {
        status.textContent = 'Could not undo because the note changed or saving failed.';
        return;
      }
      undo = null;
      undoButton.hidden = true;
      status.textContent = 'Change undone.';
      render(true);
    };
    status.textContent = message;
    undoButton.hidden = false;
    render(true);
  }

  function render(focus = false) {
    const { notes, oldNotes, commitments, pending, clock, hours } = read(today, yesterday);
    const tabs = node('div', 'meet-day-tabs');
    const grid = node('div', 'meet-day-grid');
    const eligible = pending.filter((item) => !notes.some((note) => note.commitmentId === item.id));
    body.replaceChildren(tabs, grid);
    function select(index, returnFocus = true) {
      current = index;
      [...grid.children].forEach((column, i) => {
        column.classList.toggle('meet-day-current', i === index);
        tabs.children[i].setAttribute('aria-pressed', String(i === index));
      });
      if (returnFocus) tabs.children[index].focus();
    }
    function choose(container, index, { note, item, source, compose } = {}) {
      current = index;
      container.replaceChildren();
      const form = node('form', 'meet-day-editor');
      const title = node('input');
      const checklist = node('textarea');
      if (compose) {
        title.required = true;
        title.maxLength = 200;
        title.placeholder = 'Note title';
        title.setAttribute('aria-label', 'Note title');
        const tasks = node('details');
        tasks.append(node('summary', '', 'Add to-dos'), checklist);
        checklist.rows = 3;
        checklist.placeholder = 'One to-do per line';
        checklist.setAttribute('aria-label', 'To-dos');
        form.append(title, tasks);
      }
      const timing = node('details');
      const time = node('input');
      time.type = 'time';
      time.setAttribute('aria-label', 'Start time');
      timing.append(node('summary', '', 'Set time'), time);
      if (note && !note.allDay && periodOf(note) === index) {
        time.value = timeLabel(note.minute, '24');
        timing.open = true;
      }
      const suggestions = node('select');
      suggestions.setAttribute('aria-label', 'Suggested start times');
      const placeholder = node('option', '', 'Suggested times');
      placeholder.value = '';
      suggestions.append(placeholder);
      const durationOf = (entry) =>
        commitments.find((candidate) => candidate.id === entry.commitmentId)?.minutes || 1;
      const duration = item?.minutes || (note ? durationOf(note) : 1);
      const conflictAt = (minute, entries = notes) =>
        entries.find(
          (entry) =>
            entry.id !== note?.id &&
            !entry.allDay &&
            minute < entry.minute + durationOf(entry) &&
            minute + duration > entry.minute,
        );
      const fitsAwake = (minute) =>
        minute >= starts[index] &&
        minute < starts[index + 1] &&
        minute + duration <= 1440 &&
        Array.from({ length: duration }, (_, i) => minute + i).every((value) =>
          isAwake(value, hours),
        );
      for (let minute = starts[index]; minute < starts[index + 1]; minute += 15) {
        if (!fitsAwake(minute) || conflictAt(minute)) continue;
        const option = node('option', '', timeLabel(minute, clock));
        option.value = timeLabel(minute, '24');
        suggestions.append(option);
      }
      suggestions.addEventListener('change', () => {
        time.value = suggestions.value;
      });
      timing.append(suggestions);
      if (item) timing.open = true;
      const anytime = button('Leave untimed', () => {
        time.value = '';
        timing.open = false;
      });
      timing.append(anytime);
      form.append(timing);
      const error = node('p', 'field-hint');
      error.setAttribute('role', 'status');
      const save = node(
        'button',
        'primary',
        compose ? 'Add note' : source ? 'Carry forward' : item ? 'Schedule' : 'Move note',
      );
      save.type = 'submit';
      form.append(
        save,
        button('Cancel', () => render(true)),
        error,
      );
      container.append(form);
      (compose ? title : timing.querySelector('summary')).focus();

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const timed = timing.open && !!time.value;
        const parts = time.value.split(':').map(Number);
        const minute = timed ? parts[0] * 60 + parts[1] : starts[index];
        if (timed && !fitsAwake(minute)) {
          error.textContent = 'Choose a start time in this period that fits your awake hours.';
          return;
        }
        const fresh = read(today, yesterday);
        const conflict = timed && conflictAt(minute, fresh.notes);
        if (conflict) {
          error.textContent = `Overlaps with ${titleOf(conflict)}. Choose another time.`;
          return;
        }
        const placement = {
          minute,
          allDay: !timed,
          dayPeriod: index,
          remind: timed && !!note?.remind,
        };
        if (
          source &&
          !fresh.oldNotes.some((entry) => JSON.stringify(entry) === JSON.stringify(source))
        ) {
          error.textContent = 'This note changed. Close and reopen the planner to refresh it.';
          return;
        }
        if (item && fresh.notes.some((entry) => entry.commitmentId === item.id)) {
          error.textContent = 'This commitment is already on your plan.';
          return;
        }
        if (
          source &&
          fresh.notes.some((entry) => entry.carriedFrom === `${yesterday}/${source.id}`)
        ) {
          error.textContent = 'This note is already on your plan.';
          return;
        }
        let entry;
        if (note) entry = { ...note, ...placement };
        else if (source) {
          const {
            repeat,
            commitmentId,
            lifeSource,
            yearlySource,
            listOrder,
            focusReports,
            guidedActivities,
            ...copy
          } = carryForward(source, crypto.randomUUID());
          entry = { ...copy, ...placement, carriedFrom: `${yesterday}/${source.id}` };
        } else {
          const lines = compose
            ? checklist.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
            : [];
          let start = 0;
          const tasks = lines.map((line) => {
            const task = { start, done: false };
            start += line.length + 1;
            return task;
          });
          entry = {
            id: crypto.randomUUID(),
            title: item?.title || title.value.trim(),
            text: item?.body || lines.join('\n'),
            tags: item?.tags || [],
            task: false,
            tasks,
            done: false,
            ...placement,
            ...(item ? { commitmentId: item.id } : {}),
          };
          if (!entry.title) {
            title.focus();
            return;
          }
        }
        apply(today, note, entry, `${titleOf(entry)} added to ${periods[index].toLowerCase()}.`);
      });
    }

    function destinations(container, options) {
      const controls = node('div', 'meet-day-actions');
      periods.forEach((period, index) =>
        controls.append(button(period, () => choose(container, index, options))),
      );
      container.replaceChildren(controls);
      controls.firstElementChild.focus();
    }
    periods.forEach((period, index) => {
      const entries = notes
        .filter((entry) => periodOf(entry) === index)
        .sort((a, b) => Number(!!a.allDay) - Number(!!b.allDay) || a.minute - b.minute);
      tabs.append(button(`${period} (${entries.length})`, () => select(index)));
      const column = node('section', 'meet-day-column');
      const actions = node('div', 'meet-day-actions');
      const editor = node('div');
      actions.append(
        button('+ Note', () => choose(editor, index, { compose: true })),
        button('Schedule commitment', () => {
          editor.replaceChildren();
          if (!eligible.length)
            editor.append(node('p', 'field-hint', 'No unscheduled commitments.'));
          for (const item of eligible)
            editor.append(button(item.title, () => choose(editor, index, { item })));
          editor.querySelector('button')?.focus();
        }),
      );
      column.append(node('h3', '', `${period} (${entries.length})`), actions, editor);
      if (!entries.length) column.append(node('p', 'field-hint', 'Nothing planned yet'));
      let anytime = false;
      for (const entry of entries) {
        if (entry.allDay && !anytime) {
          column.append(node('h4', '', 'Anytime'));
          anytime = true;
        }
        const row = node('div', 'meet-day-row');
        const edit = node('div');
        row.append(
          node(
            'span',
            'field-hint',
            [
              entry.allDay ? '' : timeLabel(entry.minute, clock),
              entry.commitmentId ? 'Commitment' : 'Note',
            ]
              .filter(Boolean)
              .join(' · '),
          ),
          node('strong', '', titleOf(entry)),
          button('Move', () => destinations(edit, { note: entry })),
          edit,
        );
        column.append(row);
      }
      grid.append(column);
    });
    select(current, false);
    if (eligible.length) {
      const section = node('section', 'meet-day-queue');
      section.append(node('h3', '', 'Unscheduled commitments'));
      for (const item of eligible) {
        const row = node('div', 'meet-day-row');
        const actions = node('div', 'meet-day-actions');
        periods.forEach((period, index) =>
          actions.append(button(period, () => choose(actions, index, { item }))),
        );
        row.append(
          node('strong', '', item.title),
          node('span', 'field-hint', `${item.minutes} min`),
          actions,
        );
        section.append(row);
      }
      body.append(section);
    }
    const open = oldNotes.filter(
      (note) => !note.done || noteTasks(note).some((task) => !task.done),
    );
    if (open.length) {
      const section = node('section', 'meet-day-queue');
      section.append(node('h3', '', 'Open from yesterday'));
      for (const note of open) {
        const pending = noteTasks(note).filter((task) => !task.done);
        const row = node('div', 'meet-day-row');
        const actions = node('div', 'meet-day-actions');
        const edit = node('div');
        const carried = notes.find((entry) => entry.carriedFrom === `${yesterday}/${note.id}`);
        const done = () =>
          apply(
            yesterday,
            note,
            {
              ...note,
              done: true,
              tasks: noteTasks(note).map((task) => ({ ...task, done: true })),
            },
            'Marked done for yesterday.',
          );
        actions.append(
          button('Mark done', () => {
            if (!pending.length) return done();
            edit.replaceChildren(
              button('Complete all and close', done, 'primary'),
              button('Cancel', () => render(true)),
            );
            edit.firstElementChild.focus();
          }),
        );
        if (carried)
          actions.append(
            node('span', 'field-hint', `Carried to ${periods[periodOf(carried)].toLowerCase()}`),
          );
        else actions.append(button('Carry forward', () => destinations(edit, { source: note })));
        row.append(node('strong', '', titleOf(note)));
        if (pending.length) {
          const preview = pending
            .slice(0, 2)
            .map(({ start }) => note.text.slice(start).split('\n')[0])
            .filter(Boolean)
            .join(' · ');
          row.append(
            node(
              'span',
              'field-hint',
              [`${pending.length} unfinished`, preview].filter(Boolean).join(' · '),
            ),
          );
        }
        row.append(actions, edit);
        section.append(row);
      }
      body.append(section);
    }
    if (reflection) body.append(reflection);
    if (focus) undoButton.hidden ? footer.lastElementChild.focus() : undoButton.focus();
  }
  render();
  return frame;
}
