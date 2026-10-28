import { node } from '../../shared/dom.js?v=dc42e2a6f2c9';
import { availableHours, hourInput } from '../settings/available-hours.js?v=dc42e2a6f2c9';
import { dayKey, parseDay, timeLabel } from '../../shared/schedule.js?v=dc42e2a6f2c9';
import { scopeRange } from '../bulk/model.js?v=dc42e2a6f2c9';
import {
  emptyIntervals,
  availabilityText,
  mergeAvailability,
  validTimeZone,
} from './availability-model.js?v=dc42e2a6f2c9';
import { emailNoteUrl } from './share-note.js?v=dc42e2a6f2c9';

const button = (text, fn, cls = 'secondary') => {
  const el = node('button', cls, text);
  el.type = 'button';
  el.onclick = fn;
  return el;
};
export function openAvailability(api) {
  api.flush();
  const dialog = node('dialog', 'availability-dialog'),
    heading = node('h2', '', 'Share availability');
  heading.id = 'availability-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  const savedHours = availableHours(api.getState().settings);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    anchor = api.anchor(),
    clock = api.getState().settings.clock;
  const settings = node('div', 'availability-settings'),
    status = node('p', 'field-hint'),
    results = node('section'),
    preview = node('textarea', 'share-note-preview');
  status.setAttribute('role', 'status');
  preview.readOnly = true;
  preview.rows = 10;
  preview.setAttribute('aria-label', 'Availability share preview');
  let candidates = [],
    selected = new Set(),
    reviewed = null,
    expiryTimer = null;
  function field(text, input) {
    const label = node('label', '', text);
    label.append(input);
    settings.append(label);
    return input;
  }
  const scope = field('Date range', node('select'));
  for (const [key, label] of [
    ['today', 'Today'],
    ['day', 'Selected day'],
    ['week', 'Week of selected date'],
    ['month', 'Month of selected date'],
    ['custom', 'Custom dates'],
  ]) {
    const option = node('option', '', label);
    option.value = key;
    scope.append(option);
  }
  scope.value = api.getView() === 'monthly' ? 'month' : 'day';
  const start = field('From date', node('input')),
    end = field('Through date', node('input'));
  for (const input of [start, end]) {
    input.type = 'date';
    input.required = true;
  }
  function setDates() {
    if (scope.value === 'custom') return;
    const range =
      scope.value === 'today' ? scopeRange(dayKey(), 'day') : scopeRange(anchor, scope.value);
    start.value = range.start;
    end.value = range.end;
  }
  setDates();
  const from = field('Available from', node('input')),
    to = field('Available until', node('input'));
  from.type = to.type = 'time';
  from.required = to.required = true;
  from.value = hourInput(savedHours.from);
  to.value = hourInput(savedHours.to);
  const allDay = node('label', 'availability-all-day'),
    allDayCheck = node('input');
  allDayCheck.type = 'checkbox';
  allDayCheck.checked = savedHours.from === 0 && savedHours.to === 1440;
  from.disabled = to.disabled = allDayCheck.checked;
  allDay.append(allDayCheck, document.createTextNode('All day (midnight to midnight)'));
  settings.append(allDay);
  const weekdays = node('fieldset', 'availability-weekdays');
  weekdays.append(node('legend', '', 'Days to include'));
  const dayChecks = [];
  for (const [day, text] of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].entries()) {
    const label = node('label'),
      check = node('input');
    check.type = 'checkbox';
    check.checked = day > 0 && day < 6;
    check.value = day;
    label.append(check, document.createTextNode(text));
    weekdays.append(label);
    dayChecks.push(check);
  }
  const zoneInput = field('Show shared times in this time zone', node('input'));
  zoneInput.type = 'text';
  zoneInput.value = zone;
  zoneInput.setAttribute('list', 'availability-zones');
  zoneInput.setAttribute('aria-label', 'Availability display time zone');
  const zones = node('datalist');
  zones.id = 'availability-zones';
  const availableZones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Manila'];
  for (const value of new Set([zone, 'UTC', ...availableZones])) {
    const option = node('option');
    option.value = value;
    zones.append(option);
  }
  const localHint = node(
    'p',
    'field-hint',
    `Hours start with your Settings preferences and can be edited for this share without changing Settings. Available hours and note occupancy use your device’s time zone (${zone}). The preview converts them to your chosen display zone. Only future, whole empty intervals inside these hours are included; intervals that have already started are excluded; an end time of 00:00 means midnight at the end of the day. Up to 31 days.`,
  );
  function options() {
    const minutes = (input) => {
      if (!input.value) return NaN;
      const [h, m] = input.value.split(':').map(Number);
      return h * 60 + m;
    };
    return {
      start: start.value,
      end: end.value,
      from: allDayCheck.checked ? 0 : minutes(from),
      to: allDayCheck.checked || minutes(to) === 0 ? 1440 : minutes(to),
      weekdays: dayChecks.filter((input) => input.checked).map((input) => Number(input.value)),
      interval: api.getState().settings.interval,
    };
  }
  const share = button(
    'Share…',
    async () => {
      try {
        const text = refreshPreview();
        if (!text) return;
        await navigator.share({ title: 'My availability', text });
        status.textContent = 'Shared.';
      } catch (error) {
        status.textContent =
          error.name === 'AbortError'
            ? 'Sharing cancelled.'
            : 'Sharing is unavailable. Use Copy text or Email.';
      }
    },
    'primary',
  );
  const copy = button('Copy text', async () => {
    const text = refreshPreview();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Availability copied.';
    } catch {
      preview.focus();
      preview.select();
      status.textContent = 'Copy the selected preview using your device’s Copy command.';
    }
  });
  const email = node('a', 'secondary', 'Email');
  email.onclick = (event) => {
    if (!refreshPreview()) {
      event.preventDefault();
      return;
    }
    email.href = emailNoteUrl('My availability', preview.value);
  };
  function refreshPreview() {
    try {
      if (!reviewed || JSON.stringify(reviewed) !== JSON.stringify(options()))
        throw new Error('Review empty intervals after changing dates, days, or hours.');
      // Revalidate on every action, so notes added since review cannot expose stale availability.
      const now = Date.now();
      candidates = emptyIntervals(api.getState().days, reviewed, now);
      const available = new Set(candidates.map((slot) => slot.key));
      selected = new Set([...selected].filter((key) => available.has(key)));
      const text = availabilityText(candidates, selected, {
        timeZone: zoneInput.value.trim(),
        clock,
        now,
      });
      preview.value = text;
      scheduleExpiry();
      const count = selected.size;
      share.disabled = !count || typeof navigator.share !== 'function';
      copy.disabled = !count;
      email.hidden = !count;
      status.textContent = count
        ? `${count} empty intervals selected · ${mergeAvailability(candidates, selected).length} time ranges. No note contents are shared.`
        : 'No future intervals selected. Adjust your dates, days, or hours, or choose some empty intervals.';
      return text;
    } catch (error) {
      clearTimeout(expiryTimer);
      preview.value = '';
      share.disabled = copy.disabled = true;
      email.hidden = true;
      status.textContent = error.message;
      return '';
    }
  }
  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    const next = candidates[0]?.startAt;
    if (next)
      expiryTimer = setTimeout(
        () => {
          if (reviewed) {
            refreshPreview();
            renderResults();
          }
        },
        Math.min(2147483647, Math.max(1, next - Date.now())),
      );
  }
  function renderResults() {
    const openDays = new Set(
      [...results.querySelectorAll('details[open]')].map((day) => day.dataset.date),
    );
    results.replaceChildren(node('h3', '', 'Choose empty intervals'));
    const actions = node('div', 'inline');
    actions.append(
      button('Select all empty', () => {
        selected = new Set(candidates.map((slot) => slot.key));
        renderResults();
      }),
      button('Clear selection', () => {
        selected.clear();
        renderResults();
      }),
    );
    results.append(actions);
    const groups = new Map();
    for (const slot of candidates) {
      if (!groups.has(slot.date)) groups.set(slot.date, []);
      groups.get(slot.date).push(slot);
    }
    for (const [date, slots] of groups) {
      const details = node('details', 'availability-day'),
        summary = node('summary'),
        choices = node('div', 'availability-slots');
      details.dataset.date = date;
      details.open = openDays.has(date);
      function labelSummary() {
        summary.textContent = `${parseDay(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${slots.filter((slot) => selected.has(slot.key)).length}/${slots.length} selected`;
      }
      function populate() {
        choices.replaceChildren();
        const tools = node('div', 'inline');
        tools.append(
          button('Select day', () => {
            for (const slot of slots) selected.add(slot.key);
            populate();
            labelSummary();
            refreshPreview();
          }),
          button('Clear day', () => {
            for (const slot of slots) selected.delete(slot.key);
            populate();
            labelSummary();
            refreshPreview();
          }),
        );
        choices.append(tools);
        for (const slot of slots) {
          const label = node('label'),
            check = node('input');
          check.type = 'checkbox';
          check.checked = selected.has(slot.key);
          check.onchange = () => {
            if (check.checked) selected.add(slot.key);
            else selected.delete(slot.key);
            labelSummary();
            refreshPreview();
          };
          label.append(
            check,
            document.createTextNode(
              `${timeLabel(slot.minute, clock)} – ${timeLabel(slot.endMinute, clock)}`,
            ),
          );
          choices.append(label);
        }
      }
      details.addEventListener('toggle', () => {
        if (details.open) populate();
        else choices.replaceChildren();
      });
      labelSummary();
      details.append(summary, choices);
      results.append(details);
    }
    refreshPreview();
  }
  function invalidate() {
    reviewed = null;
    candidates = [];
    selected.clear();
    results.replaceChildren();
    refreshPreview();
  }
  scope.onchange = () => {
    setDates();
    invalidate();
  };
  for (const input of [start, end])
    input.onchange = () => {
      scope.value = 'custom';
      invalidate();
    };
  for (const input of [from, to, ...dayChecks]) input.onchange = invalidate;
  allDayCheck.onchange = () => {
    from.disabled = to.disabled = allDayCheck.checked;
    invalidate();
  };
  zoneInput.onchange = refreshPreview;
  const review = button(
    'Review empty intervals',
    () => {
      try {
        if (!validTimeZone(zoneInput.value.trim()))
          throw new Error('Choose a valid display time zone.');
        reviewed = options();
        candidates = emptyIntervals(api.getState().days, reviewed);
        selected = new Set(candidates.map((slot) => slot.key));
        renderResults();
      } catch (error) {
        reviewed = null;
        refreshPreview();
        status.textContent = error.message;
      }
    },
    'primary',
  );
  dialog.append(
    heading,
    node(
      'p',
      'field-hint',
      'Share open time without sharing your notes. Any note makes its entire interval occupied, including completed notes and notes with only attachments.',
    ),
    settings,
    zones,
    weekdays,
    localHint,
    review,
    results,
    node('h3', '', 'Preview'),
    preview,
    node('div', 'availability-share-actions'),
    status,
  );
  dialog.querySelector('.availability-share-actions').append(
    share,
    copy,
    email,
    button('Close', () => dialog.close()),
  );
  const onNotes = () => {
    if (reviewed) {
      refreshPreview();
      renderResults();
    }
  };
  const onVisible = () => {
    if (!document.hidden) onNotes();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onNotes);
  const onAccount = () => dialog.close();
  window.addEventListener('dayline:notes-changed', onNotes);
  window.addEventListener('dayline:account', onAccount);
  dialog.addEventListener(
    'close',
    () => {
      clearTimeout(expiryTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onNotes);
      window.removeEventListener('dayline:notes-changed', onNotes);
      window.removeEventListener('dayline:account', onAccount);
      dialog.remove();
    },
    { once: true },
  );
  document.body.append(dialog);
  refreshPreview();
  dialog.showModal();
}
