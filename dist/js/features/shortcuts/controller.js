import { node } from '../../shared/dom.js?v=59dbd0e22808';
import {
  SHORTCUTS_KEY,
  DEFAULT_SHORTCUTS,
  shortcutValues,
  validShortcuts,
} from './model.js?v=59dbd0e22808';
const button = (label, action, className = 'secondary') => {
  const el = node('button', className, label);
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
};
export function setupShortcuts({ storage = localStorage } = {}) {
  const launch = document.querySelector('#launch-shortcuts');
  const dialog = node('dialog', 'shortcuts-panel');
  dialog.id = 'shortcuts-panel';
  dialog.setAttribute('aria-labelledby', 'shortcuts-heading');
  launch.setAttribute('aria-controls', dialog.id);
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-expanded', 'false');
  const header = node('div', 'shortcuts-header');
  const heading = node('h2', '', 'Shortcuts');
  heading.id = 'shortcuts-heading';
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  const list = node('ul', 'shortcuts-list');
  const form = node('form', 'shortcut-form');
  const formHeading = node('h3', '', 'Add a custom shortcut');
  const nameLabel = node('label', '', 'Name');
  const name = node('input');
  name.type = 'text';
  name.maxLength = 60;
  name.required = true;
  name.setAttribute('aria-label', 'Shortcut name');
  nameLabel.append(name);
  const urlLabel = node('label', '', 'Web address');
  const url = node('input');
  url.type = 'text';
  url.inputMode = 'url';
  url.maxLength = 2048;
  url.required = true;
  url.placeholder = 'https://example.com';
  url.setAttribute('aria-label', 'Shortcut web address');
  urlLabel.append(url);
  const save = node('button', 'primary', 'Add shortcut');
  save.type = 'submit';
  let custom = [],
    editing = null,
    unreadable = false,
    returnFocus = null;
  try {
    custom = validShortcuts(JSON.parse(storage.getItem(SHORTCUTS_KEY) || '[]'));
  } catch {
    unreadable = true;
    status.textContent = 'Saved shortcuts could not be read. They have not been overwritten.';
    save.disabled = true;
  }
  function reset() {
    editing = null;
    name.value = '';
    url.value = '';
    formHeading.textContent = 'Add a custom shortcut';
    save.textContent = 'Add shortcut';
    cancel.hidden = true;
  }
  function persist(next) {
    try {
      if (unreadable) throw new Error('Saved shortcuts could not be read.');
      const validated = validShortcuts(next);
      storage.setItem(SHORTCUTS_KEY, JSON.stringify(validated));
      custom = validated;
      return true;
    } catch (error) {
      status.textContent = 'Could not save shortcuts. ' + error.message;
      return false;
    }
  }
  function render() {
    list.replaceChildren();
    for (const item of [...DEFAULT_SHORTCUTS, ...custom]) {
      const row = node('li', 'shortcut-row');
      const link = node('a', 'shortcut-link', item.name);
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = item.name + ' — opens in a new tab';
      row.append(link);
      if (custom.some((value) => value.id === item.id)) {
        const edit = button('Edit', () => {
          editing = item.id;
          name.value = item.name;
          url.value = item.url;
          formHeading.textContent = 'Edit shortcut';
          save.textContent = 'Save shortcut';
          cancel.hidden = false;
          name.focus();
        });
        edit.setAttribute('aria-label', 'Edit shortcut: ' + item.name);
        const remove = button('Remove', () => {
          if (!persist(custom.filter((value) => value.id !== item.id))) return;
          if (editing === item.id) reset();
          render();
          status.textContent = 'Shortcut removed.';
          name.focus();
        });
        remove.setAttribute('aria-label', 'Remove shortcut: ' + item.name);
        row.append(edit, remove);
      }
      list.append(row);
    }
  }
  const cancel = button('Cancel editing', reset);
  cancel.hidden = true;
  const actions = node('div', 'inline');
  actions.append(save, cancel);
  form.append(formHeading, nameLabel, urlLabel, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const values = shortcutValues(name.value, url.value);
      const next = editing
        ? custom.map((item) => (item.id === editing ? { id: item.id, ...values } : item))
        : [...custom, { id: crypto.randomUUID(), ...values }];
      if (!persist(next)) return;
      reset();
      render();
      status.textContent = 'Shortcut saved on this device.';
      name.focus();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  function close() {
    dialog.close();
  }
  header.append(heading, button('Close shortcuts', close));
  dialog.append(
    header,
    node(
      'p',
      'field-hint',
      'Open your tools in a new tab. Copy meeting or file links back into a note. Custom shortcuts are saved in this browser on this device.',
    ),
    list,
    form,
    status,
  );
  document.body.append(dialog);
  render();
  function open() {
    if (document.querySelector('#planner')?.hidden) return;
    if (dialog.open) return;
    returnFocus = document.activeElement;
    launch.setAttribute('aria-expanded', 'true');
    dialog.showModal();
  }
  launch.addEventListener('click', open);
  dialog.addEventListener('close', () => {
    launch.setAttribute('aria-expanded', 'false');
    if (returnFocus?.isConnected && !document.querySelector('#planner')?.hidden)
      returnFocus.focus({ preventScroll: true });
  });
  let backdrop = false;
  const outside = (event) => {
    const rect = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    );
  };
  dialog.addEventListener('pointerdown', (event) => {
    backdrop = event.button === 0 && outside(event);
  });
  dialog.addEventListener('pointercancel', () => {
    backdrop = false;
  });
  dialog.addEventListener('click', (event) => {
    const dismiss = backdrop && outside(event);
    backdrop = false;
    if (dismiss) close();
  });
  const accountChange = () => {
    if (dialog.open) close();
    reset();
  };
  window.addEventListener('dayline:account', accountChange);
  return {
    open,
    destroy() {
      launch.removeEventListener('click', open);
      window.removeEventListener('dayline:account', accountChange);
      if (dialog.open) close();
      dialog.remove();
    },
  };
}
