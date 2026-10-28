import { node } from '../../shared/dom.js?v=e3a1bdfe567b';
import { dayKey } from '../../shared/dates.js?v=e3a1bdfe567b';
import { rollVisualization } from './catalog.js?v=e3a1bdfe567b';
export const ENABLED_KEY = 'dayline.visualization.enabled.v1';
export const SEEN_KEY = 'dayline.visualization.seen.v1';
export function shouldInvite(enabled, seen, today) {
  return enabled !== 'off' && seen !== today;
}

const button = (text, action, cls = 'secondary') => {
  const el = node('button', cls, text);
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
};
export function setupVisualizations({
  root,
  settings,
  canInvite,
  saveAction,
  toast,
  storage = localStorage,
  now = () => new Date(),
  random = Math.random,
}) {
  const dialog = node('dialog', 'visualization-dialog');
  dialog.setAttribute('aria-labelledby', 'visualization-heading');
  document.body.append(dialog);
  let exercise,
    response = '',
    started = false,
    sessionDay = null;
  const shown = new Set();
  const read = (key) => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const setting = node('section', 'settings-card');
  const label = node('label', 'visualization-toggle');
  const toggle = node('input');
  toggle.type = 'checkbox';
  toggle.checked = read(ENABLED_KEY) !== 'off';
  label.append(toggle, document.createTextNode('Show daily visualization invitation'));
  setting.append(
    node('h2', '', 'Daily visualization'),
    label,
    node(
      'p',
      'field-hint',
      'Show an invitation when you first open Dayline each day on this browser. Guided Visualization remains available in More.',
    ),
  );
  settings.append(setting);
  toggle.addEventListener('change', () => {
    try {
      storage.setItem(ENABLED_KEY, toggle.checked ? 'on' : 'off');
    } catch {
      toggle.checked = read(ENABLED_KEY) !== 'off';
      toast('Could not save this preference on this browser.');
    }
  });
  const card = node('section', 'settings-card activity-card');
  card.append(
    node('h2', '', 'Guided Visualization'),
    node(
      'p',
      'field-hint',
      'Imagine a manageable next step with a randomly chosen 30–90-second exercise.',
    ),
    button('Start guided visualization', () => open(false), 'primary'),
  );
  root.append(card);
  function render() {
    dialog.replaceChildren();
    const header = node('div', 'activity-header');
    const close = button('×', () => dialog.close());
    close.setAttribute('aria-label', 'Close visualization');
    const heading = node('h2', '', 'A moment to meet your day');
    heading.id = 'visualization-heading';
    header.append(heading, close);
    dialog.append(
      header,
      node(
        'p',
        'field-hint',
        'Take 30–90 seconds. Picture the scene, or simply think through the words if mental imagery doesn’t come easily.',
      ),
      node('h3', '', exercise.title),
    );
    const actions = node('div', 'inline');
    if (!started)
      actions.append(
        button(
          'Begin',
          () => {
            started = true;
            render();
          },
          'primary',
        ),
      );
    else {
      const input = node('textarea');
      input.rows = 3;
      input.maxLength = 2000;
      input.value = response;
      input.setAttribute('aria-label', 'Your next action (optional)');
      input.placeholder = 'Your next action (optional)';
      input.addEventListener('input', () => {
        response = input.value;
      });
      dialog.append(
        node('p', 'visualization-guidance', exercise.guidance),
        node('p', 'visualization-prompt', exercise.prompt),
        input,
      );
      actions.append(
        button('Finish', () => dialog.close(), 'primary'),
        button('Save action to Daily', () => {
          if (!response.trim()) {
            status.textContent = 'Write an action to save, or choose Finish without saving.';
            input.focus();
            return;
          }
          if (saveAction(exercise, response.trim()) !== false) dialog.close();
          else
            status.textContent =
              'Your action could not be saved. It is still here; please try again.';
        }),
      );
    }
    actions.append(
      button('Reroll', () => {
        exercise = rollVisualization(exercise.id, random);
        response = '';
        started = false;
        render();
      }),
    );
    const status = node('p', 'field-hint');
    status.setAttribute('role', 'status');
    dialog.append(
      actions,
      status,
      node(
        'p',
        'field-hint',
        'You can disable the daily pop-up in Settings → Daily visualization. These exercises are always available in More.',
      ),
    );
  }
  function open(daily) {
    if (dialog.open) return;
    sessionDay = daily ? dayKey(now()) : null;
    exercise = rollVisualization(exercise?.id, random);
    started = false;
    response = '';
    render();
    dialog.showModal();
    if (daily) {
      shown.add(sessionDay);
      try {
        storage.setItem(SEEN_KEY, sessionDay);
      } catch {
        /* Still once in this tab if storage is blocked. */
      }
    }
  }
  function check() {
    const today = dayKey(now());
    toggle.checked = read(ENABLED_KEY) !== 'off';
    if (
      !document.hidden &&
      !shown.has(today) &&
      shouldInvite(read(ENABLED_KEY), read(SEEN_KEY), today) &&
      canInvite()
    )
      open(true);
  }
  const onEntry = () => queueMicrotask(check);
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', onEntry);
  window.addEventListener('dayline:entry-view', onEntry);
  window.addEventListener('dayline:welcome-closed', onEntry);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
  window.addEventListener('dayline:account', () => {
    if (dialog.open) dialog.close();
  });
  queueMicrotask(check);
  return { open: () => open(false), check, dialog };
}
