import {
  NOTE_TYPES,
  noteTags,
  withTags,
  categoryLabel,
  categoryValue,
  categoryOptions,
  collectTagSettings,
} from './note-types.js?v=42c354e72a8f';
export function changeCustomTag(days, config, oldTag, name = null) {
  const settings = collectTagSettings(config, days);
  if (!oldTag.startsWith('custom:') || !settings.custom.includes(oldTag))
    throw new Error('Choose an existing custom tag.');
  const replacement =
    name === null ? null : categoryValue(name, categoryOptions(days, settings, true));
  const next = { ...days };
  for (const [date, list] of Object.entries(days))
    next[date] = list.map((entry) =>
      noteTags(entry).includes(oldTag)
        ? withTags(entry, [
            ...new Set(
              noteTags(entry).flatMap((tag) =>
                tag === oldTag ? (replacement ? [replacement] : []) : [tag],
              ),
            ),
          ])
        : entry,
    );
  settings.custom = settings.custom.filter((tag) => tag !== oldTag);
  if (replacement?.startsWith('custom:') && !settings.custom.includes(replacement))
    settings.custom.push(replacement);
  return { days: next, config: settings };
}
const node = (tag, text) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
const button = (text, fn) => {
  const b = node('button', text);
  b.type = 'button';
  b.className = 'secondary';
  b.onclick = fn;
  return b;
};
export function setupTagSettings({ root, getState, apply }) {
  function render() {
    const state = getState(),
      config = collectTagSettings(state.settings.tags, state.days);
    root.replaceChildren(
      node('h2', 'Tags'),
      node(
        'p',
        'Choose which default tags appear in the picker. Turning a default off keeps it on existing notes.',
      ),
    );
    const status = node('p');
    status.className = 'field-hint';
    status.setAttribute('role', 'status');
    for (const [key, label] of Object.entries(NOTE_TYPES)) {
      const row = node('label'),
        check = node('input');
      row.className = 'tag-setting-toggle';
      check.type = 'checkbox';
      check.checked = !config.disabledDefaults.includes(key);
      check.setAttribute('role', 'switch');
      check.setAttribute('aria-label', `Enable ${label} tag`);
      check.onchange = () => {
        const next = collectTagSettings(getState().settings.tags, getState().days);
        next.disabledDefaults = check.checked
          ? next.disabledDefaults.filter((k) => k !== key)
          : [...new Set([...next.disabledDefaults, key])];
        if (!apply({ days: getState().days, config: next }, 'Default tags updated.', false))
          render();
      };
      row.append(node('span', label), check);
      root.append(row);
    }
    root.append(node('h3', 'Custom tags'));
    if (!config.custom.length)
      root.append(node('p', 'No custom tags yet. Add one here or from a note’s tag picker.'));
    for (const tag of config.custom) {
      const row = node('div'),
        input = node('input');
      row.className = 'custom-tag-setting';
      input.type = 'text';
      input.maxLength = 40;
      input.value = categoryLabel(tag);
      input.setAttribute('aria-label', `Rename ${categoryLabel(tag)} tag`);
      const rename = button('Rename', () => {
        try {
          if (
            apply(
              changeCustomTag(getState().days, getState().settings.tags, tag, input.value),
              'Tag renamed across your notes.',
              true,
            )
          )
            render();
        } catch (e) {
          status.textContent = e.message;
        }
      });
      const remove = button('Delete', () => {
        const d = node('dialog'),
          h = node('h2', `Delete “${categoryLabel(tag)}”?`);
        d.className = 'bulk-dialog';
        d.setAttribute('aria-label', h.textContent);
        d.append(
          h,
          node(
            'p',
            'This removes the tag from every note. The notes and their contents stay intact. You can undo this change.',
          ),
          button('Delete tag', () => {
            try {
              if (
                apply(
                  changeCustomTag(getState().days, getState().settings.tags, tag),
                  'Custom tag removed.',
                  true,
                )
              ) {
                d.close();
                render();
              } else {
                d.append(node('p', 'Could not save this change. Your notes and tags were kept.'));
              }
            } catch (e) {
              status.textContent = e.message;
            }
          }),
          button('Cancel', () => d.close()),
        );
        d.addEventListener('close', () => d.remove(), { once: true });
        document.body.append(d);
        d.showModal();
      });
      row.append(input, rename, remove);
      root.append(row);
    }
    const add = node('div'),
      input = node('input');
    add.className = 'custom-tag-setting';
    input.type = 'text';
    input.maxLength = 40;
    input.placeholder = 'New tag name';
    input.setAttribute('aria-label', 'New custom tag name');
    const create = () => {
      try {
        const current = getState(),
          next = collectTagSettings(current.settings.tags, current.days),
          tag = categoryValue(input.value, categoryOptions(current.days, next, true));
        if (!tag.startsWith('custom:'))
          throw new Error('That is a default tag. Use its switch above.');
        if (!next.custom.includes(tag)) next.custom.push(tag);
        if (apply({ days: current.days, config: next }, 'Custom tag added.', false)) render();
      } catch (e) {
        status.textContent = e.message;
      }
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        create();
      }
    };
    add.append(input, button('Add tag', create));
    root.append(add, status);
  }
  return { render };
}
