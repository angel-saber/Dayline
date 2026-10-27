import { node } from '../../shared/dom.js?v=577f95117f93';
import { openAvailability } from '../sharing/availability-ui.js?v=577f95117f93';
import { selectionKey, selectedNotes, matchingNotes, scopeRange } from './model.js?v=577f95117f93';
import { categoryOptions, typeChips } from '../notes/note-types.js?v=577f95117f93';
import { openShareNotes } from '../sharing/share-note.js?v=577f95117f93';

const button = (text, fn, cls = 'secondary') => {
  const e = node('button', cls, text);
  e.type = 'button';
  e.onclick = fn;
  return e;
};
export function setupBulk(api) {
  let active = false;
  const keys = new Set(),
    bar = node('div', 'bulk-bar');
  bar.hidden = true;
  bar.setAttribute('aria-label', 'Selected note actions');
  bar.setAttribute('role', 'region');
  document.body.append(bar);
  const items = () => selectedNotes(api.getState().days, keys);
  function refresh() {
    api.flush();
    api.refresh();
    updateBar();
  }
  function clear() {
    active = false;
    keys.clear();
    document.body.classList.remove('bulk-mode');
    refresh();
  }
  function start() {
    api.flush();
    active = true;
    document.body.classList.add('bulk-mode');
    refresh();
  }
  function modal(title) {
    const d = node('dialog', 'bulk-dialog'),
      h = node('h2', '', title);
    h.id = 'bulk-dialog-heading';
    d.setAttribute('aria-labelledby', h.id);
    d.append(h);
    d.addEventListener('close', () => d.remove(), { once: true });
    document.body.append(d);
    return d;
  }
  function apply(dialog, action) {
    if (api.apply(keys, action)) {
      dialog.close();
      clear();
    } else {
      let error = dialog.querySelector('.bulk-error');
      if (!error) {
        error = node('p', 'bulk-error', '');
        error.setAttribute('role', 'alert');
        dialog.append(error);
      }
      error.textContent =
        'Could not apply this change. Your notes were kept. Check the selected values and try again.';
    }
  }
  function move() {
    const selected = items();
    if (!selected.length) return;
    const d = modal(`Move ${selected.length} notes`),
      label = node('label', '', 'Destination date'),
      date = node('input');
    date.type = 'date';
    date.required = true;
    date.value = selected[0].date;
    date.setAttribute('aria-label', 'Bulk move destination date');
    label.append(date);
    const timeLabel = node('label', '', 'First selected note starts at'),
      time = node('input');
    time.type = 'time';
    time.step = '60';
    time.required = true;
    time.value = `${String(Math.floor(selected[0].entry.minute / 60)).padStart(2, '0')}:${String(selected[0].entry.minute % 60).padStart(2, '0')}`;
    time.setAttribute('aria-label', 'Bulk move first note time');
    timeLabel.append(time);
    let keepSpacing = true;
    const choices = node('fieldset', 'bulk-options');
    choices.hidden = new Set(selected.map((item) => item.date)).size === 1;
    choices.append(node('legend', '', 'Move dates'));
    for (const [value, text] of [
      [true, 'Keep the spacing between days (start on this date)'],
      [false, 'Put all selected notes on this date'],
    ]) {
      const l = node('label', ''),
        r = node('input');
      r.type = 'radio';
      r.name = 'bulk-move-mode';
      r.checked = value;
      r.onchange = () => (keepSpacing = value);
      l.append(r, document.createTextNode(text));
      choices.append(l);
    }
    d.append(
      label,
      timeLabel,
      choices,
      node(
        'p',
        'field-hint',
        'Choose the same date to move within the day. Changing the start time shifts every selected note equally, keeping all time gaps. Existing notes stay in place. Notes crossing midnight continue on the next or previous day.',
      ),
      button(
        'Move notes',
        () => {
          if (!date.reportValidity() || !time.reportValidity()) return;
          const [hour, minute] = time.value.split(':').map(Number);
          const destination = hour * 60 + minute;
          apply(d, { kind: 'move', date: date.value, minute: destination, keepSpacing });
        },
        'primary',
      ),
      button('Cancel', () => d.close()),
    );
    d.showModal();
  }
  function category() {
    const d = modal(`Tag ${items().length} notes`);
    let value = [],
      mode = 'add';
    const applyButton = button(
      'Apply tags',
      () => apply(d, { kind: 'category', tags: value, mode }),
      'primary',
    );
    applyButton.disabled = true;
    const chips = typeChips(
      [],
      'Choose or create tags',
      (v) => {
        value = v;
        applyButton.disabled = !v.length;
      },
      categoryOptions(api.getState().days, api.getState().settings.tags),
    );
    const modes = node('fieldset', 'bulk-options');
    modes.append(node('legend', '', 'Tag action'));
    for (const [key, text] of [
      ['add', 'Add these tags (keep existing tags)'],
      ['remove', 'Remove these tags'],
      ['replace', 'Replace all tags with these'],
    ]) {
      const label = node('label', ''),
        radio = node('input');
      radio.type = 'radio';
      radio.name = 'bulk-tag-mode';
      radio.checked = key === 'add';
      radio.onchange = () => (mode = key);
      label.append(radio, document.createTextNode(text));
      modes.append(label);
    }
    d.append(
      chips.element,
      modes,
      applyButton,
      button('Clear all tags', () => apply(d, { kind: 'category', tags: [], mode: 'replace' })),
      button('Cancel', () => d.close()),
    );
    d.showModal();
  }
  function remove() {
    const count = items().length;
    if (!count) return;
    const d = modal(`Delete ${count} notes?`);
    d.append(
      node(
        'p',
        '',
        'This removes the selected notes and their attached reports. You can undo the deletion using Dayline’s Undo message.',
      ),
      button('Delete notes', () => apply(d, { kind: 'delete' }), 'primary'),
      button('Cancel', () => d.close()),
    );
    d.showModal();
  }
  function updateBar() {
    const selected = items();
    bar.hidden = !active || !api.visible();
    bar.replaceChildren();
    const count = node('span', '', `${selected.length} selected`);
    count.setAttribute('role', 'status');
    bar.append(count);
    for (const [text, action] of [
      [
        'Share',
        () => {
          api.flush();
          openShareNotes(items(), api.getState().settings.clock);
        },
      ],
      ['Move', move],
      ['Tags', category],
      ['Delete', remove],
    ]) {
      const b = button(text, action);
      b.disabled = !selected.length;
      bar.append(b);
    }
    bar.append(button('Cancel', clear));
  }
  function selectByCategory() {
    const d = modal('Select notes by category'),
      anchor = node('input');
    anchor.type = 'date';
    anchor.required = true;
    anchor.value = api.anchor();
    anchor.setAttribute('aria-label', 'Selection anchor date');
    let scope = api.getView() === 'monthly' ? 'month' : 'day';
    const scopeOptions = node('fieldset', 'bulk-options');
    scopeOptions.append(node('legend', '', 'Select across'));
    for (const value of ['day', 'week', 'month']) {
      const label = node('label', ''),
        r = node('input');
      r.type = 'radio';
      r.name = 'bulk-scope';
      r.checked = scope === value;
      r.onchange = () => {
        scope = value;
        preview();
      };
      label.append(r, document.createTextNode(value[0].toUpperCase() + value.slice(1)));
      scopeOptions.append(label);
    }
    const types = categoryOptions(api.getState().days, api.getState().settings.tags, true),
      categories = new Set(['none', ...Object.keys(types)]),
      categoryOptionsElement = node('fieldset', 'bulk-options');
    categoryOptionsElement.append(node('legend', '', 'Categories (choose any)'));
    for (const [key, text] of [['none', 'None'], ...Object.entries(types)]) {
      const label = node('label', ''),
        check = node('input');
      check.type = 'checkbox';
      check.checked = true;
      check.onchange = () => {
        if (check.checked) categories.add(key);
        else categories.delete(key);
        preview();
      };
      label.append(check, document.createTextNode(text));
      categoryOptionsElement.append(label);
    }
    const summary = node('p', 'field-hint');
    summary.setAttribute('role', 'status');
    const add = button(
      'Add matching notes',
      () => {
        if (!anchor.reportValidity()) return;
        for (const { date, entry } of matchingNotes(
          api.getState().days,
          anchor.value,
          scope,
          categories,
        ))
          keys.add(selectionKey(date, entry.id));
        d.close();
        refresh();
      },
      'primary',
    );
    function preview() {
      try {
        const range = scopeRange(anchor.value, scope),
          count = matchingNotes(api.getState().days, anchor.value, scope, categories).length;
        summary.textContent = `${range.start} – ${range.end} · ${count} matching notes. Week ranges run Sunday to Saturday. Matches are added to your existing selection.`;
        add.disabled = !count;
      } catch {
        summary.textContent = 'Choose a valid date.';
        add.disabled = true;
      }
    }
    anchor.onchange = preview;
    const label = node('label', '', 'Date within the day, week, or month');
    label.append(anchor);
    d.append(
      label,
      scopeOptions,
      categoryOptionsElement,
      summary,
      add,
      button('Cancel', () => d.close()),
    );
    preview();
    d.showModal();
  }
  function controls() {
    const container = node('div', 'bulk-controls');
    if (!active) container.append(button('Select notes', start));
    else
      container.append(
        button('Select by category', selectByCategory),
        button('Clear selection', () => {
          keys.clear();
          refresh();
        }),
        button('Cancel selection', clear),
      );
    container.append(button('Share availability', () => openAvailability(api)));
    return container;
  }
  function checkbox(date, entry) {
    if (!active) return null;
    const label = node('label', 'note-selection'),
      check = node('input');
    check.type = 'checkbox';
    check.checked = keys.has(selectionKey(date, entry.id));
    check.setAttribute(
      'aria-label',
      `Select note: ${entry.title || entry.text.split('\n')[0] || 'Untitled note'}`,
    );
    check.onchange = () => {
      const key = selectionKey(date, entry.id);
      if (check.checked) keys.add(key);
      else keys.delete(key);
      label.closest('.entry,.month-note')?.classList.toggle('bulk-selected', check.checked);
      updateBar();
    };
    label.append(check);
    return label;
  }
  window.addEventListener('dayline:account', () => {
    active = false;
    keys.clear();
    document.body.classList.remove('bulk-mode');
    api.refresh();
    updateBar();
  });
  window.addEventListener('dayline:entry-view', updateBar);
  window.addEventListener('dayline:notes-changed', updateBar);
  return {
    get active() {
      return active;
    },
    controls,
    checkbox,
    updateBar,
    isSelected: (date, id) => keys.has(selectionKey(date, id)),
    clear,
  };
}
