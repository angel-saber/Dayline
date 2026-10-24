import { setupFocusAudio } from '../features/focus-audio/controller.js?v=c17c8abbdfaa';
import { setupPersonalityEffects } from '../personalities/effects.js?v=c17c8abbdfaa';
import { node } from '../shared/dom.js?v=c17c8abbdfaa';
import { setupBackups } from '../features/settings/backups.js?v=c17c8abbdfaa';
import { setupSettings } from '../features/settings/controller.js?v=c17c8abbdfaa';
import { renderNoteLines } from '../features/notes/render.js?v=c17c8abbdfaa';
import { rescheduleNote } from '../features/daily/reschedule.js?v=c17c8abbdfaa';
import { changeWeekly } from '../features/monthly/weekly-model.js?v=c17c8abbdfaa';
import {
  availableHours,
  dailySlotVisible,
} from '../features/settings/available-hours.js?v=c17c8abbdfaa';
import {
  attachmentList,
  bindFileDrop,
} from '../features/attachments/attachments.js?v=c17c8abbdfaa';
import { setupTagSettings } from '../features/notes/tag-settings.js?v=c17c8abbdfaa';
import { setupBulk } from '../features/bulk/view.js?v=c17c8abbdfaa';
import { bulkChange } from '../features/bulk/model.js?v=c17c8abbdfaa';
import { openShareNote } from '../features/sharing/share-note.js?v=c17c8abbdfaa';
import {
  tagBadges,
  categoryOptions,
  collectTagSettings,
} from '../features/notes/note-types.js?v=c17c8abbdfaa';
import {
  setupActivities,
  renderGuidedReports,
} from '../features/activities/view.js?v=c17c8abbdfaa';
import { attachGuidedPlan } from '../features/activities/model.js?v=c17c8abbdfaa';
import { setupWelcome } from '../features/onboarding/welcome.js?v=c17c8abbdfaa';
import { voice, personality, applyPersonality } from '../personalities/index.js?v=c17c8abbdfaa';
import { setupFocus } from '../features/focus/controller.js?v=c17c8abbdfaa';
import { renderFocusReports } from '../features/focus/reports.js?v=c17c8abbdfaa';
import {
  findFocusNote,
  extendFocusNote,
  attachFocusReport,
} from '../features/focus/model.js?v=c17c8abbdfaa';
import { setupMonthly } from '../features/monthly/view.js?v=c17c8abbdfaa';
import { moveToDay, quickNote } from '../features/monthly/model.js?v=c17c8abbdfaa';
import {
  dayKey,
  parseDay,
  offsetDay,
  grouped,
  dropEntry,
  timeLabel,
} from '../shared/schedule.js?v=c17c8abbdfaa';
import { load, save } from '../shared/storage.js?v=c17c8abbdfaa';
import { attachGestures } from '../features/daily/gestures.js?v=c17c8abbdfaa';
import { Reminders, resolveReminder } from '../features/reminders/reminders.js?v=c17c8abbdfaa';
import { setupAccounts } from '../features/accounts/accounts.js?v=c17c8abbdfaa';
import { dailyQuote } from '../personalities/quotes.js?v=c17c8abbdfaa';
import { createNoteEditor } from '../features/notes/note-editor.js?v=c17c8abbdfaa';
import { noteTasks } from '../features/notes/formatting/tasks.js?v=c17c8abbdfaa';
const $ = (s) => document.querySelector(s);
let monthly = null;
let expandedDay = null;
let state,
  readFailed = false,
  selected = dayKey(),
  view = 'daily',
  undo = null,
  editor = null,
  moveId = null,
  accounts = null,
  bulk = null,
  tagSettings = null,
  settingsPanel = null;
try {
  state = load();
} catch {
  readFailed = true;
  state = {
    version: 1,
    days: {},
    settings: { interval: 60, clock: '12', notifications: false, sound: false },
  };
}
const announce = (text) => {
  $('#announcer').textContent = text;
};
function toast(text, withUndo = false) {
  $('#toast-text').textContent = text;
  $('#undo').hidden = !withUndo;
  $('#toast').hidden = false;
  announce(text);
}
function persist() {
  if (readFailed) {
    $('#save-status').textContent = '● Saving paused';
    toast(
      'Stored data could not be read. Export a recovery copy or restore a valid backup before saving.',
    );
    return false;
  }
  try {
    const tags = collectTagSettings(state.settings.tags, state.days);
    if (state.settings.tags || tags.custom.length) state.settings.tags = tags;
    if (accounts) accounts.persist(state);
    else save(state);
    if (!accounts?.isSignedIn()) $('#save-status').textContent = '● Saved on this device';
    window.dispatchEvent(new Event('dayline:notes-changed'));
    return true;
  } catch {
    $('#save-status').textContent = '● Not saved';
    toast(
      'Your browser could not save this change. Download a backup in Settings to keep your notes.',
    );
    return false;
  }
}
setupPersonalityEffects();
function entries() {
  return (state.days[selected] || []).filter((note) => !note.weekly);
}
function commit(next, message) {
  undo = { date: selected, entries: structuredClone(state.days[selected] || []) };
  state.days[selected] = [...(state.days[selected] || []).filter((note) => note.weekly), ...next];
  const saved = persist();
  renderTimeline();
  toast(message, true);
  return saved;
}
function complete(id) {
  const e = entries().find((e) => e.id === id);
  if (e) {
    const saved = commit(
      entries().map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
      e.done ? 'Note reopened' : 'A little progress. Note completed.',
    );
    if (saved && !e.done)
      window.dispatchEvent(new CustomEvent('dayline:effect', { detail: { kind: 'complete' } }));
  }
}
function remove(id) {
  commit(
    entries().filter((e) => e.id !== id),
    'Note deleted',
  );
}
const reminders = new Reminders(
  () =>
    accounts?.isLoginVisible()
      ? { ...state, settings: { ...state.settings, notifications: false } }
      : state,
  (e) => toast(`It’s time · ${e.title || e.text}`),
  toast,
  openReminder,
  notificationStatus,
);
const readyReminderAudio = () => {
  if (state.settings.sound && !reminders.audioReady) reminders.unlockAudio().catch(() => {});
};
// Retry after later interactions too: audio may be suspended after switching tabs.
document.addEventListener('click', readyReminderAudio);
document.addEventListener('keydown', readyReminderAudio);
function button(text, label, fn, className = '') {
  const b = node('button', className, text);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.addEventListener('click', fn);
  return b;
}
function renderHeader() {
  renderDailyQuote();
  const d = parseDay(selected),
    today = dayKey(),
    isToday = selected === today;
  $('#relative-day').textContent = isToday
    ? voice('daily.headingToday')
    : selected === offsetDay(today, -1)
      ? voice('daily.headingPast')
      : selected === offsetDay(today, 1)
        ? voice('daily.headingFuture')
        : voice('daily.headingOther');
  $('#day-heading').textContent = `${d.toLocaleDateString(undefined, { weekday: 'long' })}, `;
  $('#day-heading').append(
    node(
      'span',
      'date-number',
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    ),
  );
  $('#footer-date').textContent = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  $('#date-picker').value = selected;
  $('#previous-label').textContent = isToday ? 'Yesterday' : 'Previous day';
  $('#next-label').textContent = isToday ? 'Tomorrow' : 'Next day';
  $('#interval-shortcut').firstChild.textContent =
    `${state.settings.interval % 60 === 0 ? `${state.settings.interval / 60}-hour` : `${state.settings.interval}-minute`} intervals `;
  $('#jump-now').hidden = !isToday;
}
function renderDailyQuote() {
  const quote = dailyQuote(new Date(), personality());
  if ($('#daily-quote').textContent !== quote) $('#daily-quote').textContent = quote;
}
function renderSummary() {
  const list = entries(),
    done = list.filter((e) => e.done).length;
  $('#summary').textContent = list.length
    ? `${done} of ${list.length} ${list.length === 1 ? 'note' : 'notes'} completed`
    : voice('daily.emptySummary');
  $('#progress').style.width = `${list.length ? (done / list.length) * 100 : 0}%`;
}
function renderTimeline() {
  $('#daily-select-controls').replaceChildren(...(bulk ? [bulk.controls()] : []));
  $('#timeline').dataset.selecting = String(!!bulk?.active);
  editor?.destroy();
  editor = null;
  renderHeader();
  renderSummary();
  const now = new Date(),
    minuteNow = now.getHours() * 60 + now.getMinutes(),
    isToday = selected === dayKey(),
    fragment = document.createDocumentFragment();
  const hours = availableHours(state.settings),
    allSlots = grouped(entries(), state.settings.interval),
    hiddenSlots = allSlots.filter(
      (slot) => !dailySlotVisible(slot.minute, state.settings.interval, hours),
    );
  let hoursControls = $('#daily-hours-controls');
  if (!hoursControls) {
    hoursControls = node('div', 'daily-hours-controls');
    hoursControls.id = 'daily-hours-controls';
    $('#daily-select-controls').after(hoursControls);
  }
  hoursControls.replaceChildren();
  hoursControls.hidden = !hiddenSlots.length;
  if (hiddenSlots.length) {
    const expanded = expandedDay === selected,
      hiddenNotes = hiddenSlots.reduce((sum, slot) => sum + slot.entries.length, 0);
    hoursControls.append(
      node(
        'span',
        'field-hint',
        expanded
          ? 'Full day shown.'
          : `${hiddenSlots.length} intervals${hiddenNotes ? ` (${hiddenNotes} ${hiddenNotes === 1 ? 'note' : 'notes'})` : ''} hidden by your Daily settings.`,
      ),
      button(
        expanded ? 'Use hidden-hours settings' : 'Show full day',
        expanded ? 'Restore hidden-hour preferences' : 'Show all time intervals for this day',
        () => {
          flushEditor();
          expandedDay = expanded ? null : selected;
          renderTimeline();
        },
        'secondary',
      ),
    );
  }
  for (const slot of allSlots.filter(
    (slot) =>
      expandedDay === selected || dailySlotVisible(slot.minute, state.settings.interval, hours),
  )) {
    const row = node('section', 'slot');
    row.dataset.minute = slot.minute;
    row.setAttribute('aria-label', timeLabel(slot.minute, state.settings.clock));
    const time = node('div', 'slot-time', timeLabel(slot.minute, state.settings.clock));
    time.append(
      node(
        'span',
        'end-time',
        `– ${timeLabel(Math.min(1440, slot.minute + state.settings.interval), state.settings.clock)}`,
      ),
    );
    if (isToday && slot.minute <= minuteNow && minuteNow < slot.minute + state.settings.interval) {
      row.classList.add('current');
      time.append(node('span', 'now-badge', 'NOW'));
    }
    const notes = node('div', 'slot-notes');
    for (const e of slot.entries) {
      const card = node('article', `entry${e.done ? ' done' : ''}`);
      card.dataset.id = e.id;
      const pick = bulk?.checkbox(selected, e);
      if (pick) card.append(pick);
      card.classList.toggle('bulk-selected', !!bulk?.isSelected(selected, e.id));
      const content = node('div', 'note-content'),
        body = node('div', 'note-body');
      const badge = tagBadges(e);
      if (badge) content.append(badge);
      content.append(
        button(
          timeLabel(e.minute, state.settings.clock),
          'Edit note time: ' + timeLabel(e.minute, state.settings.clock),
          () => openEditor(notes, slot.minute, e, true),
          'note-specific-time',
        ),
      );
      if (e.title?.trim())
        content.append(
          button(
            e.title,
            `Edit note title: ${e.title}`,
            () => openEditor(notes, slot.minute, e),
            'daily-note-title',
          ),
        );
      content.append(body);
      renderNoteLines(
        body,
        e.text,
        e.format,
        noteTasks(e),
        (start) => {
          const tasks = noteTasks(e).map((t) => (t.start === start ? { ...t, done: !t.done } : t));
          const saved = commit(
            entries().map((item) => (item.id === e.id ? { ...item, tasks, task: false } : item)),
            'Task updated',
          );
          if (saved && tasks.find((task) => task.start === start)?.done)
            window.dispatchEvent(
              new CustomEvent('dayline:effect', { detail: { kind: 'complete' } }),
            );
        },
        () => openEditor(notes, slot.minute, e),
        e.bullets,
        e.indents,
      );
      renderFocusReports(content, e.focusReports);
      renderGuidedReports(content, e.guidedActivities);
      content.append(attachmentList(e.attachments));
      bindFileDrop(card, (files) => openEditor(notes, slot.minute, e)?.attachFiles(files));
      card.append(content);
      const tools = node('div', 'entry-tools');
      tools.append(
        button(
          'Share',
          `Share note: ${e.title || e.text.split('\n')[0] || 'Untitled note'}`,
          () => openShareNote(e, selected, state.settings.clock),
          'share-note',
        ),
        button('↗', 'Reschedule note to another date or time', () => openMove(e.id), 'move-note'),
        button('×', 'Delete note', () => remove(e.id), 'delete-note'),
      );
      const handle = node('span', 'drag-handle', '⠿');
      handle.tabIndex = 0;
      handle.setAttribute('role', 'button');
      handle.setAttribute('aria-label', 'Hold and drag to move, or press Enter to choose a time');
      handle.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openMove(e.id);
        }
      });
      tools.append(handle);
      card.append(tools);
      notes.append(card);
    }
    if (!slot.entries.length)
      notes.append(
        button(
          '',
          'Add a note at ' + timeLabel(slot.minute, state.settings.clock),
          () => openEditor(notes, slot.minute),
          'empty-add',
        ),
      );
    else
      notes.append(
        button(
          '+ Add note',
          'Add another note in the ' + timeLabel(slot.minute, state.settings.clock) + ' interval',
          () => openEditor(notes, slot.minute),
          'slot-add',
        ),
      );
    row.append(time, notes);
    fragment.append(row);
  }
  $('#timeline').replaceChildren(fragment);
  // Keep most empty rows quiet; the current/first visible invitation explains the action.
  const invitation = $('#timeline .current .empty-add') || $('#timeline .empty-add');
  if (invitation) {
    invitation.append(node('span', '', '+'), document.createTextNode(voice('daily.addPrompt')));
  }
}
function openEditor(container, minute, entry, focusTime = false) {
  const slotMinute = Math.floor(minute / state.settings.interval) * state.settings.interval;
  if (editor) {
    flushEditor();
    renderTimeline();
    container = $(`#timeline .slot[data-minute="${slotMinute}"] .slot-notes`);
  }
  let id = entry?.id;
  const date = selected;
  const noteEditor = createNoteEditor({
    entry,
    categories: categoryOptions(state.days, state.settings.tags),
    minute: entry?.minute ?? minute,
    label: 'Note for ' + timeLabel(minute, state.settings.clock),
    onChange({
      title,
      text,
      format,
      tasks,
      bullets,
      indents,
      noteType,
      tags,
      attachments,
      minute: noteMinute,
    }) {
      const list = state.days[date] || [];
      undo = null;
      $('#undo').hidden = true;
      if (
        !attachments.length &&
        !text.trim() &&
        !title.trim() &&
        !list.find((e) => e.id === id)?.focusReports?.length &&
        !list.find((e) => e.id === id)?.guidedActivities?.length
      ) {
        if (id) state.days[date] = list.filter((e) => e.id !== id);
      } else if (id && list.some((e) => e.id === id)) {
        state.days[date] = list
          .map((e) =>
            e.id === id
              ? {
                  ...e,
                  title,
                  text,
                  minute: noteMinute,
                  format,
                  tasks,
                  bullets,
                  indents,
                  noteType,
                  tags,
                  attachments,
                  task: false,
                }
              : e,
          )
          .sort((a, b) => a.minute - b.minute);
      } else {
        id = crypto.randomUUID();
        state.days[date] = [
          ...list,
          {
            id,
            title,
            text,
            minute: noteMinute,
            done: false,
            format,
            tasks,
            bullets,
            indents,
            noteType,
            tags,
            attachments,
            task: false,
          },
        ].sort((a, b) => a.minute - b.minute);
      }
      if (!persist()) {
        state.days[date] = list;
        return false;
      }
      renderSummary();
      return true;
    },
    onDone: renderTimeline,
  });
  container.querySelector('.empty-add')?.remove();
  if (entry)
    container.querySelector(`[data-id="${CSS.escape(entry.id)}"]`)?.replaceWith(noteEditor.element);
  else container.insertBefore(noteEditor.element, container.querySelector('.slot-add'));
  editor = { sync: noteEditor.flush, destroy: noteEditor.destroy };
  noteEditor.focus();
  if (focusTime) noteEditor.element.querySelector('input[type=time]')?.focus();
  return noteEditor;
}
function flushEditor() {
  if (editor) {
    editor.sync();
    editor.destroy();
    editor = null;
  }
  monthly?.flushWeekly();
}
function openMove(id) {
  flushEditor();
  renderTimeline();
  const e = entries().find((e) => e.id === id);
  if (!e) return;
  moveId = { id, date: selected };
  $('#move-date').value = selected;
  $('#move-time').value =
    `${String(Math.floor(e.minute / 60)).padStart(2, '0')}:${String(e.minute % 60).padStart(2, '0')}`;
  $('#move-dialog').showModal();
}
$('#move-dialog').addEventListener('close', () => {
  if ($('#move-dialog').returnValue !== 'move' || !moveId) return;
  const source = moveId.date,
    target = $('#move-date').value,
    before = state.days;
  try {
    const next = rescheduleNote(before, source, moveId.id, target, $('#move-time').value);
    state.days = next;
    if (!persist()) {
      state.days = before;
      return;
    }
    undo = {
      days: {
        [source]: structuredClone(before[source] || []),
        [target]: structuredClone(before[target] || []),
      },
    };
    renderTimeline();
    toast(
      `Note moved to ${parseDay(target).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeLabel(next[target].find((e) => e.id === moveId.id).minute, state.settings.clock)}`,
      true,
    );
  } catch (error) {
    toast(error.message);
  } finally {
    moveId = null;
  }
});
attachGestures($('#timeline'), {
  complete,
  remove,
  move(id, minute, targetId) {
    commit(
      dropEntry(entries(), id, minute, state.settings.interval, targetId),
      targetId
        ? 'Notes swapped'
        : `Note added to ${timeLabel(minute, state.settings.clock)} interval`,
    );
  },
  announce,
});
function openReminder(target) {
  if (accounts?.isLoginVisible()) {
    toast('Continue past sign-in to open your planned note.');
    return;
  }
  flushEditor();
  focus.minimize();
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close('cancel');
  const destination = resolveReminder(state.days, target, state.settings.interval);
  selected = destination.date;
  if (
    !dailySlotVisible(destination.minute, state.settings.interval, availableHours(state.settings))
  )
    expandedDay = selected;
  switchView('daily');
  const row = $(`#timeline .slot[data-minute="${destination.minute}"]`);
  const note = destination.found
    ? row?.querySelector(`[data-id="${CSS.escape(destination.id)}"]`)
    : null;
  const destinationNode = note || row;
  destinationNode?.scrollIntoView({
    block: 'center',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
  if (destinationNode) {
    destinationNode.tabIndex = -1;
    destinationNode.focus({ preventScroll: true });
  }
  if (!destination.found)
    toast('This note is no longer available. Its original interval is shown.');
}
function navigate(date) {
  flushEditor();
  expandedDay = null;
  selected = date;
  renderTimeline();
  window.scrollTo({ top: 0 });
}
$('#previous-day').onclick = () => navigate(offsetDay(selected, -1));
$('#next-day').onclick = () => navigate(offsetDay(selected, 1));
$('#today-top').onclick = () => {
  navigate(dayKey());
  jumpNow();
};
$('#date-picker').onchange = (e) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) navigate(e.target.value);
};
function jumpNow() {
  if (!$('#timeline .current')) {
    flushEditor();
    expandedDay = selected;
    renderTimeline();
  }
  const row = $('#timeline .current');
  row?.scrollIntoView({
    block: 'center',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
$('#jump-now').onclick = jumpNow;
function switchView(next) {
  flushEditor();
  view = next;
  for (const v of ['daily', 'monthly', 'more', 'settings']) {
    $(`#${v}-view`).hidden = v !== next;
    $(`#${v}-tab`).classList.toggle('active', v === next);
    $(`#${v}-tab`).setAttribute('aria-selected', String(v === next));
  }
  if (next === 'settings') renderSettings();
  else if (next === 'monthly') monthly.show(selected);
  else if (next === 'daily') renderTimeline();
  accounts?.refreshView();
  bulk?.updateBar();
  $('#date-footer').hidden = next !== 'daily' || accounts?.isLoginVisible();
  window.scrollTo({ top: 0 });
}
monthly = setupMonthly({
  applyWeekly(week, id, action) {
    try {
      const before = state.days,
        result = changeWeekly(before, week, id, action);
      state.days = result.days;
      if (!persist()) {
        state.days = before;
        return false;
      }
      if (
        action.kind === 'complete' &&
        Object.values(result.previous).some((notes) =>
          notes.some((note) => note.id === id && !note.done),
        )
      )
        window.dispatchEvent(new CustomEvent('dayline:effect', { detail: { kind: 'complete' } }));
      if (action.kind !== 'update') {
        undo = { days: result.previous };
        toast(
          action.kind === 'schedule'
            ? 'Weekly note scheduled.'
            : action.kind === 'delete'
              ? 'Weekly note deleted.'
              : 'Weekly notes updated.',
          true,
        );
      } else {
        undo = null;
        $('#undo').hidden = true;
      }
      return result;
    } catch (error) {
      toast(error.message);
      return false;
    }
  },
  root: $('#monthly-view'),
  getState: () => state,
  announce,
  selection: {
    get active() {
      return !!bulk?.active;
    },
    controls: () => bulk?.controls(),
    checkbox: (date, entry) => bulk?.checkbox(date, entry),
    isSelected: (date, id) => !!bulk?.isSelected(date, id),
  },
  onOpen(date, id) {
    selected = date;
    const target = id ? entries().find((entry) => entry.id === id) : null;
    if (
      target &&
      !dailySlotVisible(
        Math.floor(target.minute / state.settings.interval) * state.settings.interval,
        state.settings.interval,
        availableHours(state.settings),
      )
    )
      expandedDay = selected;
    switchView('daily');
    if (id) {
      const entry = entries().find((e) => e.id === id);
      if (entry) {
        const slot = $(
          `#timeline .slot[data-minute="${Math.floor(entry.minute / state.settings.interval) * state.settings.interval}"] .slot-notes`,
        );
        openEditor(slot, entry.minute, entry);
        slot.scrollIntoView({ block: 'center' });
      }
    }
  },
  onAdd(date, title, time, tags) {
    try {
      const entry = {
          ...quickNote(title, time, crypto.randomUUID()),
          tags,
          noteType: tags[0] || '',
        },
        previous = state.days[date] || [];
      state.days[date] = [...previous, entry].sort((a, b) => a.minute - b.minute);
      if (!persist()) {
        state.days[date] = previous;
        return false;
      }
      undo = { days: { [date]: structuredClone(previous) } };
      monthly.render();
      toast('Note added. Open its title to write more.', true);
    } catch (error) {
      toast(error.message);
      return false;
    }
  },
  onMove(source, id, target) {
    try {
      const next = moveToDay(state.days, source, id, target);
      if (next === state.days) return;
      undo = {
        days: {
          [source]: structuredClone(state.days[source] || []),
          [target]: structuredClone(state.days[target] || []),
        },
      };
      state.days = next;
      persist();
      monthly.render();
      toast(
        'Note moved to ' +
          parseDay(target).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        true,
      );
    } catch (error) {
      toast(error.message);
      return false;
    }
  },
});
setupActivities({
  root: $('#more-view'),
  savePlan(report) {
    flushEditor();
    const previous = state.days;
    const result = attachGuidedPlan(previous, state.settings.interval, report);
    state.days = result.days;
    if (!persist()) {
      state.days = previous;
      return false;
    }
    undo = null;
    return result;
  },
  onSaved({ date, minute }) {
    selected = date;
    if (!dailySlotVisible(minute, state.settings.interval, availableHours(state.settings)))
      expandedDay = selected;
    switchView('daily');
    $(`#timeline .slot[data-minute="${minute}"]`)?.scrollIntoView({ block: 'center' });
  },
});
$('#more-tab').onclick = () => switchView('more');
$('#daily-tab').onclick = () => switchView('daily');
$('#monthly-tab').onclick = () => switchView('monthly');
$('#settings-tab').onclick = () => switchView('settings');
$('#interval-shortcut').onclick = () => switchView('settings');
settingsPanel = setupSettings({
  getState: () => state,
  persist,
  toast,
  getReminders: () => reminders,
  renderTags: () => tagSettings?.render(),
  onIntervalChange: () => {
    undo = null;
  },
  onHoursChange: () => {
    expandedDay = null;
  },
});
function renderSettings() {
  settingsPanel.render();
}
function notificationStatus() {
  settingsPanel?.notificationStatus();
}
$('#undo').onclick = () => {
  if (!undo) return;
  if (undo.days) Object.assign(state.days, undo.days);
  else state.days[undo.date] = undo.entries;
  if (Object.hasOwn(undo, 'settingsTags')) {
    if (undo.settingsTags === undefined) delete state.settings.tags;
    else state.settings.tags = structuredClone(undo.settingsTags);
  }
  undo = null;
  persist();
  if (view === 'monthly') monthly.render();
  else if (view === 'daily') renderTimeline();
  else if (view === 'settings') renderSettings();
  toast('Change undone.');
};
$('#dismiss-toast').onclick = () => {
  $('#toast').hidden = true;
};
const backups = setupBackups({
  getState: () => state,
  getReadFailed: () => readFailed,
  getAccounts: () => accounts,
  flushEditor,
  toast,
  onRestore(next) {
    state = next;
    readFailed = false;
    undo = null;
    renderSettings();
  },
});
window.addEventListener('pagehide', flushEditor);
window.addEventListener('storage', (event) => {
  if (event.key === 'dayline.v1' && !accounts?.isSignedIn()) {
    try {
      state = load();
      readFailed = false;
      undo = null;
      window.dispatchEvent(new Event('dayline:notes-changed'));
      if (!editor) {
        if (view === 'daily') renderTimeline();
        else if (view === 'monthly') monthly.render();
        else if (view === 'settings') renderSettings();
      }
      toast('Notes updated from another tab.');
    } catch {
      toast('Another tab saved data that could not be read.');
    }
  }
});
setInterval(() => {
  renderDailyQuote();
  if (view === 'daily' && !editor) {
    const current = $('#timeline .current'),
      now = new Date(),
      minute = now.getHours() * 60 + now.getMinutes();
    if (
      selected === dayKey() &&
      Number(current?.dataset.minute) !==
        Math.floor(minute / state.settings.interval) * state.settings.interval
    )
      renderTimeline();
  }
}, 30000);
window.addEventListener('focus', renderDailyQuote);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderDailyQuote();
});
tagSettings = setupTagSettings({
  root: $('#tag-settings'),
  getState: () => state,
  apply(result, message, undoable) {
    flushEditor();
    const before = state.days,
      beforeTags = state.settings.tags;
    state.days = result.days;
    state.settings.tags = result.config;
    if (!persist()) {
      state.days = before;
      if (beforeTags === undefined) delete state.settings.tags;
      else state.settings.tags = beforeTags;
      return false;
    }
    undo = undoable
      ? { days: structuredClone(before), settingsTags: structuredClone(beforeTags) }
      : null;
    renderSettings();
    toast(message, undoable);
    return true;
  },
});
bulk = setupBulk({
  getState: () => state,
  getView: () => view,
  flush: flushEditor,
  visible: () => !$('#planner').hidden && ['daily', 'monthly'].includes(view),
  anchor: () => (view === 'monthly' ? monthly.getMonth() + '-01' : selected),
  refresh() {
    if (view === 'daily') renderTimeline();
    else if (view === 'monthly') monthly.render();
  },
  apply(keys, action) {
    flushEditor();
    try {
      const before = state.days,
        result = bulkChange(before, keys, action);
      state.days = result.days;
      if (!persist()) {
        state.days = before;
        return false;
      }
      undo = { days: result.previous };
      toast(
        `${result.count} notes ${action.kind === 'delete' ? 'deleted' : action.kind === 'move' ? 'moved' : 'categorized'}.`,
        true,
      );
      return true;
    } catch (error) {
      toast(error.message);
      return false;
    }
  },
});
renderTimeline();
accounts = setupAccounts({
  getState: () => state,
  flushEditor,
  toast,
  downloadDeviceBackup: backups.downloadDeviceBackup,
  setState(next, options = {}) {
    const changed =
      JSON.stringify(state.days[selected] || []) !== JSON.stringify(next.days[selected] || []);
    state = next;
    readFailed = options.readFailed ?? readFailed;
    window.dispatchEvent(new Event('dayline:notes-changed'));
    if (changed) {
      undo = null;
      renderTimeline();
    }
    if (view === 'monthly') monthly.render();
    else if (!editor && view === 'daily') renderTimeline();
    if (view === 'settings') renderSettings();
    $('#restore-explanation').textContent = accounts?.isSignedIn()
      ? 'This replaces this account’s notes across devices. Download a backup first if you want to keep them.'
      : 'This replaces all notes and settings on this device. Download your current backup first if you want to keep it.';
  },
  onStatus(status, error) {
    const labels = {
      local: '● Saved on this device',
      pending: '● Saved here · waiting to sync',
      syncing: '● Syncing your notes…',
      synced: '● Synced across devices',
      error: '● Not synced · saved here',
    };
    $('#save-status').textContent = labels[status] || labels.error;
    $('#account-sync-status').textContent = error?.message || labels[status] || '';
  },
});
function refreshPlanner() {
  if (view === 'daily' && !editor) renderTimeline();
  else if (view === 'monthly') monthly.render();
}
const focusAudio = setupFocusAudio();
const focus = setupFocus({
  openAudio: () => focusAudio.open(),
  getState: () => state,
  flushEditor,
  toast,
  refresh: refreshPlanner,
  editNote(date, id, minute, values) {
    const found = findFocusNote(state.days, id, date),
      target = found?.date || date,
      previous = state.days[target] || [];
    if (!found && !values.attachments?.length && !values.title.trim() && !values.text.trim())
      return null;
    const entry = {
      ...(found?.entry || { id: crypto.randomUUID(), minute, done: false }),
      ...values,
      task: false,
    };
    state.days[target] = (
      found ? previous.map((e) => (e.id === entry.id ? entry : e)) : [...previous, entry]
    ).sort((a, b) => a.minute - b.minute);
    if (!persist()) {
      state.days[target] = previous;
      return null;
    }
    undo = null;
    refreshPlanner();
    return { id: entry.id };
  },
  checkTask(date, id, start) {
    const found = findFocusNote(state.days, id, date);
    if (!found) return;
    const tasks = noteTasks(found.entry).map((t) =>
      t.start === start ? { ...t, done: !t.done } : t,
    );
    const previous = state.days[found.date];
    state.days[found.date] = previous.map((e) => (e.id === id ? { ...e, tasks, task: false } : e));
    if (!persist()) state.days[found.date] = previous;
    else {
      undo = null;
      refreshPlanner();
      if (tasks.find((task) => task.start === start)?.done)
        window.dispatchEvent(new CustomEvent('dayline:effect', { detail: { kind: 'complete' } }));
    }
  },
  extendNote(id, source, target, minute, interval) {
    try {
      const previous = state.days;
      state.days = extendFocusNote(state.days, id, source, target, minute, interval);
      if (!persist()) {
        state.days = previous;
        return false;
      }
      undo = null;
      return true;
    } catch (error) {
      toast(error.message);
      return false;
    }
  },
  saveReport(session) {
    const previous = state.days;
    state.days = attachFocusReport(state.days, session);
    if (!persist()) {
      state.days = previous;
      return false;
    }
    undo = null;
    return true;
  },
});
if (readFailed)
  toast(
    'Stored data could not be read. Saving is paused to protect it. Open Settings to export a recovery copy or restore a backup.',
  );

applyPersonality();
window.addEventListener('dayline:appearance', () => {
  applyPersonality();
  if (view === 'daily' && !editor) renderTimeline();
  else {
    renderHeader();
    renderSummary();
  }
  if (view === 'monthly') monthly.show(selected);
});

setupWelcome({
  getState: () => state,
  canOpen: () =>
    !!accounts && !accounts.isLoginVisible() && $('#auth-view').hidden && !$('#planner').hidden,
  showDaily: () => switchView('daily'),
  toast,
  saveInterval(interval) {
    flushEditor();
    const previous = state.settings.interval;
    state.settings.interval = interval;
    if (!persist()) {
      state.settings.interval = previous;
      return false;
    }
    undo = null;
    renderSettings();
    if (view === 'daily') renderTimeline();
    else if (view === 'monthly') monthly.render();
    return true;
  },
});
