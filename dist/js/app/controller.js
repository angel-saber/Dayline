import { bindPreciseTime } from '../features/daily/precise-time.js?v=acdad351dbea';
import { setupActivityFavorites } from '../features/activity-favorites/controller.js?v=acdad351dbea';
import { setupYearly } from '../features/yearly/view.js?v=acdad351dbea';
import {
  writeYearly,
  planNextStep,
  carryIntentions,
} from '../features/yearly/model.js?v=acdad351dbea';
import {
  setupSummarySettings,
  SUMMARY_PREFERENCES_EVENT,
} from '../features/summaries/preferences.js?v=acdad351dbea';
import { summarySource, summarizePeriod } from '../features/summaries/model.js?v=acdad351dbea';
import { createPeriodSummary } from '../features/summaries/view.js?v=acdad351dbea';
import {
  changeRepeatNotes,
  rescheduleRepeatNotes,
} from '../features/repeating/series.js?v=acdad351dbea';
import { chooseRepeatScope } from '../features/repeating/scope.js?v=acdad351dbea';
import { createRepeatCycle } from '../features/repeating/model.js?v=acdad351dbea';
import { openRepeatCycle } from '../features/repeating/view.js?v=acdad351dbea';
import { setupVisualizations } from '../features/visualization/controller.js?v=acdad351dbea';
import { canKeepEditor } from '../features/notes/editor-sync.js?v=acdad351dbea';
import { setupInspiration } from '../features/inspiration/view.js?v=acdad351dbea';
import { storyNote } from '../features/inspiration/model.js?v=acdad351dbea';
import { setupShortcuts } from '../features/shortcuts/controller.js?v=acdad351dbea';
import { duplicateNote as copyNote } from '../features/notes/duplicate.js?v=acdad351dbea';
import { setupFocusAudio } from '../features/focus-audio/controller.js?v=acdad351dbea';
import { setupPersonalityEffects } from '../personalities/effects.js?v=acdad351dbea';
import { node } from '../shared/dom.js?v=acdad351dbea';
import { setupBackups } from '../features/settings/backups.js?v=acdad351dbea';
import { setupSettings } from '../features/settings/controller.js?v=acdad351dbea';
import { renderNoteLines } from '../features/notes/render.js?v=acdad351dbea';
import { rescheduleNote } from '../features/daily/reschedule.js?v=acdad351dbea';
import { changeWeekly } from '../features/monthly/weekly-model.js?v=acdad351dbea';
import {
  availableHours,
  dailySlotVisible,
} from '../features/settings/available-hours.js?v=acdad351dbea';
import {
  attachmentList,
  bindFileDrop,
} from '../features/attachments/attachments.js?v=acdad351dbea';
import { setupTagSettings } from '../features/notes/tag-settings.js?v=acdad351dbea';
import { setupBulk } from '../features/bulk/view.js?v=acdad351dbea';
import { bulkChange } from '../features/bulk/model.js?v=acdad351dbea';
import { openShareNote } from '../features/sharing/share-note.js?v=acdad351dbea';
import {
  tagBadges,
  categoryOptions,
  collectTagSettings,
} from '../features/notes/note-types.js?v=acdad351dbea';
import {
  setupActivities,
  renderGuidedReports,
} from '../features/activities/view.js?v=acdad351dbea';
import { attachGuidedPlan } from '../features/activities/model.js?v=acdad351dbea';
import { setupWelcome } from '../features/onboarding/welcome.js?v=acdad351dbea';
import { voice, personality, applyPersonality } from '../personalities/index.js?v=acdad351dbea';
import { setupFocus } from '../features/focus/controller.js?v=acdad351dbea';
import { renderFocusReports } from '../features/focus/reports.js?v=acdad351dbea';
import {
  findFocusNote,
  extendFocusNote,
  attachFocusReport,
} from '../features/focus/model.js?v=acdad351dbea';
import { setupMonthly } from '../features/monthly/view.js?v=acdad351dbea';
import { moveToDay, quickNotes } from '../features/monthly/model.js?v=acdad351dbea';
import {
  dayKey,
  parseDay,
  offsetDay,
  grouped,
  dropEntry,
  timeLabel,
} from '../shared/schedule.js?v=acdad351dbea';
import { load, save } from '../shared/storage.js?v=acdad351dbea';
import { attachGestures } from '../features/daily/gestures.js?v=acdad351dbea';
import { Reminders, resolveReminder } from '../features/reminders/reminders.js?v=acdad351dbea';
import { setupAccounts } from '../features/accounts/accounts.js?v=acdad351dbea';
import { dailyQuote } from '../personalities/quotes.js?v=acdad351dbea';
import { createNoteEditor } from '../features/notes/note-editor.js?v=acdad351dbea';
import { noteTasks } from '../features/notes/formatting/tasks.js?v=acdad351dbea';
const $ = (s) => document.querySelector(s);
let monthly = null;
let yearly = null;
let dailyPeriodSummary = null;
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
  return (state.days[selected] || []).filter((note) => !note.weekly && !note.yearly);
}
function commit(next, message) {
  undo = { date: selected, entries: structuredClone(state.days[selected] || []) };
  state.days[selected] = [
    ...(state.days[selected] || []).filter((note) => note.weekly || note.yearly),
    ...next,
  ];
  const saved = persist();
  renderTimeline();
  toast(message, true);
  return saved;
}
function duplicate(date, id) {
  flushEditor();
  const before = state.days[date] || [];
  try {
    const result = copyNote(before, id);
    state.days[date] = result.notes;
    if (!persist()) {
      state.days[date] = before;
      return false;
    }
    undo = { days: { [date]: structuredClone(before) } };
    renderTimeline();
    if (view === 'monthly') monthly.render();
    toast('Note duplicated. Completion and reports start fresh.', true);
    return result.id;
  } catch (error) {
    toast(error.message);
    return false;
  }
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
function deleteNoteAt(date, id, scope = null) {
  const entry = (state.days[date] || []).find((note) => note.id === id);
  if (!entry) return false;
  if (entry.repeat && !scope) {
    chooseRepeatScope('Delete', (choice) => deleteNoteAt(date, id, choice));
    return true;
  }
  const before = state.days;
  const result = changeRepeatNotes(before, date, id, { kind: 'delete' }, scope || 'one');
  state.days = result.days;
  if (!persist()) {
    state.days = before;
    return false;
  }
  undo = { days: result.previous };
  if (view === 'monthly') monthly.render();
  else if (view === 'daily') renderTimeline();
  toast(result.count > 1 ? `${result.count} repeat notes deleted.` : 'Note deleted.', true);
  return true;
}
function moveWithinDay(date, id, minute, targetId = null, scope = null) {
  const previous = state.days[date] || [];
  const entry = previous.find((note) => note.id === id && !note.weekly && !note.yearly);
  if (!entry) return false;
  if (entry.repeat && !scope) {
    chooseRepeatScope('Reschedule', (choice) => moveWithinDay(date, id, minute, targetId, choice));
    return true;
  }
  const daily = previous.filter((note) => !note.weekly && !note.yearly);
  const moved = dropEntry(
    daily,
    id,
    minute,
    state.settings.interval,
    scope === 'following' ? null : targetId,
  );
  if (moved === daily) return true;
  const before = state.days;
  const series =
    entry.repeat && scope === 'following'
      ? changeRepeatNotes(
          before,
          date,
          id,
          { kind: 'edit', values: { minute: moved.find((note) => note.id === id).minute } },
          'following',
        )
      : null;
  state.days = series?.days || {
    ...before,
    [date]: [...previous.filter((note) => note.weekly || note.yearly), ...moved],
  };
  if (!persist()) {
    state.days = before;
    return false;
  }
  undo = { days: series?.previous || { [date]: structuredClone(previous) } };
  if (view === 'monthly') monthly.render();
  else if (view === 'daily') renderTimeline();
  toast('Note schedule updated.', true);
  return true;
}
function remove(id) {
  deleteNoteAt(selected, id);
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
function refreshDailyPeriodSummary() {
  const host = $('#daily-period-summary');
  if (!host) return;
  if (!dailyPeriodSummary) {
    dailyPeriodSummary = createPeriodSummary('Day');
    host.append(dailyPeriodSummary.element);
  }
  dailyPeriodSummary.update(summarizePeriod(summarySource(state.days), selected, selected));
}
window.addEventListener('dayline:notes-changed', refreshDailyPeriodSummary);
window.addEventListener(SUMMARY_PREFERENCES_EVENT, refreshDailyPeriodSummary);
function renderSummary() {
  refreshDailyPeriodSummary();
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
    const time = node('button', 'slot-time');
    time.type = 'button';
    time.setAttribute(
      'aria-label',
      'Add a note in the ' + timeLabel(slot.minute, state.settings.clock) + ' interval',
    );
    time.title =
      'Click between the start and end times to choose a precise note time. Keyboard activation starts at the beginning of the interval.';
    time.append(node('span', 'slot-start', timeLabel(slot.minute, state.settings.clock)));
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
    const precise = bindPreciseTime({
      row,
      time,
      notes,
      start: slot.minute,
      interval: state.settings.interval,
      clock: state.settings.clock,
      isSelecting: () => !!bulk?.active,
      onAdd: (minute) => openEditor(notes, minute),
    });
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
      if (e.yearlySource)
        content.append(
          button(
            'Yearly intention',
            'Return to the Yearly intention',
            () => {
              switchView('yearly');
              yearly.show(e.yearlySource);
            },
            'note-yearly-link',
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
        button('Duplicate', 'Duplicate note', () => duplicate(selected, e.id), 'duplicate-note'),
        button('Repeat', 'Repeat note', () => beginRepeat(selected, e.id), 'repeat-note'),
        button(
          'Reschedule',
          'Reschedule note to another date or time',
          () => openMove(e.id),
          'move-note',
        ),
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
          precise.add,
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
function beginRepeat(source, id) {
  flushEditor();
  renderTimeline();
  const note = (state.days[source] || []).find(
    (entry) => entry.id === id && !entry.weekly && !entry.yearly,
  );
  if (!note) {
    toast('Write and save a note before creating a repeat cycle.');
    return;
  }
  openRepeatCycle({
    source,
    note,
    apply(rule) {
      const before = state.days;
      const result = createRepeatCycle(before, source, id, rule);
      state.days = result.days;
      if (!persist()) {
        state.days = before;
        return false;
      }
      undo = { days: result.previous };
      renderTimeline();
      if (view === 'monthly') monthly.render();
      toast(`${result.count} repeating notes added through ${result.end}.`, true);
      return true;
    },
  });
}
function openEditor(container, minute, entry, focusTime = false, repeatScope = null) {
  if (entry?.repeat && !repeatScope) {
    chooseRepeatScope('Edit', (choice) => {
      const fresh = (state.days[selected] || []).find((note) => note.id === entry.id);
      if (!fresh) {
        toast('This note is no longer available.');
        return;
      }
      const slot = $(
        `#timeline .slot[data-minute="${Math.floor(fresh.minute / state.settings.interval) * state.settings.interval}"] .slot-notes`,
      );
      if (slot) openEditor(slot, fresh.minute, fresh, focusTime, choice);
    });
    return;
  }
  const slotMinute = Math.floor(minute / state.settings.interval) * state.settings.interval;
  if (editor) {
    flushEditor();
    renderTimeline();
    container = $(`#timeline .slot[data-minute="${slotMinute}"] .slot-notes`);
  }
  let id = entry?.id;
  const date = selected;
  const seriesPrevious = {};
  let seriesChanged = false;
  function finalizeSeriesEdit() {
    if (seriesChanged) {
      undo = { days: seriesPrevious };
      toast('Repeat notes updated.', true);
      seriesChanged = false;
    }
  }
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
      const existing = list.find((note) => note.id === id);
      if (existing?.repeat) {
        const before = state.days;
        const result = changeRepeatNotes(
          before,
          date,
          id,
          {
            kind: 'edit',
            values: {
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
              task: false,
            },
          },
          repeatScope || 'one',
        );
        state.days = result.days;
        if (!persist()) {
          state.days = before;
          return false;
        }
        for (const [key, notes] of Object.entries(result.previous)) seriesPrevious[key] ??= notes;
        seriesChanged = true;
        undo = null;
        $('#undo').hidden = true;
        renderSummary();
        return true;
      }
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
    onDuplicate: () => id && duplicate(date, id),
    onRepeat: () => {
      noteEditor.flush();
      if (id) beginRepeat(date, id);
      else toast('Add a title, text, or attachment before repeating this note.');
    },
    onDone: () => {
      finalizeSeriesEdit();
      renderTimeline();
    },
  });
  container.querySelector('.empty-add')?.remove();
  if (entry)
    container.querySelector(`[data-id="${CSS.escape(entry.id)}"]`)?.replaceWith(noteEditor.element);
  else container.insertBefore(noteEditor.element, container.querySelector('.slot-add'));
  editor = {
    sync: noteEditor.flush,
    destroy: noteEditor.destroy,
    getId: () => id,
    finalize: finalizeSeriesEdit,
  };
  noteEditor.focus();
  if (focusTime) noteEditor.element.querySelector('input[type=time]')?.focus();
  return noteEditor;
}
function flushEditor() {
  if (editor) {
    editor.sync();
    editor.finalize?.();
    editor.destroy();
    editor = null;
  }
  monthly?.flushWeekly();
}
function openMove(id, scope = null) {
  const current = entries().find((note) => note.id === id);
  if (current?.repeat && !scope) {
    chooseRepeatScope('Reschedule', (choice) => openMove(id, choice));
    return;
  }
  flushEditor();
  renderTimeline();
  const e = entries().find((e) => e.id === id);
  if (!e) return;
  moveId = { id, date: selected, scope: scope || 'one' };
  $('#move-date').value = selected;
  $('#move-time').value =
    `${String(Math.floor(e.minute / 60)).padStart(2, '0')}:${String(e.minute % 60).padStart(2, '0')}`;
  $('#move-dialog').returnValue = '';
  $('#move-dialog').showModal();
}
$('#move-dialog').addEventListener('close', () => {
  if ($('#move-dialog').returnValue !== 'move' || !moveId) return;
  const source = moveId.date,
    target = $('#move-date').value,
    before = state.days;
  try {
    const repeat = (before[source] || []).find((note) => note.id === moveId.id)?.repeat;
    const series = repeat
      ? rescheduleRepeatNotes(
          before,
          source,
          moveId.id,
          target,
          $('#move-time').value,
          moveId.scope,
        )
      : null;
    const next =
      series?.days || rescheduleNote(before, source, moveId.id, target, $('#move-time').value);
    state.days = next;
    if (!persist()) {
      state.days = before;
      return;
    }
    undo = {
      days: series?.previous || {
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
    moveWithinDay(selected, id, minute, targetId);
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
  for (const v of ['daily', 'monthly', 'yearly', 'more', 'settings']) {
    $(`#${v}-view`).hidden = v !== next;
    $(`#${v}-tab`).classList.toggle('active', v === next);
    $(`#${v}-tab`).setAttribute('aria-selected', String(v === next));
  }
  if (next === 'settings') renderSettings();
  else if (next === 'monthly') monthly.show(selected);
  else if (next === 'daily') renderTimeline();
  else if (next === 'yearly') yearly.show();
  accounts?.refreshView();
  bulk?.updateBar();
  $('#date-footer').hidden = next !== 'daily' || accounts?.isLoginVisible();
  window.scrollTo({ top: 0 });
}
monthly = setupMonthly({
  onDelete: deleteNoteAt,
  onIntervalMove: (date, id, minute) => moveWithinDay(date, id, minute),
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
  onAdd(date, drafts) {
    const hadDay = Object.hasOwn(state.days, date),
      previous = state.days[date] || [],
      previousSettings = state.settings;
    function rollback() {
      if (hadDay) state.days[date] = previous;
      else delete state.days[date];
      state.settings = previousSettings;
    }
    try {
      const entries = quickNotes(
        drafts,
        () => crypto.randomUUID(),
        previous.map((note) => note.id),
      );
      state.days[date] = [...previous, ...entries].sort((a, b) => a.minute - b.minute);
      state.settings = { ...previousSettings };
      if (!persist()) {
        rollback();
        return false;
      }
      undo = { days: { [date]: structuredClone(previous) } };
      toast(entries.length === 1 ? 'Note added.' : `${entries.length} notes added.`, true);
      return true;
    } catch (error) {
      rollback();
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
const activityFavorites = setupActivityFavorites({ root: $('#planner'), toast });
const activities = setupActivities({
  favorites: activityFavorites,
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
const inspirationLibrary = setupInspiration({
  root: $('#more-view'),
  saveStory(story) {
    flushEditor();
    const now = new Date(),
      date = dayKey(now),
      minute = now.getHours() * 60 + now.getMinutes();
    const before = state.days[date] || [];
    const note = { id: crypto.randomUUID(), minute, done: false, task: false, ...storyNote(story) };
    state.days[date] = [...before, note].sort((a, b) => a.minute - b.minute);
    if (!persist()) {
      state.days[date] = before;
      return false;
    }
    undo = { days: { [date]: structuredClone(before) } };
    const focusWindow = document.querySelector('.focus-window');
    if (focusWindow?.open) {
      const section = focusWindow.querySelector('.focus-inspiration')?.closest('.focus-section');
      let status = section?.querySelector('.inspiration-save-status');
      if (section && !status) {
        status = node('p', 'field-hint inspiration-save-status');
        status.setAttribute('role', 'status');
        section.append(status);
      }
      if (status) status.textContent = 'Story saved as a new Daily note.';
    } else {
      selected = date;
      if (!dailySlotVisible(minute, state.settings.interval, availableHours(state.settings)))
        expandedDay = date;
      switchView('daily');
      const interval = Math.floor(minute / state.settings.interval) * state.settings.interval;
      $(`#timeline .slot[data-minute="${interval}"]`)?.scrollIntoView({ block: 'center' });
    }
    toast('Story saved as a new Daily note.', true);
    return true;
  },
});
yearly = setupYearly({
  root: $('#yearly-view'),
  getState: () => state,
  toast,
  saveRecord(record) {
    const before = state.days;
    const result = writeYearly(before, record);
    state.days = result.days;
    if (!persist()) {
      state.days = before;
      return false;
    }
    undo = null;
    $('#undo').hidden = true;
    return result;
  },
  planStep(record, draft) {
    const before = state.days,
      result = planNextStep(before, record, draft);
    state.days = result.days;
    if (!persist()) {
      state.days = before;
      return false;
    }
    undo = { days: { [result.date]: structuredClone(before[result.date] || []) } };
    toast('Next step added. Its date is yours to change.', true);
    return result;
  },
  carry(year, ids) {
    const before = state.days;
    state.days = carryIntentions(before, year, ids);
    if (!persist()) {
      state.days = before;
      return false;
    }
    undo = null;
    $('#undo').hidden = true;
    return true;
  },
  openNote(date, entry) {
    selected = date;
    if (entry.weekly) {
      switchView('monthly');
      return;
    }
    expandedDay = date;
    switchView('daily');
    const minute = Math.floor(entry.minute / state.settings.interval) * state.settings.interval;
    const slot = $(`#timeline .slot[data-minute="${minute}"] .slot-notes`);
    if (slot) {
      openEditor(slot, minute, entry);
      slot.scrollIntoView({ block: 'center' });
    }
  },
  openCompass(source) {
    switchView('more');
    activities.openCompass(source);
  },
});
$('#yearly-tab').onclick = () => switchView('yearly');
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
        else if (view === 'monthly') monthly.refreshFromSync();
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
  preserveDailyEditor: () => view === 'daily' && !!editor,
  toast,
  downloadDeviceBackup: backups.downloadDeviceBackup,
  setState(next, options = {}) {
    const monthlyChanged =
      JSON.stringify(state.days) !== JSON.stringify(next.days) ||
      JSON.stringify(state.settings) !== JSON.stringify(next.settings);
    const changed =
      JSON.stringify(state.days[selected] || []) !== JSON.stringify(next.days[selected] || []);
    // Keep a live editor only when its note was not changed by another device.
    // The refreshed day will be drawn when the editor is closed.
    const editingId = editor?.getId();
    const preserveEditor = !!editor && canKeepEditor(state.days, next.days, selected, editingId);
    state = next;
    readFailed = options.readFailed ?? readFailed;
    window.dispatchEvent(new Event('dayline:notes-changed'));
    if (changed) {
      undo = null;
      if (!preserveEditor) renderTimeline();
    }
    if (view === 'monthly' && monthlyChanged) monthly.refreshFromSync();
    else if (view === 'daily' && !editor) renderTimeline();
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
const shortcuts = setupShortcuts();
const focusAudio = setupFocusAudio();
const focus = setupFocus({
  duplicateNote: duplicate,
  openAudio: () => focusAudio.open(),
  openShortcuts: () => shortcuts.open(),
  openInspiration: () => inspirationLibrary.open(),
  getState: () => state,
  flushEditor,
  toast,
  refresh: refreshPlanner,
  editNote(date, id, minute, values, repeatScope = 'one') {
    const found = findFocusNote(state.days, id, date),
      target = found?.date || date,
      previous = state.days[target] || [];
    if (!found && !values.attachments?.length && !values.title.trim() && !values.text.trim())
      return null;
    if (found?.entry.repeat) {
      const before = state.days;
      const result = changeRepeatNotes(
        before,
        target,
        id,
        { kind: 'edit', values: { ...values, task: false } },
        repeatScope || 'one',
      );
      state.days = result.days;
      if (!persist()) {
        state.days = before;
        return null;
      }
      undo = { days: result.previous };
      refreshPlanner();
      return { id };
    }
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

setupVisualizations({
  favorites: activityFavorites,
  root: $('#more-view'),
  settings: $('#settings-view'),
  toast,
  canInvite: () => {
    const mini = document.querySelector('.focus-mini');
    return (
      !!accounts &&
      !accounts.isLoginVisible() &&
      !$('#planner').hidden &&
      !editor &&
      !document.querySelector('.editor') &&
      !document.querySelector('dialog[open]') &&
      (!mini || mini.hidden)
    );
  },
  saveAction(exercise, action) {
    const now = new Date(),
      date = dayKey(now),
      minute = now.getHours() * 60 + now.getMinutes();
    const before = state.days;
    const previous = before[date] || [];
    const note = {
      id: crypto.randomUUID(),
      minute,
      done: false,
      task: false,
      title: 'Visualization · ' + exercise.title,
      text: exercise.guidance + '\n\n' + exercise.prompt + '\n\nMy next action: ' + action,
    };
    state.days = { ...before, [date]: [...previous, note].sort((a, b) => a.minute - b.minute) };
    if (!persist()) {
      state.days = before;
      return false;
    }
    undo = { days: { [date]: structuredClone(previous) } };
    refreshPlanner();
    toast('Visualization action saved to Daily.', true);
    return true;
  },
});

setupSummarySettings({ root: $('#settings-view'), toast });
