import { node } from '../../shared/dom.js?v=2db51b06c402';
import { grouped, timeLabel } from '../../shared/schedule.js?v=2db51b06c402';
import { noteTitle } from './model.js?v=2db51b06c402';
import { tagBadges } from '../notes/note-types.js?v=2db51b06c402';

const button = (text, label, action, cls = '') => {
  const el = node('button', cls, text);
  el.type = 'button';
  el.setAttribute('aria-label', label);
  el.addEventListener('click', action);
  return el;
};

// The expanded day is a self-contained schedule, not a second copy of planner state.
export function openExpandedDay({ date, getState, onOpen, onDelete, onMove, announce, onClose }) {
  const dialog = node('dialog', 'month-expanded-day');
  const heading = node(
    'h2',
    '',
    new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  );
  heading.id = 'expanded-day-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  const count = node('p', 'field-hint');
  const list = node('div', 'month-expanded-list');
  list.setAttribute('aria-label', 'Day schedule');
  let dragging = null,
    touch = null,
    queued = false,
    suppressClick = false,
    scrollTimer = null;
  function slots() {
    const state = getState();
    return grouped(
      (state.days[date] || []).filter((entry) => !entry.weekly),
      state.settings.interval,
    );
  }
  function render() {
    if (dragging || touch) {
      queued = true;
      return;
    }
    queued = false;
    const state = getState(),
      intervals = slots();
    const total = intervals.reduce((sum, slot) => sum + slot.entries.length, 0);
    count.textContent = `${total} ${total === 1 ? 'note' : 'notes'} · Drag a handle or use Move to change the interval. Select a title to open it in Daily.`;
    list.replaceChildren();
    for (const slot of intervals) {
      const row = node('section', 'month-expanded-slot');
      row.dataset.minute = String(slot.minute);
      const label = timeLabel(slot.minute, state.settings.clock);
      const end = timeLabel(
        Math.min(1440, slot.minute + state.settings.interval),
        state.settings.clock,
      );
      row.setAttribute('aria-label', `${label} to ${end} interval`);
      const range = node('span', 'month-expanded-time');
      range.append(node('span', '', label), node('span', 'month-expanded-end', `– ${end}`));
      row.append(range);
      const notes = node('div', 'month-expanded-slot-notes');
      for (const entry of slot.entries) {
        const title = noteTitle(entry);
        const card = node('div', 'month-expanded-note' + (entry.done ? ' completed' : ''));
        card.dataset.id = entry.id;
        const handle = button('⠿', `Drag note: ${title}`, () => {}, 'month-expanded-handle');
        handle.draggable = true;
        handle.title = 'Hold and drag to another interval';
        const content = node('div', 'month-expanded-content');
        const open = button(
          title,
          `Open note: ${title}`,
          () => {
            dialog.close();
            onOpen(date, entry.id);
          },
          'month-expanded-title',
        );
        const details = node('div', 'month-expanded-details');
        details.append(
          node('span', 'month-expanded-exact', timeLabel(entry.minute, state.settings.clock)),
        );
        const tags = tagBadges(entry);
        if (tags) details.append(tags);
        const actions = node('div', 'month-expanded-actions');
        const move = button('Move', `Move note: ${title}`, () => {
          const current = card.querySelector('.month-expanded-move');
          if (current) {
            current.remove();
            return;
          }
          const form = node('form', 'month-expanded-move');
          const label = node('label', '', 'Move to interval');
          const select = node('select');
          select.setAttribute('aria-label', `Move ${title} to interval`);
          for (const target of intervals) {
            const option = node('option', '', timeLabel(target.minute, state.settings.clock));
            option.value = String(target.minute);
            if (target.minute === slot.minute) option.selected = true;
            select.append(option);
          }
          label.append(select);
          const submit = node('button', 'secondary', 'Move note');
          submit.type = 'submit';
          form.append(label, submit);
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            onMove(date, entry.id, Number(select.value));
          });
          content.append(form);
          select.focus();
        });
        actions.append(
          move,
          button('Delete', `Delete note: ${title}`, () => onDelete(date, entry.id)),
        );
        content.append(open, details, actions);
        card.append(handle, content);
        notes.append(card);
      }
      if (!slot.entries.length)
        notes.append(node('span', 'month-expanded-empty', 'Drop a note here'));
      row.append(notes);
      list.append(row);
    }
  }
  const stopScroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = null;
  };
  const clearHighlights = () =>
    list
      .querySelectorAll('.month-expanded-drop')
      .forEach((row) => row.classList.remove('month-expanded-drop'));
  function targetAt(x, y) {
    const target = document.elementFromPoint(x, y)?.closest('.month-expanded-slot');
    return target && list.contains(target) ? target : null;
  }
  function highlight(target) {
    clearHighlights();
    target?.classList.add('month-expanded-drop');
  }
  function finish() {
    stopScroll();
    clearHighlights();
    dragging = null;
    if (queued && !touch) render();
  }
  list.addEventListener('dragstart', (event) => {
    const handle = event.target.closest('.month-expanded-handle');
    if (!handle) return;
    dragging = handle.closest('.month-expanded-note').dataset.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'Dayline note');
  });
  list.addEventListener('dragover', (event) => {
    if (!dragging) return;
    event.preventDefault();
    const target = event.target.closest('.month-expanded-slot');
    highlight(target);
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });
  list.addEventListener('drop', (event) => {
    if (!dragging) return;
    event.preventDefault();
    const target = event.target.closest('.month-expanded-slot'),
      id = dragging;
    finish();
    if (target) onMove(date, id, Number(target.dataset.minute));
  });
  list.addEventListener('dragend', finish);
  list.addEventListener('pointerdown', (event) => {
    if (touch || event.pointerType === 'mouse') return;
    const handle = event.target.closest('.month-expanded-handle');
    if (!handle) return;
    const card = handle.closest('.month-expanded-note');
    handle.draggable = false;
    touch = {
      id: card.dataset.id,
      handle,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      active: false,
    };
    touch.timer = setTimeout(() => {
      if (!touch) return;
      touch.active = true;
      dragging = touch.id;
      try {
        dialog.setPointerCapture?.(touch.pointer);
      } catch {
        /* Pointer may already be released. */
      }
      announce('Drag to an interval and release to move the note.');
    }, 350);
  });
  function scroll() {
    if (!touch?.active) return;
    const bounds = dialog.getBoundingClientRect();
    if (touch.y < bounds.top + 70) dialog.scrollTop -= 12;
    else if (touch.y > bounds.bottom - 70) dialog.scrollTop += 12;
    highlight(targetAt(touch.x, touch.y));
    scrollTimer = setTimeout(scroll, 30);
  }
  dialog.addEventListener('pointermove', (event) => {
    if (!touch || event.pointerId !== touch.pointer) return;
    if (!touch.active && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) {
      clearTimeout(touch.timer);
      touch.handle.draggable = true;
      touch = null;
      finish();
      return;
    }
    touch.x = event.clientX;
    touch.y = event.clientY;
    if (touch.active) {
      event.preventDefault();
      highlight(targetAt(touch.x, touch.y));
      if (!scrollTimer) scroll();
    }
  });
  function release(event) {
    if (!touch || event.pointerId !== touch.pointer) return;
    const item = touch;
    clearTimeout(item.timer);
    item.handle.draggable = true;
    const target =
      item.active && event.type === 'pointerup' ? targetAt(event.clientX, event.clientY) : null;
    touch = null;
    if (item.active) {
      event.preventDefault();
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 500);
    }
    finish();
    if (target) onMove(date, item.id, Number(target.dataset.minute));
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  dialog.addEventListener(
    'click',
    (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
  const actions = node('div', 'inline');
  actions.append(
    button('Open day', 'Open this date in Daily', () => {
      dialog.close();
      onOpen(date);
    }),
    button('Close', 'Close expanded day', () => dialog.close()),
  );
  dialog.append(heading, count, list, actions);
  render();
  document.body.append(dialog);
  const onAccount = () => dialog.close();
  window.addEventListener('dayline:notes-changed', render);
  window.addEventListener('dayline:account', onAccount);
  dialog.addEventListener(
    'close',
    () => {
      if (touch) {
        clearTimeout(touch.timer);
        touch.handle.draggable = true;
        touch = null;
      }
      finish();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('dayline:notes-changed', render);
      window.removeEventListener('dayline:account', onAccount);
      dialog.remove();
      onClose();
    },
    { once: true },
  );
  dialog.showModal();
}
