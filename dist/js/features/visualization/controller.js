import { node } from '../../shared/dom.js?v=a5e287120672';
import { dayKey } from '../../shared/dates.js?v=a5e287120672';
import { VISUALIZATIONS, rollVisualization } from './catalog.js?v=a5e287120672';
export const ENABLED_KEY = 'dayline.visualization.enabled.v1';
export const PINNED_KEY = 'dayline.visualization.pinned.v1';
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
  favorites,
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
    sessionDay = null;
  const shown = new Set();
  const read = (key) => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const pinnedExercise = () => VISUALIZATIONS.find((item) => item.id === read(PINNED_KEY));
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
  const firstLabel = node('label', 'visualization-first-label', 'First visualization');
  const first = node('select');
  first.setAttribute('aria-label', 'First visualization');
  for (const [id, title] of [
    ['', 'Random exercise'],
    ...VISUALIZATIONS.map((item) => [item.id, item.title]),
  ]) {
    const option = node('option', '', title);
    option.value = id;
    first.append(option);
  }
  first.value = pinnedExercise()?.id || '';
  firstLabel.append(first);
  setting.append(
    firstLabel,
    node(
      'p',
      'field-hint',
      'A pinned exercise opens first for the daily pop-up and Guided Visualization. You can still reroll. This choice and activity favorites are saved in this browser.',
    ),
  );
  first.addEventListener('change', () => setPin(first.value));
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
      'Imagine a manageable next step or the qualities you want to practice today with a randomly chosen 30–90-second exercise.',
    ),
    button('Start guided visualization', () => open(false), 'primary'),
  );
  if (favorites)
    card.append(favorites.register('visualization', 'Guided Visualization', () => open(false)));
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
    const [text, author, source, url] = exercise.quote;
    const quote = node('figure', 'visualization-quote'),
      words = node('blockquote', '', `“${text}”`),
      caption = node('figcaption', '', `— ${author} · `),
      link = node('a', '', source);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    caption.append(link);
    quote.append(words, caption);
    dialog.append(quote);
    const pin = button('', () => setPin(pinnedExercise()?.id === exercise.id ? '' : exercise.id));
    pin.classList.add('visualization-pin');
    const pinHint = node('p', 'field-hint visualization-pin-hint');
    dialog.append(pin, pinHint);
    refreshPin();
    const actions = node('div', 'inline');
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

    actions.append(
      button('Reroll', () => {
        exercise = rollVisualization(exercise.id, random);
        response = '';
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
  function refreshPin() {
    const pinned = pinnedExercise();
    first.value = pinned?.id || '';
    const pin = dialog.querySelector('.visualization-pin');
    if (!pin || !exercise) return;
    const selected = pinned?.id === exercise.id;
    pin.textContent = selected ? 'Unpin first exercise' : 'Pin as first exercise';
    pin.setAttribute('aria-pressed', String(selected));
    dialog.querySelector('.visualization-pin-hint').textContent = pinned
      ? `Opens first: ${pinned.title}. Rerolling does not change your pin.`
      : 'Pin this exercise to open it first next time. Reroll remains available.';
  }
  function setPin(id) {
    try {
      storage.setItem(PINNED_KEY, id);
    } catch {
      toast('Could not save the first visualization in this browser.');
    }
    refreshPin();
  }
  window.addEventListener('storage', (event) => {
    if (event.key === PINNED_KEY || event.key === null) refreshPin();
  });
  function open(daily) {
    if (dialog.open) return;
    sessionDay = daily ? dayKey(now()) : null;
    exercise = pinnedExercise() || rollVisualization(exercise?.id, random);
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
