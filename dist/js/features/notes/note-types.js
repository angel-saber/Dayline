export const NOTE_TYPES = {
  project: 'Project',
  admin: 'Admin',
  event: 'Event',
  personal: 'Personal',
};
export function validNoteType(value) {
  if (
    typeof value !== 'string' ||
    (value !== '' &&
      !Object.hasOwn(NOTE_TYPES, value) &&
      !(
        value.startsWith('custom:') &&
        value.slice(7).trim() === value.slice(7) &&
        value.length > 7 &&
        value.length <= 47 &&
        !/[\u0000-\u001f\u007f]/.test(value)
      ))
  )
    throw new Error('Invalid note type.');
  return value;
}
export function validTags(value, limit = 100) {
  if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid note tags.');
  const seen = new Set();
  return value.map((tag) => {
    validNoteType(tag);
    if (!tag || seen.has(tag)) throw new Error('Invalid or duplicate tag.');
    seen.add(tag);
    return tag;
  });
}
export function noteTags(entry) {
  return entry.tags !== undefined
    ? validTags(entry.tags)
    : entry.noteType
      ? [validNoteType(entry.noteType)]
      : [];
}
export function withTags(entry, tags) {
  tags = validTags(tags);
  return { ...entry, tags, noteType: tags[0] || '' };
}
export function matchesNoteType(entry, selected) {
  const tags = noteTags(entry);
  return tags.length ? tags.some((tag) => selected.has(tag)) : selected.has('none');
}
export function validTagSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid tag settings.');
  const disabledDefaults = value.disabledDefaults || [],
    custom = value.custom || [];
  if (
    !Array.isArray(disabledDefaults) ||
    disabledDefaults.some((k) => !Object.hasOwn(NOTE_TYPES, k))
  )
    throw new Error('Invalid default tag settings.');
  validTags(custom, Number.MAX_SAFE_INTEGER);
  if (custom.some((k) => !k.startsWith('custom:'))) throw new Error('Invalid custom tag settings.');
  return { disabledDefaults: [...new Set(disabledDefaults)], custom: [...custom] };
}
export function collectTagSettings(config, days) {
  const result = validTagSettings(config);
  for (const entries of Object.values(days))
    for (const entry of entries)
      for (const tag of noteTags(entry))
        if (tag.startsWith('custom:') && !result.custom.includes(tag)) result.custom.push(tag);
  return result;
}

export function categoryLabel(value) {
  return (
    (Object.hasOwn(NOTE_TYPES, value) ? NOTE_TYPES[value] : '') ||
    (typeof value === 'string' && value.startsWith('custom:') ? value.slice(7) : '')
  );
}
export function categoryOptions(days = {}, config = {}, all = false) {
  const settings = collectTagSettings(config, days),
    options = {};
  for (const [key, label] of Object.entries(NOTE_TYPES))
    if (all || !settings.disabledDefaults.includes(key)) options[key] = label;
  for (const tag of settings.custom) options[tag] = categoryLabel(tag);
  return options;
}
export function categoryValue(label, options = NOTE_TYPES) {
  label = label.trim().replace(/\s+/g, ' ');
  if (!label || label.length > 40) throw new Error('Use a category name of 1–40 characters.');
  const existing = Object.entries(options).find(
    ([, name]) => name.toLocaleLowerCase() === label.toLocaleLowerCase(),
  );
  return existing?.[0] || validNoteType('custom:' + label);
}
export function typeChips(value = [], label = 'Note tags', onChange = () => {}, categories = null) {
  const selected = new Set(validTags(Array.isArray(value) ? value : value ? [value] : [])),
    options = { ...(categories ?? NOTE_TYPES) };
  for (const tag of selected) options[tag] = categoryLabel(tag);
  const group = document.createElement('fieldset'),
    legend = document.createElement('legend');
  group.className = 'note-type-picker';
  legend.textContent = label;
  group.append(legend);
  const buttons = [];
  function add(key, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'note-type-chip';
    button.dataset.noteType = key.startsWith('custom:') ? 'custom' : key;
    button.textContent = text;
    button.setAttribute('aria-pressed', String(selected.has(key)));
    button.addEventListener('click', () => toggle(key));
    buttons.push([key, button]);
    group.insertBefore(button, custom);
  }
  function publish(notify = true) {
    for (const [type, chip] of buttons)
      chip.setAttribute('aria-pressed', String(selected.has(type)));
    if (notify) onChange([...selected]);
  }
  function toggle(key) {
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    publish();
  }
  const custom = document.createElement('details');
  custom.className = 'custom-category';
  const summary = document.createElement('summary');
  summary.textContent = '+ Tag';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 40;
  input.placeholder = 'Tag name';
  input.setAttribute('aria-label', 'Custom tag name');
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Add';
  const error = document.createElement('span');
  error.setAttribute('role', 'alert');
  function create() {
    try {
      const key = categoryValue(input.value, { ...NOTE_TYPES, ...options });
      if (Object.hasOwn(NOTE_TYPES, key) && !options[key])
        throw new Error('This default tag is turned off in Settings.');
      if (!options[key]) {
        options[key] = categoryLabel(key);
        add(key, options[key]);
      }
      selected.add(key);
      publish();
      custom.open = false;
      input.value = '';
      error.textContent = '';
    } catch (e) {
      error.textContent = e.message;
    }
  }
  save.addEventListener('click', create);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      create();
    }
  });
  custom.append(summary, input, save, error);
  group.append(custom);
  for (const [key, text] of Object.entries(options)) add(key, text);
  return {
    setValue(value) {
      const tags = validTags(value);
      selected.clear();
      for (const tag of tags) {
        if (!options[tag]) {
          options[tag] = categoryLabel(tag);
          add(tag, options[tag]);
        }
        selected.add(tag);
      }
      publish(false);
    },
    element: group,
    get value() {
      return [...selected];
    },
  };
}
export function typeBadge(value) {
  if (!categoryLabel(value)) return null;
  const badge = document.createElement('span');
  badge.className = 'note-type-badge';
  badge.dataset.noteType = value.startsWith('custom:') ? 'custom' : value;
  badge.textContent = categoryLabel(value);
  return badge;
}

export function tagBadges(entry) {
  const group = document.createElement('span');
  group.className = 'note-tag-badges';
  for (const tag of noteTags(entry)) {
    const badge = typeBadge(tag);
    if (badge) group.append(badge);
  }
  return group.childNodes.length ? group : null;
}
