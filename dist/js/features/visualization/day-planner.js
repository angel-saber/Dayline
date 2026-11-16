import { node } from '../../shared/dom.js?v=b97af5500a9f';
import { offsetDay, parseDay, timeLabel } from '../../shared/dates.js?v=b97af5500a9f';
import { noteTasks } from '../notes/formatting/tasks.js?v=b97af5500a9f';
import { buildDayReview, calendarLabel, planningTimeLabel } from './day-review.js?v=b97af5500a9f';

const periods = ['Morning', 'Afternoon', 'Evening'];
const periodOf = (note) =>
  note.allDay ? (note.dayPeriod ?? 0) : note.minute < 720 ? 0 : note.minute < 1020 ? 1 : 2;
const isOpen = (note) => !note.done || noteTasks(note).some((task) => !task.done);
const complete = (note) => ({
  ...note,
  done: true,
  tasks: noteTasks(note).map((task) => ({ ...task, done: true })),
});
const calendarNote = (note) => {
  const { calendarDay, ...entry } = note;
  return { ...entry, minute: entry.minute % 1440 };
};
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

export function buildDayPlanner({
  today,
  read,
  write,
  writeBatch,
  finish,
  reflection,
  getTiming,
  dayState = {},
  saveDayState,
}) {
  const tomorrow = offsetDay(today, 1);
  const adaptive = !!getTiming;
  const saveState = (patch) => {
    Object.assign(dayState, patch);
    saveDayState?.(dayState);
  };
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
  let current = adaptive ? periodOf({ minute: getTiming().current }) : 0;
  let undo = null;
  let dragged = null;
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

  function applyChanges(changes, message, preference) {
    const patches = [];
    for (const { from, to, before, after } of changes) {
      if (from === to) patches.push({ day: from, before, after });
      else {
        if (before) patches.push({ day: from, before });
        if (after) patches.push({ day: to, after });
      }
    }
    const applyPatches = (edits) => {
      const next = (notes, { before, after }) => {
        const previous = before && calendarNote(before);
        const value = after && calendarNote(after);
        const id = previous?.id ?? value.id;
        const existing = notes.find((note) => note.id === id);
        if (previous ? JSON.stringify(existing) !== JSON.stringify(previous) : existing)
          return null;
        return value
          ? existing
            ? notes.map((note) => (note.id === id ? value : note))
            : [...notes, value]
          : notes.filter((note) => note.id !== id);
      };
      if (writeBatch)
        return writeBatch(
          edits.map((edit) => ({ day: edit.day, update: (notes) => next(notes, edit) })),
        );
      return edits.length === 1 && write(edits[0].day, (notes) => next(notes, edits[0]));
    };
    if (!applyPatches(patches)) {
      status.textContent = 'Could not save this change. Please refresh and try again.';
      return;
    }
    const previousPriority = dayState.priority;
    if (preference) saveState(preference);
    undo = () => {
      const reverse = patches
        .map(({ day, before, after }) => ({ day, before: after, after: before }))
        .reverse();
      if (!applyPatches(reverse)) {
        status.textContent = 'Could not undo because an item changed or saving failed.';
        return;
      }
      undo = null;
      if (preference && dayState.priority === preference.priority)
        saveState({ priority: previousPriority });
      undoButton.hidden = true;
      status.textContent = 'Change undone.';
      render(true);
    };
    status.textContent = message;
    undoButton.hidden = false;
    render(true);
    if (changes.some(({ before, after }) => before && after && isOpen(before) && !isOpen(after)))
      document.defaultView.dispatchEvent(
        new document.defaultView.CustomEvent('dayline:effect', { detail: { kind: 'complete' } }),
      );
  }
  const apply = (date, before, after, message) =>
    applyChanges([{ from: before?.calendarDay || date, to: date, before, after }], message);

  function render(focus = false) {
    const { notes, oldNotes, commitments, pending, clock, hours } = read(today, yesterday);
    const planTiming = getTiming?.();
    const end = planTiming?.end ?? 1440;
    const dayStarts = [0, 720, 1020, Math.max(1440, end)];
    const tabs = node('div', 'meet-day-tabs');
    const grid = node('div', 'meet-day-grid');
    const eligible = pending.filter((item) => !notes.some((note) => note.commitmentId === item.id));
    body.replaceChildren();
    if (adaptive)
      body.append(
        buildDayReview({
          today,
          timing: planTiming,
          notes,
          commitments,
          pending,
          clock,
          state: dayState,
          saveState,
          button,
          titleOf,
          isOpen,
          complete,
          update: applyChanges,
          rerender: () => render(true),
        }),
      );
    body.append(tabs, grid);
    const pin = (key) =>
      button(dayState.priority === key ? 'Priority selected' : 'Make this my priority', () => {
        saveState({ priority: key });
        render(true);
      });
    function select(index, returnFocus = true) {
      current = index;
      [...grid.children].forEach((column, i) => {
        column.classList.toggle('meet-day-current', i === index);
        tabs.children[i].setAttribute('aria-pressed', String(i === index));
      });
      if (returnFocus) tabs.children[index].focus();
    }
    function choose(container, index, { note, item, source, compose } = {}) {
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
        time.value = timeLabel(note.minute % 1440, '24');
        timing.open = true;
      }
      const suggestions = node('select');
      suggestions.setAttribute('aria-label', 'Suggested start times');
      const placeholder = node('option', '', 'Suggested times');
      placeholder.value = '';
      suggestions.append(placeholder);
      const durationOf = (entry) =>
        entry.focusBlockMinutes ||
        commitments.find((candidate) => candidate.id === entry.commitmentId)?.minutes ||
        1;
      const duration = item?.minutes || (note ? durationOf(note) : 1);
      const conflictAt = (minute, entries = notes) =>
        entries.find(
          (entry) =>
            entry.id !== note?.id &&
            !entry.allDay &&
            !entry.done &&
            minute < entry.minute + durationOf(entry) &&
            minute + duration > entry.minute,
        );
      const awakeStart = planTiming ? Math.max(planTiming.start, planTiming.current) : hours.from;
      const awakeEnd = planTiming?.end ?? (hours.to > hours.from ? hours.to : 1440);
      const fitsAwake = (minute) =>
        minute >= dayStarts[index] &&
        minute < dayStarts[index + 1] &&
        minute >= awakeStart &&
        minute + duration <= awakeEnd;
      for (
        let minute = Math.ceil(Math.max(awakeStart, dayStarts[index]) / 15) * 15;
        minute < dayStarts[index + 1];
        minute += 15
      ) {
        if (!fitsAwake(minute) || conflictAt(minute)) continue;
        const option = node('option', '', planningTimeLabel(today, minute, clock));
        option.value = timeLabel(minute % 1440, '24');
        suggestions.append(option);
      }
      const dateHint = node('p', 'field-hint');
      const startMinute = () => {
        if (!time.value) return dayStarts[index];
        const [h, m] = time.value.split(':').map(Number);
        const minute = h * 60 + m;
        return index === 2 && end > 1440 && minute < end - 1440 ? minute + 1440 : minute;
      };
      const showDate = () => {
        dateHint.textContent = `Daily date · ${calendarLabel(startMinute() >= 1440 ? tomorrow : today)}`;
      };
      time.addEventListener('input', showDate);
      showDate();
      suggestions.addEventListener('change', () => {
        time.value = suggestions.value;
        showDate();
      });
      timing.append(suggestions, dateHint);
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
        const minute = timed ? startMinute() : dayStarts[index];
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
        const destination = minute >= 1440 ? tomorrow : today;
        if (note?.repeat && (note.calendarDay || today) !== destination) {
          error.textContent = 'Move repeating notes across dates from Daily.';
          return;
        }
        current = index;
        const wasPriority = item && dayState.priority === `commitment:${item.id}`;
        applyChanges(
          [
            {
              from: note && (note.calendarDay || today),
              to: destination,
              before: note,
              after: entry,
            },
          ],
          `${titleOf(entry)} added to ${periods[index].toLowerCase()}.`,
          wasPriority ? { priority: `note:${entry.id}` } : null,
        );
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
    function remove(container, entry, day) {
      const commitment = !!entry.commitmentId;
      const label = commitment ? 'Remove placement' : 'Delete note';
      container.replaceChildren(
        node(
          'p',
          'field-hint',
          commitment
            ? `Remove ${titleOf(entry)} from this plan?`
            : `Delete ${titleOf(entry)} from ${calendarLabel(day)}${entry.repeat ? ' (this occurrence)' : ''}?`,
        ),
        button(
          label,
          () =>
            applyChanges(
              [{ from: day, before: entry }],
              commitment ? 'Commitment placement removed.' : 'Note deleted.',
            ),
          'primary',
        ),
        button('Cancel', () => render(true)),
      );
      container.querySelector('button').focus();
    }

    function reorder(entries, entry, target) {
      const reordered = entries.filter((note) => note !== entry);
      reordered.splice(entries.indexOf(target), 0, entry);
      const changes = reordered.flatMap((note, index) => {
        if (note.dayPlanOrder === index) return [];
        const day = note.calendarDay || today;
        return [{ from: day, to: day, before: note, after: { ...note, dayPlanOrder: index } }];
      });
      if (changes.length) applyChanges(changes, 'Card order saved.');
    }

    function allowDrop(element, accepts, drop) {
      element.addEventListener('dragover', (event) => {
        if (!dragged || !accepts(dragged)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });
      element.addEventListener('drop', (event) => {
        if (!dragged || !accepts(dragged)) return;
        event.preventDefault();
        event.stopPropagation();
        const entry = dragged;
        dragged = null;
        frame.classList.remove('meet-day-dragging');
        drop(entry);
      });
    }

    periods.forEach((period, index) => {
      const entries = notes
        .filter((entry) => periodOf(entry) === index)
        .sort(
          (a, b) =>
            Number(!!a.allDay) - Number(!!b.allDay) ||
            (a.allDay && b.allDay
              ? (a.dayPlanOrder ?? Infinity) - (b.dayPlanOrder ?? Infinity) || a.minute - b.minute
              : a.minute - b.minute),
        );
      const untimed = entries.filter((entry) => entry.allDay);
      tabs.append(button(`${period} (${entries.length})`, () => select(index)));
      const column = node('section', 'meet-day-column');
      const actions = node('div', 'meet-day-actions');
      const editor = node('div');
      allowDrop(
        column,
        (entry) => periodOf(entry) !== index,
        (entry) => {
          if (entry.allDay) {
            const day = entry.calendarDay || today;
            const { dayPlanOrder, ...note } = entry;
            current = index;
            applyChanges(
              [
                {
                  from: day,
                  to: today,
                  before: entry,
                  after: { ...note, dayPeriod: index, minute: dayStarts[index] },
                },
              ],
              `${titleOf(entry)} moved to ${period.toLowerCase()}.`,
            );
          } else choose(editor, index, { note: entry });
        },
      );
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
        const cardActions = node('div', 'meet-day-actions');
        const grip = node('span', 'meet-day-drag-handle', '⠿');
        grip.setAttribute('aria-hidden', 'true');
        grip.draggable = true;
        grip.title = 'Drag to move';
        grip.addEventListener('dragstart', (event) => {
          dragged = entry;
          frame.classList.add('meet-day-dragging');
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', titleOf(entry));
          }
        });
        grip.addEventListener('dragend', () => {
          dragged = null;
          frame.classList.remove('meet-day-dragging');
        });
        const position = untimed.indexOf(entry);
        const canReorder = position !== -1 && untimed.length > 1;
        if (canReorder) {
          allowDrop(
            row,
            (source) => source !== entry && untimed.includes(source),
            (source) => reorder(untimed, source, entry),
          );
        }
        cardActions.append(
          button('Move', () => {
            destinations(edit, { note: entry });
            if (canReorder && position > 0)
              edit.firstElementChild.append(
                button('Move up', () => reorder(untimed, entry, untimed[position - 1])),
              );
            if (canReorder && position < untimed.length - 1)
              edit.firstElementChild.append(
                button('Move down', () => reorder(untimed, entry, untimed[position + 1])),
              );
          }),
        );
        cardActions.append(
          button(entry.commitmentId ? 'Remove' : 'Delete', () =>
            remove(edit, entry, entry.calendarDay || today),
          ),
        );
        row.append(
          grip,
          node(
            'span',
            'field-hint',
            [
              entry.allDay ? '' : planningTimeLabel(today, entry.minute, clock),
              entry.commitmentId ? 'Commitment' : 'Note',
            ]
              .filter(Boolean)
              .join(' · '),
          ),
          node('strong', '', titleOf(entry)),
          cardActions,
          edit,
        );
        if (adaptive && isOpen(entry)) row.append(pin(`note:${entry.id}`));
        column.append(row);
      }
      if (adaptive && dayStarts[index + 1] <= planTiming.current) {
        const earlier = node('details', 'meet-day-earlier');
        earlier.append(node('summary', '', `${period} · ${entries.length} earlier`), column);
        allowDrop(
          earlier,
          (entry) => periodOf(entry) !== index,
          (entry) => {
            earlier.open = true;
            choose(editor, index, { note: entry });
          },
        );
        grid.append(earlier);
      } else grid.append(column);
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
        if (adaptive) row.append(pin(`commitment:${item.id}`));
        section.append(row);
      }
      body.append(section);
    }
    const open = oldNotes.filter(isOpen);
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
            note.calendarDay || yesterday,
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
        actions.append(
          button(note.commitmentId ? 'Remove' : 'Delete', () =>
            remove(edit, note, note.calendarDay || yesterday),
          ),
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
