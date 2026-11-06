import { node } from '../../shared/dom.js?v=3039d17efbd9';
import {
  COMMITMENTS_KEY,
  SUGGESTIONS,
  validCommitments,
  practiceProgress,
} from './model.js?v=3039d17efbd9';
function button(text, action, kind = 'secondary') {
  const b = node('button', kind, text);
  b.type = 'button';
  b.addEventListener('click', action);
  return b;
}
export function setupCommitments({ getState, startPractice, storage = localStorage }) {
  const launch = document.querySelector('#launch-commitments'),
    dialog = node('dialog', 'shortcuts-panel commitments-panel');
  dialog.id = 'commitments-panel';
  dialog.setAttribute('aria-labelledby', 'commitments-heading');
  document.body.append(dialog);
  launch.setAttribute('aria-controls', dialog.id);
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-expanded', 'false');
  const header = node('div', 'shortcuts-header'),
    heading = node('h2', '', 'Daily Commitments');
  heading.id = 'commitments-heading';
  function close() {
    dialog.close();
  }
  header.append(heading, button('Close', close));
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  const list = node('div', 'commitments-list'),
    form = node('form', 'shortcut-form'),
    formTitle = node('h3', '', 'Add a daily practice');
  const suggestions = node('div', 'commitment-suggestions');
  const titleLabel = node('label', '', 'Habit'),
    title = node('input');
  title.type = 'text';
  title.required = true;
  title.maxLength = 100;
  title.setAttribute('aria-label', 'Habit name');
  titleLabel.append(title);
  const minuteLabel = node('label', '', 'Daily focus minutes'),
    minutes = node('input');
  minutes.type = 'number';
  minutes.min = '1';
  minutes.max = '1440';
  minutes.step = '1';
  minutes.required = true;
  minutes.value = '30';
  minutes.setAttribute('aria-label', 'Daily focus minutes');
  minuteLabel.append(minutes);
  for (const text of SUGGESTIONS)
    suggestions.append(
      button(text, () => {
        title.value = text;
        title.focus();
      }),
    );
  const save = node('button', 'primary', 'Add commitment');
  save.type = 'submit';
  const cancel = button('Cancel edit', reset);
  cancel.hidden = true;
  form.append(
    formTitle,
    node(
      'p',
      'field-hint',
      'Choose a suggestion or write your own. Show up for the practice; no specific outcome required.',
    ),
    suggestions,
    titleLabel,
    minuteLabel,
    save,
    cancel,
  );
  dialog.append(
    header,
    node(
      'p',
      '',
      'A little time, every day. Tap a habit to begin its Focus Session. Finish whenever you need; the time target is a guide.',
    ),
    node(
      'p',
      'field-hint',
      'This list is saved in this browser. Finished sessions are saved in your notes and can sync with your account.',
    ),
    status,
    list,
    form,
  );
  let items = [],
    editing = null,
    unreadable = false,
    returnFocus = null;
  function read() {
    try {
      items = validCommitments(JSON.parse(storage.getItem(COMMITMENTS_KEY) || '[]'));
      unreadable = false;
      save.disabled = false;
    } catch {
      unreadable = true;
      save.disabled = true;
      status.textContent = 'Saved commitments could not be read. They have not been overwritten.';
    }
  }
  function reset() {
    editing = null;
    title.value = '';
    minutes.value = '30';
    formTitle.textContent = 'Add a daily practice';
    save.textContent = 'Add commitment';
    cancel.hidden = true;
  }
  function persist(next) {
    try {
      if (unreadable)
        throw Error('Saved commitments could not be read. They have not been overwritten.');
      const validated = validCommitments(next);
      storage.setItem(COMMITMENTS_KEY, JSON.stringify(validated));
      items = validated;
      return true;
    } catch (e) {
      status.textContent = 'Could not save commitments. ' + e.message;
      return false;
    }
  }
  function render() {
    list.replaceChildren();
    if (!items.length) list.append(node('p', 'field-hint', 'Add your first practice below.'));
    for (const item of items) {
      const row = node('section', 'commitment-row');
      const total = practiceProgress(getState().days, item.id);
      const start = button(
        item.title,
        () => {
          close();
          startPractice(item);
        },
        'secondary commitment-start',
      );
      start.setAttribute('aria-label', `Start ${item.minutes}-minute practice: ${item.title}`);
      row.append(
        start,
        node(
          'p',
          'field-hint',
          `${item.minutes} min daily · Today: ${Math.floor(total / 60000)} min recorded`,
        ),
      );
      const controls = node('div', 'inline');
      controls.append(
        button('Edit', () => {
          editing = item.id;
          title.value = item.title;
          minutes.value = String(item.minutes);
          formTitle.textContent = 'Edit daily practice';
          save.textContent = 'Save commitment';
          cancel.hidden = false;
          title.focus();
        }),
        button('Remove', () => {
          if (persist(items.filter((v) => v.id !== item.id))) {
            if (editing === item.id) reset();
            render();
            status.textContent = 'Commitment removed. Saved notes and session reports were kept.';
          }
        }),
      );
      row.append(controls);
      list.append(row);
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (editing && !items.some((v) => v.id === editing)) {
      status.textContent =
        'This commitment changed in another tab. Reopen the list before editing.';
      return;
    }
    const item = {
      id: editing || crypto.randomUUID(),
      title: title.value,
      minutes: Number(minutes.value),
    };
    if (persist(editing ? items.map((v) => (v.id === editing ? item : v)) : [...items, item])) {
      reset();
      render();
      status.textContent = 'Daily commitment saved.';
    }
  });
  function open() {
    if ([...document.querySelectorAll('dialog[open]')].length) return;
    returnFocus = document.activeElement;
    read();
    render();
    dialog.showModal();
    launch.setAttribute('aria-expanded', 'true');
  }
  launch.addEventListener('click', open);
  dialog.addEventListener('close', () => {
    launch.setAttribute('aria-expanded', 'false');
    returnFocus?.isConnected && returnFocus.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  let backdrop = false;
  function outside(event) {
    const r = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    );
  }
  dialog.addEventListener('pointerdown', (e) => {
    backdrop = e.button === 0 && outside(e);
  });
  dialog.addEventListener('pointercancel', () => {
    backdrop = false;
  });
  dialog.addEventListener('click', (e) => {
    const dismiss = backdrop && outside(e);
    backdrop = false;
    if (dismiss) close();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === COMMITMENTS_KEY || event.key === null) {
      read();
      reset();
      render();
    }
  });
  window.addEventListener('dayline:account', () => {
    if (dialog.open) close();
    reset();
  });
  window.addEventListener('dayline:notes-changed', () => {
    if (dialog.open) render();
  });
  read();
  render();
  return { open };
}
