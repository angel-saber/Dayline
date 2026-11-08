import { node } from '../../shared/dom.js?v=a34f3afb6430';
import { dayKey, offsetDay, timeLabel } from '../../shared/dates.js?v=a34f3afb6430';
import {
  availableHours,
  hourInput,
  inputMinute,
} from '../settings/available-hours.js?v=a34f3afb6430';
import { candidates, previewSchedule, enabled, EXPERIMENT_KEY } from './model.js?v=a34f3afb6430';
const modes = [
  ['start', 'Help me start'],
  ['behind', 'I’m falling behind'],
  ['steady', 'I’m on time'],
  ['ahead', 'I’m ahead'],
  ['stop', 'I’m doing too much'],
];
function button(label, action) {
  const b = node('button', 'secondary', label);
  b.type = 'button';
  b.onclick = action;
  return b;
}
export function setupDayAdjust({ root, settingsRoot, getState, getDate, openNote, apply, toast }) {
  const card = node('details', 'day-adjust');
  card.append(node('summary', '', 'Adjust my day · experimental'));
  const body = node('div', 'day-adjust-body');
  card.append(body);
  root.append(card);
  let mode = '',
    draft = null,
    deadline = 0,
    timer = null;
  const setting = node('section', 'settings-card');
  setting.append(
    node('h2', '', 'Try Adjust my day'),
    node(
      'p',
      '',
      'An optional Daily check-in. Suggestions stay on this device; no schedule changes happen without a preview and your approval.',
    ),
  );
  const label = node('label', 'summary-setting-toggle'),
    toggle = node('input');
  toggle.type = 'checkbox';
  toggle.checked = enabled();
  label.append(toggle, document.createTextNode('Show the Adjust my day experiment on Daily'));
  setting.append(label);
  settingsRoot.append(setting);
  toggle.onchange = () => {
    try {
      localStorage.setItem(EXPERIMENT_KEY, String(toggle.checked));
      render();
    } catch {
      toggle.checked = enabled();
      toast('Could not save this preference.');
    }
  };
  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
    deadline = 0;
  }
  function startTimer(output, starting = false) {
    stopTimer();
    deadline = Date.now() + 120000;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      output.textContent = seconds
        ? `${starting ? 'Two-minute start' : 'Two-minute pause'}: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}. You can stop whenever you need.`
        : 'Two minutes are up. Continue, switch, or stop—your choice.';
      if (!seconds) stopTimer();
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  function render() {
    stopTimer();
    draft = null;
    body.replaceChildren();
    card.hidden = !enabled() || getDate() !== dayKey();
    toggle.checked = enabled();
    if (card.hidden) return;
    body.append(
      node(
        'p',
        '',
        'How is your day going? You decide—unchecked notes don’t tell the whole story.',
      ),
    );
    const choices = node('div', 'day-adjust-actions');
    for (const [key, text] of modes) {
      const b = button(text, () => {
        mode = key;
        render();
      });
      b.setAttribute('aria-pressed', String(mode === key));
      choices.append(b);
    }
    body.append(choices);
    if (!mode) return;
    const { days, settings } = getState(),
      date = getDate(),
      notes = candidates(days, date),
      now = new Date(),
      minute = now.getHours() * 60 + now.getMinutes();
    const message = node('p', 'day-adjust-message');
    message.setAttribute('role', 'status');
    body.append(message);
    if (['start', 'steady', 'ahead'].includes(mode)) {
      const copy = {
        start:
          'Choose something worth giving a small beginning. Open it and define a two-minute first step; finishing it is not required.',
        steady:
          'Keep a sustainable pace. Take a short pause or open your next planned note when you are ready.',
        ahead:
          'You have permission to enjoy the space you made. You can also prepare one thing for later—extra work is optional.',
      };
      body.append(node('p', '', copy[mode]));
      const output = node('p');
      output.setAttribute('role', 'status');
      body.append(
        button(mode === 'start' ? 'Try a two-minute start' : 'Take a two-minute pause', () =>
          startTimer(output, mode === 'start'),
        ),
        output,
      );
      if (mode === 'ahead')
        body.append(
          button('Enjoy the free time', () => {
            message.textContent = 'Leave this time open. You don’t need to earn it again.';
          }),
        );
      let shown = mode === 'steady' ? notes.filter((n) => n.allDay || n.minute >= minute) : notes;
      if (!shown.length)
        body.append(
          node('p', '', 'No eligible notes to suggest. Add one on Daily, or leave the space open.'),
        );
      for (const note of shown) {
        body.append(
          button(
            (note.allDay ? 'All day' : timeLabel(note.minute, settings.clock)) +
              ' · ' +
              title(note),
            () => openNote(date, note.id),
          ),
        );
      }
      return;
    }
    body.append(
      node(
        'p',
        '',
        mode === 'behind'
          ? 'Choose the essentials to arrange from a new start time. Unselected notes stay where they are; you can move them separately. Spacing is between start times, not an estimate of task duration.'
          : 'Choose what can wait and give it a new date. Before stopping, you can open a note to leave yourself a brief “resume here” reminder. Unselected notes stay unchanged.',
      ),
    );
    if ((days[date] || []).some((n) => n.repeat && !n.done))
      body.append(
        node(
          'p',
          'field-hint',
          'Repeating notes are left out of this test. Use their Reschedule controls to choose which occurrences to change.',
        ),
      );
    const selected = new Set();
    const selection = node('fieldset');
    selection.append(node('legend', '', 'Notes to move'));
    for (const note of notes) {
      const row = node('div', 'day-adjust-note'),
        lab = node('label'),
        box = node('input');
      box.type = 'checkbox';
      box.onchange = () => {
        box.checked ? selected.add(note.id) : selected.delete(note.id);
        invalidate();
      };
      lab.append(box, document.createTextNode(title(note)));
      row.append(
        lab,
        button('Open note', () => openNote(date, note.id)),
      );
      selection.append(row);
    }
    body.append(selection);
    if (!notes.length) {
      body.append(node('p', '', 'No eligible unfinished notes to move.'));
      return;
    }
    const controls = node('div', 'day-adjust-fields');
    function field(text, type, value) {
      const l = node('label', '', text),
        i = node('input');
      i.type = type;
      i.value = value;
      l.append(i);
      controls.append(l);
      i.oninput = () => invalidate();
      return i;
    }
    const target = field('New date', 'date', mode === 'stop' ? offsetDay(date, 1) : date);
    const hours = availableHours(settings),
      start = field(
        'First start time',
        'time',
        hourInput(mode === 'stop' ? hours.from : Math.min(1439, minute + 5)),
      );
    const spacing = field('Minutes between starts', 'number', String(settings.interval));
    spacing.min = '1';
    spacing.max = '1440';
    target.min = date;
    body.append(controls);
    const preview = node('div', 'day-adjust-preview');
    const applyButton = button('Apply these changes', () => {
      if (!draft) return;
      try {
        if (apply(draft)) {
          message.textContent = 'Schedule updated. Use Undo in the notification to restore it.';
          draft = null;
          applyButton.hidden = true;
        }
      } catch (e) {
        message.textContent = e.message;
        invalidate();
      }
    });
    applyButton.hidden = true;
    function invalidate() {
      draft = null;
      preview.replaceChildren();
      applyButton.hidden = true;
    }
    body.append(
      button('Preview changes', () => {
        invalidate();
        message.textContent = '';
        try {
          draft = previewSchedule(
            getState().days,
            date,
            [...selected],
            target.value,
            inputMinute(start.value),
            Number(spacing.value),
          );
          preview.append(node('h3', '', 'Proposed schedule'));
          for (const move of draft.moves) {
            const original = getState().days[date].find((n) => n.id === move.id);
            preview.append(
              node(
                'p',
                '',
                `${move.title}: ${date} ${original.allDay ? 'All day' : timeLabel(original.minute, settings.clock)} → ${move.date} ${timeLabel(move.minute, settings.clock)}`,
              ),
            );
          }
          for (const warning of draft.warnings) preview.append(node('p', '', warning));
          if (draft.moves.some((m) => m.minute < hours.from || m.minute >= hours.to))
            preview.append(
              node(
                'p',
                '',
                'Some starts are outside your available hours. Adjust the time or apply if intentional.',
              ),
            );
          if (draft.moves.some((m) => m.date !== target.value))
            preview.append(
              node(
                'p',
                '',
                'This arrangement continues into the following day. Review each date above.',
              ),
            );
          applyButton.hidden = false;
        } catch (e) {
          message.textContent = e.message;
        }
      }),
      preview,
      applyButton,
    );
  }
  function title(note) {
    return note.title?.trim() || note.text?.split('\n')[0] || 'Untitled note';
  }
  window.addEventListener('storage', (event) => {
    if (event.key === EXPERIMENT_KEY) render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getDate() !== dayKey()) render();
  });
  render();
  return { render };
}
