import { node } from '../../shared/dom.js?v=a7be98a47197';
import { createWeeklySection } from './weekly-notes.js?v=a7be98a47197';
import {
  NOTE_TYPES,
  categoryOptions,
  typeChips,
  tagBadges,
  matchesNoteType,
  typeBadge,
  noteTags,
  categoryLabel,
} from '../notes/note-types.js?v=a7be98a47197';
import { voice, focusMantras, focusIdeas } from '../../personalities/index.js?v=a7be98a47197';
import { dateActions } from './date-actions.js?v=a7be98a47197';
import { dayKey, parseDay, timeLabel } from '../../shared/schedule.js?v=a7be98a47197';
import { monthWeeks, offsetMonth, noteTitle } from './model.js?v=a7be98a47197';

const button = (text, label, action) => {
  const el = node('button', '', text);
  el.type = 'button';
  el.setAttribute('aria-label', label);
  el.addEventListener('click', action);
  return el;
};
function categoryColor(tag) {
  if (Object.hasOwn(NOTE_TYPES, tag)) return `var(--type-${tag})`;
  let hue = 0;
  for (const character of tag) hue = (hue * 31 + character.codePointAt(0)) % 360;
  return `hsl(${hue} 55% 48%)`;
}
function categoryBackground(tags) {
  if (!tags.length) return 'var(--white)';
  if (tags.length === 1) return `color-mix(in srgb, ${categoryColor(tags[0])} 24%, var(--white))`;
  const stops = tags.map(
    (tag, index) =>
      `color-mix(in srgb, ${categoryColor(tag)} 24%, var(--white)) ${(index * 100) / tags.length}% ${((index + 1) * 100) / tags.length}%`,
  );
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
export function setupMonthly({
  root,
  getState,
  onOpen,
  onDuplicate,
  onMove,
  onAdd,
  announce,
  selection,
  applyWeekly,
}) {
  let allFilters = true;
  const filters = new Set(['none', ...Object.keys(NOTE_TYPES)]);
  let month = dayKey().slice(0, 7),
    drag = null,
    hoverTimer = null,
    touch = null,
    suppressClick = false;
  let weeklySections = [],
    overflowUpdates = [];
  function flushWeekly() {
    for (const section of weeklySections) section.flush();
  }
  const observer =
    typeof ResizeObserver === 'function' ? new ResizeObserver(() => measureOverflow()) : null;
  function measureOverflow() {
    if (root.hidden) return;
    for (const update of overflowUpdates) update();
  }
  window.addEventListener('resize', measureOverflow);
  const dates = dateActions({ onAdd: quickAdd, onOpen, isActive: () => !root.hidden });
  function quickAdd(date) {
    const dialog = node('dialog', 'month-quick-dialog'),
      form = node('form');
    const dateLabel = parseDay(date).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const heading = node('h2', '', `Quick note · ${dateLabel}`);
    heading.id = 'quick-note-heading';
    dialog.setAttribute('aria-labelledby', heading.id);
    const titleLabel = node('label', '', 'Note title'),
      title = node('input');
    title.type = 'text';
    title.required = true;
    title.maxLength = 200;
    title.placeholder = 'What would you like to plan?';
    title.setAttribute('aria-label', 'Quick note title');
    titleLabel.append(title);
    const timeLabel = node('label', '', 'Time'),
      time = node('input');
    time.type = 'time';
    time.required = true;
    time.step = '60';
    time.value = '09:00';
    time.setAttribute('aria-label', 'Quick note time');
    timeLabel.append(time);
    const noteType = typeChips(
      [],
      'Tags (optional)',
      () => {},
      categoryOptions(getState().days, getState().settings.tags),
    );
    const actions = node('div', 'inline'),
      add = node('button', 'primary', 'Add note');
    add.type = 'submit';
    actions.append(
      add,
      button('Cancel', 'Cancel quick note', () => dialog.close()),
      button('Open day', 'Open this date in Daily', () => {
        dialog.close();
        onOpen(date);
      }),
    );
    form.append(heading, titleLabel, timeLabel, noteType.element, actions);
    dialog.append(form);
    document.body.append(dialog);
    title.addEventListener('input', () => title.setCustomValidity(''));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      title.setCustomValidity(title.value.trim() ? '' : 'Enter a note title.');
      if (!form.reportValidity()) return;
      if (onAdd(date, title.value, time.value, noteType.value) !== false) {
        for (const tag of noteType.value.length ? noteType.value : ['none']) filters.add(tag);
        render();
        dialog.close();
      }
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (!root.hidden)
        root
          .querySelector(`[data-date="${date}"] .month-day-heading`)
          ?.focus({ preventScroll: true });
    });
    dialog.showModal();
    title.focus();
  }
  function shift(delta) {
    month = offsetMonth(month, delta);
    render();
  }
  function chooseDate(source, id) {
    const entry = getState().days[source]?.find((e) => e.id === id);
    if (!entry) return;
    const dialog = node('dialog', 'month-move-dialog'),
      form = node('form'),
      heading = node('h2', '', `Move “${noteTitle(entry)}”`);
    const label = node('label', '', 'New date'),
      input = node('input');
    input.type = 'date';
    input.value = source;
    input.required = true;
    input.setAttribute('aria-label', 'New date for note');
    label.append(input);
    const actions = node('div', 'inline'),
      cancel = button('Cancel', 'Cancel move', () => dialog.close()),
      submit = node('button', 'primary', 'Move note');
    submit.type = 'submit';
    actions.append(cancel, submit);
    form.append(heading, label, actions);
    dialog.append(form);
    document.body.append(dialog);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!input.reportValidity()) return;
      if (onMove(source, id, input.value) !== false) dialog.close();
    });
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
    input.focus();
  }
  function expandDay(date) {
    dates.reset();
    const dialog = node('dialog', 'month-expanded-day'),
      heading = node(
        'h2',
        '',
        parseDay(date).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      );
    heading.id = 'expanded-day-heading';
    dialog.setAttribute('aria-labelledby', heading.id);
    const count = node('p', 'field-hint'),
      list = node('ul', 'month-expanded-list');
    list.setAttribute('aria-label', 'All notes for this day');
    function refresh() {
      const entries = (getState().days[date] || [])
        .filter((note) => !note.weekly)
        .slice()
        .sort((a, b) => a.minute - b.minute);
      list.replaceChildren();
      count.textContent = `${entries.length} ${entries.length === 1 ? 'note' : 'notes'} · All tags shown. Select a title to open its note in Daily.`;
      for (const entry of entries) {
        const row = node('li', 'month-expanded-note' + (entry.done ? ' completed' : '')),
          open = button(noteTitle(entry), `Open note: ${noteTitle(entry)}`, () => {
            dialog.close();
            onOpen(date, entry.id);
          });
        open.className = 'month-expanded-title';
        row.append(
          node('span', 'month-expanded-time', timeLabel(entry.minute, getState().settings.clock)),
          open,
        );
        if (onDuplicate)
          row.append(
            button('Duplicate', 'Duplicate note: ' + noteTitle(entry), () => {
              if (onDuplicate(date, entry.id) !== false) refresh();
            }),
          );
        const tags = tagBadges(entry);
        if (tags) row.append(tags);
        list.append(row);
      }
      if (!entries.length) list.append(node('li', 'field-hint', 'No notes for this day yet.'));
    }
    const actions = node('div', 'inline');
    actions.append(
      button('Open day', 'Open this date in Daily', () => {
        dialog.close();
        onOpen(date);
      }),
      button('Close', 'Close expanded day', () => dialog.close()),
    );
    dialog.append(heading, count, list, actions);
    refresh();
    document.body.append(dialog);
    const onAccount = () => dialog.close();
    window.addEventListener('dayline:notes-changed', refresh);
    window.addEventListener('dayline:account', onAccount);
    dialog.addEventListener(
      'close',
      () => {
        window.removeEventListener('dayline:notes-changed', refresh);
        window.removeEventListener('dayline:account', onAccount);
        dialog.remove();
        if (!root.hidden)
          root
            .querySelector(`[data-date="${date}"] .month-expand-day`)
            ?.focus({ preventScroll: true });
      },
      { once: true },
    );
    dialog.showModal();
  }
  function render() {
    dates.reset();
    for (const section of weeklySections) section.destroy();
    weeklySections = [];
    observer?.disconnect();
    overflowUpdates = [];
    const types = categoryOptions(getState().days, getState().settings.tags, true),
      filterKeys = ['none', ...Object.keys(types)];
    if (allFilters) for (const key of filterKeys) filters.add(key);
    const content = document.createDocumentFragment(),
      head = node('div', 'month-heading'),
      heading = node(
        'h1',
        '',
        parseDay(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      );
    heading.id = 'month-heading';
    const nav = node('div', 'month-navigation');
    const previous = button('←', 'Previous month', () => shift(-1)),
      next = button('→', 'Next month', () => shift(1));
    previous.dataset.monthStep = -1;
    next.dataset.monthStep = 1;
    const picker = node('input');
    picker.type = 'month';
    picker.value = month;
    picker.setAttribute('aria-label', 'Go to month');
    picker.addEventListener('change', () => {
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(picker.value)) {
        month = picker.value;
        render();
      }
    });
    nav.append(
      previous,
      picker,
      next,
      button('This month', 'Go to this month', () => {
        month = dayKey().slice(0, 7);
        render();
      }),
    );
    head.append(heading, nav);
    content.append(
      node('div', 'eyebrow', voice('monthly.eyebrow')),
      head,
      node(
        'p',
        'intro',
        'Click or tap a date to add a title and time. Double-click or double-tap to open its day. Drag titles to reschedule. Note colors show their tags; multiple tags split the colors evenly. Scroll for more notes, or use Expand day for full titles, times, and tags.',
      ),
    );
    const selectionControls = selection?.controls();
    if (selectionControls) content.append(selectionControls);
    const filter = node('fieldset', 'month-type-filters');
    filter.append(node('legend', '', 'Show tags'));
    const all = button('All tags', 'Show all tags', () => {
      allFilters = true;
      for (const key of filterKeys) filters.add(key);
      render();
      root.querySelector('.month-type-all')?.focus();
    });
    all.className = 'secondary month-type-all';
    all.setAttribute('aria-pressed', String(filterKeys.every((key) => filters.has(key))));
    filter.append(all);
    for (const key of filterKeys) {
      const label = node('label', ''),
        check = node('input');
      check.type = 'checkbox';
      check.checked = filters.has(key);
      check.dataset.typeFilter = key;
      check.setAttribute('aria-label', `Show ${types[key] || 'None'} notes`);
      check.addEventListener('change', () => {
        allFilters = false;
        if (check.checked) filters.add(key);
        else filters.delete(key);
        render();
        root.querySelector(`[data-type-filter="${CSS.escape(key)}"]`)?.focus();
      });
      const badge = typeBadge(key) || node('span', '', 'None');
      if (key !== 'none') badge.style.setProperty('--type-color', categoryColor(key));
      label.append(check, badge);
      filter.append(label);
    }
    content.append(filter);
    if (!filters.size)
      content.append(
        node('p', 'field-hint', 'No tags selected. Choose a tag above to show its notes.'),
      );
    for (const week of monthWeeks(month)) {
      const section = node('section', 'month-week');
      const weekHeading = node(
        'h2',
        '',
        `Week of ${parseDay(week[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      );
      section.append(weekHeading);
      if (applyWeekly) {
        const weekly = createWeeklySection({
          week: week[0],
          getState,
          apply: applyWeekly,
          onChanged: render,
        });
        weeklySections.push(weekly);
        section.append(weekly.element);
      }
      const grid = node('div', 'month-grid');
      for (const date of week) {
        const day = node(
          'section',
          `month-day${date.slice(0, 7) !== month ? ' outside-month' : ''}${date === dayKey() ? ' month-today' : ''}`,
        );
        day.dataset.date = date;
        const dateLabel = parseDay(date).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        day.setAttribute('aria-label', dateLabel);
        const open = button(
          parseDay(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
          `Add a note on ${dateLabel}`,
          (event) => dates.click(date, event.detail),
        );
        open.className = 'month-day-heading';
        open.title = 'Click to add a note · Double-click to open Daily';
        open.addEventListener('keydown', (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            dates.reset();
            onOpen(date);
          }
        });
        const dateHeader = node('div', 'month-date-header'),
          expand = button('⤢', `Expand day: ${dateLabel}`, () => expandDay(date));
        expand.className = 'month-expand-day';
        expand.title = 'Expand day';
        dateHeader.append(open, expand);
        day.append(dateHeader);
        day.addEventListener('click', (event) => {
          if (event.target.closest('button,input,.month-note,.month-notes-wrap')) return;
          dates.click(date, event.detail);
        });
        const list = node('div', 'month-notes'),
          wrap = node('div', 'month-notes-wrap'),
          more = button('', 'Scroll to more notes', () => {
            const below = list.scrollHeight - list.clientHeight - list.scrollTop > 2;
            list.scrollTo({
              top: below ? list.scrollTop + Math.max(60, list.clientHeight * 0.8) : 0,
              behavior: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
            });
          });
        more.className = 'month-more-notes';
        more.hidden = true;
        list.tabIndex = 0;
        list.setAttribute('role', 'region');
        list.setAttribute('aria-label', `Notes for ${dateLabel}. Scroll to read all titles.`);
        for (const entry of (getState().days[date] || []).filter(
          (entry) => !entry.weekly && matchesNoteType(entry, filters),
        )) {
          const card = node('div', `month-note${entry.done ? ' completed' : ''}`);
          card.draggable = !selection?.active;
          card.dataset.id = entry.id;
          card.dataset.source = date;
          const pick = selection?.checkbox(date, entry);
          if (pick) card.append(pick);
          card.classList.toggle('bulk-selected', !!selection?.isSelected(date, entry.id));
          const title = noteTitle(entry),
            tags = noteTags(entry),
            details = `${title} · ${timeLabel(entry.minute, getState().settings.clock)} · ${tags.length ? tags.map(categoryLabel).join(' + ') : 'No tags'}`,
            edit = button(title, `Open note: ${details}`, () => onOpen(date, entry.id));
          edit.className = 'month-note-title';
          edit.title = details;
          card.title = details;
          card.style.setProperty('--month-note-background', categoryBackground(tags));
          card.style.background = 'var(--month-note-background)';
          const handle = button('⠿', `Hold to drag ${title}, or choose a date`, () =>
            chooseDate(date, entry.id),
          );
          handle.className = 'month-drag';
          const move = button('↗', `Move ${title} to another date`, () =>
            chooseDate(date, entry.id),
          );
          move.className = 'month-move';
          card.append(handle, edit, move);
          list.append(card);
        }
        if (!list.children.length)
          list.append(
            node(
              'span',
              'month-empty',
              (getState().days[date] || []).some((note) => !note.weekly)
                ? 'No matching notes'
                : '—',
            ),
          );
        function updateOverflow() {
          const overflow = list.scrollHeight > list.clientHeight + 2,
            below = overflow && list.scrollHeight - list.clientHeight - list.scrollTop > 2;
          wrap.classList.toggle('has-notes-below', below);
          more.hidden = !overflow;
          const bottom = list.getBoundingClientRect().bottom,
            remaining = [...list.querySelectorAll('.month-note')].filter(
              (card) => card.getBoundingClientRect().bottom > bottom + 1,
            ).length;
          more.textContent = below
            ? remaining
              ? `↓ ${remaining} more ${remaining === 1 ? 'note' : 'notes'}`
              : '↓ More notes'
            : '↑ Back to top';
          more.setAttribute(
            'aria-label',
            below ? 'Scroll down to more notes' : 'Scroll notes back to top',
          );
        }
        list.addEventListener('scroll', updateOverflow, { passive: true });
        overflowUpdates.push(updateOverflow);
        wrap.append(list);
        day.append(wrap, more);
        grid.append(day);
      }
      section.append(grid);
      content.append(section);
    }
    root.replaceChildren(content);
    for (const list of root.querySelectorAll('.month-notes')) observer?.observe(list);
    requestAnimationFrame(measureOverflow);
  }
  function scheduleWeeklyDrop(item, date) {
    const temp = createWeeklySection({
      week: item.source,
      getState,
      apply: applyWeekly,
      onChanged: render,
    });
    temp.schedule(item.id, date);
    temp.destroy();
  }
  function scrollNoteList(target, y) {
    const list = target?.closest('.month-notes');
    if (!list) return;
    const rect = list.getBoundingClientRect();
    if (y < rect.top + 28) list.scrollTop -= 14;
    else if (y > rect.bottom - 28) list.scrollTop += 14;
  }
  function highlight(target) {
    root
      .querySelectorAll('.month-drop-target')
      .forEach((el) => el.classList.remove('month-drop-target'));
    target?.closest('.month-day')?.classList.add('month-drop-target');
  }
  function hoverMonth(target) {
    const step = target?.closest('[data-month-step]');
    if (hoverTimer?.element === step) return;
    if (hoverTimer) clearTimeout(hoverTimer.timer);
    hoverTimer = null;
    if (step)
      hoverTimer = {
        element: step,
        timer: setTimeout(() => {
          shift(Number(step.dataset.monthStep));
          hoverTimer = null;
        }, 700),
      };
  }
  function clearDrag() {
    drag = null;
    if (hoverTimer) clearTimeout(hoverTimer.timer);
    hoverTimer = null;
    root
      .querySelectorAll('.month-drop-target')
      .forEach((el) => el.classList.remove('month-drop-target'));
  }
  root.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.month-note,.weekly-note');
    if (!card || event.target.closest('.editor')) return;
    dates.reset();
    drag = {
      source: card.dataset.source,
      id: card.dataset.id,
      weekly: card.dataset.weekly === 'true',
    };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'text/plain',
      card.querySelector('.month-note-title,.weekly-note-title').textContent,
    );
    announce('Drop the note on a day. Hover over a month arrow to change months.');
  });
  root.addEventListener('dragover', (event) => {
    if (!drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    highlight(event.target);
    hoverMonth(event.target);
    scrollNoteList(event.target, event.clientY);
  });
  root.addEventListener('drop', (event) => {
    if (!drag) return;
    event.preventDefault();
    const day = event.target.closest('.month-day'),
      item = drag;
    clearDrag();
    if (day) {
      if (item.weekly) scheduleWeeklyDrop(item, day.dataset.date);
      else onMove(item.source, item.id, day.dataset.date);
    }
  });
  root.addEventListener('dragend', clearDrag);
  // Touch devices use a held drag handle, leaving normal page scrolling available.
  root.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || !event.target.closest('.month-drag')) return;
    const card = event.target.closest('.month-note,.weekly-note');
    touch = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      source: card.dataset.source,
      id: card.dataset.id,
      weekly: card.dataset.weekly === 'true',
      active: false,
    };
    touch.timer = setTimeout(() => {
      if (!touch) return;
      touch.active = true;
      root.setPointerCapture(touch.pointer);
      announce('Drag to a day, then release.');
    }, 350);
  });
  root.addEventListener('pointermove', (event) => {
    if (!touch || event.pointerId !== touch.pointer) return;
    if (!touch.active) {
      if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) {
        clearTimeout(touch.timer);
        touch = null;
      }
      return;
    }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    highlight(target);
    hoverMonth(target);
    scrollNoteList(target, event.clientY);
    if (event.clientY < 100) window.scrollBy(0, -14);
    else if (event.clientY > innerHeight - 100) window.scrollBy(0, 14);
  });
  function release(event) {
    if (!touch || event.pointerId !== touch.pointer) return;
    const item = touch;
    clearTimeout(item.timer);
    touch = null;
    if (item.active) {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 500);
      event.preventDefault();
      const day = document.elementFromPoint(event.clientX, event.clientY)?.closest('.month-day');
      clearDrag();
      if (event.type === 'pointerup' && day) {
        if (item.weekly) scheduleWeeklyDrop(item, day.dataset.date);
        else onMove(item.source, item.id, day.dataset.date);
      }
    }
  }
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener(
    'click',
    (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
  return {
    render,
    flushWeekly,
    getMonth: () => month,
    show(date) {
      month = date.slice(0, 7);
      render();
    },
  };
}
