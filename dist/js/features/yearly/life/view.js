import { downloadText } from '../../../shared/download.js?v=a49de864b933';
import { categoryOptions, categoryLabel } from '../../notes/note-types.js?v=a49de864b933';
import { node } from '../../../shared/dom.js?v=a49de864b933';
import { dayKey } from '../../../shared/dates.js?v=a49de864b933';
import {
  GROUPS,
  SUGGESTIONS,
  SUPPORT,
  blankRow,
  defaults,
  readLife,
  resolveDate,
  parseList,
  planLifeRows,
} from './model.js?v=a49de864b933';
const button = (text, fn) => {
  const el = node('button', 'secondary', text);
  el.type = 'button';
  el.onclick = fn;
  return el;
};
export function createLifePlanner({
  getState,
  saveLife,
  planLife,
  openNote,
  now = () => new Date(),
}) {
  const element = node('div', 'life-planner'),
    status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  let data,
    expected = null,
    busy = false,
    dirty = false;
  const open = new Set();
  function load() {
    const saved = readLife(getState().days);
    data = structuredClone(saved.data);
    expected = saved.record?.text || null;
  }
  function save() {
    busy = true;
    dirty = true;
    try {
      const result = saveLife(data, expected);
      if (!result) {
        status.textContent = 'Could not save. Your entries are still here; try again.';
        return false;
      }
      expected = readLife(getState().days).record.text;
      dirty = false;
      status.textContent = 'Draft saved.';
      return true;
    } catch (error) {
      status.textContent = error.message;
      return false;
    } finally {
      busy = false;
    }
  }
  function field(
    parent,
    label,
    value,
    onInput,
    { type = 'text', placeholder = '', max = 200 } = {},
  ) {
    const wrap = node('label', 'life-field', label),
      input = node(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    else input.rows = 2;
    input.value = value;
    input.maxLength = max;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => onInput(input.value));
    wrap.append(input);
    parent.append(wrap);
    return input;
  }
  function select(parent, label, value, choices, onChange) {
    const wrap = node('label', 'life-field', label),
      input = node('select');
    input.setAttribute('aria-label', label);
    for (const [key, text] of choices) {
      const option = node('option', '', text);
      option.value = key;
      input.append(option);
    }
    input.value = value;
    input.onchange = () => onChange(input.value);
    wrap.append(input);
    parent.append(wrap);
    return input;
  }
  const frequencies = [
    ['none', 'No repeat'],
    ['daily', 'Daily'],
    ['weekly', 'Weekly'],
    ['monthly', 'Monthly'],
    ['annual', 'Annually'],
  ];
  function groupView(key) {
    const group = (data.groups[key] ||= {
      defaults: defaults(key, dayKey(now())),
      rows: [blankRow()],
    });
    const host = node('div', 'life-group'),
      shared = node('div', 'life-defaults'),
      rows = node('div', 'life-rows');
    const title = node('h4', '', GROUPS[key][0]);
    host.append(
      title,
      node(
        'p',
        'field-hint',
        'Shared defaults apply to every row. Leave time blank for an all-day reminder; Weekly Notes stay undated.',
      ),
    );
    const change = (k, v) => {
      group.defaults[k] = v;
      save();
      updateCount();
    };
    select(
      shared,
      'Destination',
      group.defaults.mode,
      [
        ['daily', 'Calendar date'],
        ['weekly', 'Weekly Notes'],
      ],
      (v) => {
        group.defaults.mode = v;
        if (v === 'weekly') group.defaults.frequency = 'none';
        save();
        draw();
      },
    );
    field(shared, 'Time (optional)', group.defaults.time, (v) => change('time', v), {
      type: 'time',
    });
    field(
      shared,
      'All-day reminder time (optional)',
      group.defaults.reminder,
      (v) => change('reminder', v),
      { type: 'time' },
    );
    const categoryChoices = categoryOptions(getState().days, getState().settings?.tags);
    if (group.defaults.tag)
      categoryChoices[group.defaults.tag] ||= categoryLabel(group.defaults.tag);
    select(
      shared,
      'Category',
      group.defaults.tag,
      [['', 'No category'], ...Object.entries(categoryChoices)],
      (v) => change('tag', v),
    );
    select(shared, 'Repeat', group.defaults.frequency, frequencies, (v) => change('frequency', v));
    field(shared, 'Repeat through', group.defaults.end, (v) => change('end', v), { type: 'date' });
    host.append(
      shared,
      node(
        'p',
        'field-hint',
        'Dayline evolves with you: repeat cycles always end. Review and recommit afterwards. All-day reminders do not reserve your timed availability. Reminder delivery also follows Settings.',
      ),
    );
    const suggestions = node('div', 'life-categories');
    for (const title of SUGGESTIONS[key])
      suggestions.append(
        button('＋ ' + title, () => {
          let index = group.rows.findIndex((row) => !Object.values(row).some((v) => v.trim()));
          if (index < 0) {
            if (group.rows.length >= 60) {
              status.textContent = 'Use up to 60 rows per list.';
              return;
            }
            group.rows.push(blankRow());
            index = group.rows.length - 1;
          }
          group.rows[index].title = title;
          save();
          drawRows();
          updateCount();
          rows.children[index]?.querySelector('[aria-label="Date"]')?.focus();
        }),
      );
    host.append(suggestions);
    const paste = node('details', 'life-paste'),
      pasteBox = node('textarea');
    pasteBox.rows = 3;
    pasteBox.setAttribute('aria-label', 'Paste a list');
    pasteBox.placeholder = 'Mom’s birthday — May 12\nAnniversary — September 8';
    paste.append(
      node('summary', '', 'Paste a list'),
      pasteBox,
      button('Turn list into rows', () => {
        try {
          const parsed = parseList(pasteBox.value);
          if (group.rows.filter((r) => r.title || r.date).length + parsed.length > 60)
            throw Error('Use up to 60 rows per list.');
          group.rows = [
            ...group.rows.filter((r) => Object.values(r).some((v) => v.trim())),
            ...parsed,
          ];
          save();
          draw();
        } catch (error) {
          status.textContent = error.message;
        }
      }),
      node(
        'p',
        'field-hint',
        'One item per line: title — date — optional 24-hour time. Review the rows before adding. Dates without a year mean the next occurrence.',
      ),
    );
    host.append(paste, rows);
    const result = node('div', 'life-plan-result'),
      submit = button('Add all to calendar', schedule);
    submit.className = 'primary';
    function updateCount() {
      const active = group.rows.filter((r) => Object.values(r).some((v) => v.trim())).length;
      const preview = planLifeRows(data, key, dayKey(now()));
      submit.textContent = `Add ${active || 'all'} ${active === 1 ? 'item' : 'items'} to ${group.defaults.mode === 'weekly' ? 'Weekly Notes' : 'calendar'}${active && !Object.keys(preview.errors).length ? ` (${preview.notes.length} notes)` : ''}`;
    }
    function appendRow(focus = false) {
      if (group.rows.length >= 60) {
        status.textContent = 'Use up to 60 rows per list.';
        return;
      }
      group.rows.push(blankRow());
      save();
      drawRows();
      if (focus) rows.lastElementChild?.querySelector('input')?.focus();
    }
    function drawRows(errors = {}) {
      rows.replaceChildren();
      group.rows.forEach((row, index) => {
        const item = node('div', 'life-row');
        item.dataset.row = String(index);
        const top = node('div', 'life-row-fields'),
          resolved = node('span', 'field-hint');
        const update = (k, v) => {
          row[k] = v;
          save();
          updateCount();
          if (k === 'date') showDate();
        };
        field(top, 'Name or occasion', row.title, (v) => update('title', v), {
          placeholder: key === 'occasions' ? 'Mom’s birthday' : 'What would you like to plan?',
        });
        const date = field(top, 'Date', row.date, (v) => update('date', v), {
          placeholder: 'May 12 or YYYY-MM-DD',
        });
        function showDate() {
          try {
            resolved.textContent = row.date ? `Next: ${resolveDate(row.date, dayKey(now()))}` : '';
          } catch {
            resolved.textContent = 'Choose a date before scheduling.';
          }
        }
        showDate();
        date.parentElement.append(resolved);
        field(top, 'Time override', row.time, (v) => update('time', v), { type: 'time' });
        top.append(
          button('Remove', () => {
            group.rows.splice(index, 1);
            if (!group.rows.length) group.rows.push(blankRow());
            save();
            drawRows();
            updateCount();
          }),
        );
        item.append(top);
        const extra = node('details', 'life-extra');
        extra.append(node('summary', '', 'Details & overrides'));
        if (key === 'payments')
          field(extra, 'Amount (optional)', row.amount || '', (v) => update('amount', v));
        field(extra, 'Body text', row.text, (v) => update('text', v), {
          type: 'textarea',
          max: 2000,
        });
        field(extra, 'Categories (comma separated)', row.tags, (v) => update('tags', v), {
          placeholder: 'Project, Event, or a custom category',
        });
        select(
          extra,
          'Repeat override',
          row.frequency,
          [['', 'Use shared default'], ...frequencies],
          (v) => update('frequency', v),
        );
        field(extra, 'End date override', row.end, (v) => update('end', v), { type: 'date' });
        item.append(extra);
        const error = node('p', 'activity-error', errors[index] || '');
        error.setAttribute('role', 'alert');
        item.append(error);
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
            event.preventDefault();
            if (index === group.rows.length - 1) appendRow(true);
            else rows.children[index + 1]?.querySelector('input')?.focus();
          }
        });
        rows.append(item);
      });
    }
    function schedule() {
      try {
        const plan = planLifeRows(data, key, dayKey(now()));
        if (Object.keys(plan.errors).length) {
          drawRows(plan.errors);
          status.textContent = 'Check the marked rows. Nothing has been added yet.';
          return;
        }
        busy = true;
        const saved = planLife(data, key, expected);
        if (!saved) {
          status.textContent = 'Could not save. Your entries are still here.';
          return;
        }
        load();
        status.textContent = `Added ${saved.count} ${saved.count === 1 ? 'note' : 'notes'}. Undo is available.`;
        draw();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = false;
      }
    }
    host.append(
      button('＋ Add another', () => appendRow(true)),
      submit,
      result,
    );
    drawRows();
    updateCount();
    return host;
  }
  let chosen = null;
  function draw() {
    element.replaceChildren();
    const make = node('details', 'settings-card life-section'),
      support = node('details', 'settings-card life-section');
    make.open = open.has('make');
    support.open = open.has('support');
    make.addEventListener('toggle', () => (make.open ? open.add('make') : open.delete('make')));
    support.addEventListener('toggle', () =>
      support.open ? open.add('support') : open.delete('support'),
    );
    make.append(
      node('summary', '', 'Make room for what matters'),
      node(
        'p',
        'field-hint',
        'People, care, commitments, and time worth protecting. Suggestions, not requirements.',
      ),
    );
    const tabs = node('div', 'life-categories'),
      panel = node('div');
    for (const [key, [label]] of Object.entries(GROUPS)) {
      const hidden = data.groups[key]?.hidden;
      const action = button(label, () => {
        chosen = key;
        if (hidden) data.groups[key].hidden = false;
        open.add('make');
        draw();
        panelFocus();
      });
      action.setAttribute('aria-pressed', String(chosen === key));
      if (hidden) continue;
      tabs.append(action);
    }
    const panelFocus = () => element.querySelector('.life-group .life-row input')?.focus();
    if (chosen) {
      panel.append(
        groupView(chosen),
        button('Hide this suggestion', () => {
          data.groups[chosen].hidden = true;
          save();
          chosen = null;
          draw();
        }),
      );
    }
    make.append(tabs, panel);
    if (Object.values(data.groups).some((g) => g.hidden))
      make.append(
        button('Show hidden suggestions', () => {
          for (const group of Object.values(data.groups)) group.hidden = false;
          save();
          draw();
        }),
      );
    if (data.links.length) {
      const links = node('details', 'life-links');
      links.append(node('summary', '', 'Recent planned notes'));
      for (const link of data.links.slice(-20).reverse()) {
        const entry = getState().days[link.date]?.find((n) => n.id === link.id);
        if (entry)
          links.append(
            button(
              `${link.date} · ${entry.weekly ? 'Week · ' : entry.allDay ? 'All day · ' : ''}${entry.title}`,
              () => openNote(link.date, entry),
            ),
          );
      }
      make.append(links);
    }
    support.append(
      node('summary', '', 'Keep life supported'),
      node(
        'p',
        'field-hint',
        'Practical foundations for a steadier everyday life. Choose what would help; nothing needs a completion score.',
      ),
      node(
        'p',
        'field-hint',
        'Record where to find important information, rather than passwords, account numbers or sensitive document contents.',
      ),
    );
    for (const [area, names] of Object.entries(SUPPORT)) {
      const section = node('details', 'life-support-group');
      section.open = open.has(area);
      section.addEventListener('toggle', () => (section.open ? open.add(area) : open.delete(area)));
      section.append(node('summary', '', area));
      for (const name of names) section.append(supportItem(name));
      support.append(section);
    }
    for (const name of Object.keys(data.support).filter((k) => k.startsWith('custom:')))
      support.append(supportItem(name));
    const custom = node('div', 'inline');
    const input = field(custom, 'Add your own support item', '', () => {}, { max: 90 });
    custom.append(
      button('Add item', () => {
        if (!input.value.trim()) return;
        const name = 'custom:' + input.value.trim();
        data.support[name] ||= { status: 'To consider', text: '' };
        save();
        open.add('support');
        draw();
      }),
    );
    support.append(custom);
    const recovery = node('details', 'life-recovery');
    recovery.append(
      node('summary', '', 'Saved lists & recovery'),
      button('Download list draft', () =>
        downloadText(JSON.stringify(data, null, 2), 'dayline-life-draft.json'),
      ),
      button('Reload saved lists (replaces this draft)', () => {
        dirty = false;
        load();
        draw();
        status.textContent = 'Loaded the latest saved lists.';
      }),
    );
    const versions = (getState().days['1900-01-01'] || [])
      .filter((n) => n.yearly?.kind === 'life')
      .sort((a, b) => b.yearly.updatedAt - a.yearly.updatedAt);
    if (versions.length > 1) {
      const others = node('details', 'life-versions');
      others.append(
        node('summary', '', 'Other saved versions'),
        node(
          'p',
          'field-hint',
          'Changes made separately were both kept. Review and copy any entries you want into your current lists.',
        ),
      );
      for (const record of versions.slice(1)) {
        const previous = JSON.parse(record.text),
          copy = node('div', 'life-version');
        copy.append(node('h4', '', new Date(record.yearly.updatedAt).toLocaleString()));
        for (const [key, group] of Object.entries(previous.groups)) {
          copy.append(node('h5', '', GROUPS[key][0]));
          for (const row of group.rows.filter((r) => r.title || r.text))
            copy.append(
              node(
                'p',
                'yearly-copy',
                [row.title, row.date, row.time, row.text].filter(Boolean).join(' · '),
              ),
            );
        }
        for (const [name, value] of Object.entries(previous.support))
          copy.append(
            node(
              'p',
              'yearly-copy',
              `${name.replace(/^custom:/, '')}: ${value.status} · ${value.text}`,
            ),
          );
        copy.append(
          button('Download this saved version', () =>
            downloadText(record.text, 'dayline-life-saved-version.json'),
          ),
        );
        others.append(copy);
      }
      recovery.append(others);
    }
    element.append(make, support, status, recovery);
  }
  function supportItem(name) {
    const item = node('details', 'life-support-item');
    item.append(node('summary', '', name.replace(/^custom:/, '')));
    const value = data.support[name] || { status: 'To consider', text: '' };
    const change = () => {
      data.support[name] = value;
      save();
    };
    select(
      item,
      'Status',
      value.status,
      ['To consider', 'In place', 'Revisit', 'Not relevant'].map((v) => [v, v]),
      (v) => {
        value.status = v;
        change();
      },
    );
    field(
      item,
      'Personal next step or reference',
      value.text,
      (v) => {
        value.text = v;
        change();
      },
      { max: 1000 },
    );
    const date = field(item, 'Plan for (optional)', '', () => {}, { type: 'date' });
    const add = (mode) => {
      try {
        const pending = structuredClone(data),
          key = 'other';
        pending.groups[key] = {
          defaults: { ...defaults(key, dayKey(now())), mode },
          rows: [
            {
              ...blankRow(),
              title: name.replace(/^custom:/, ''),
              text: value.text,
              date: date.value || dayKey(now()),
            },
          ],
        };
        busy = true;
        const result = planLife(pending, key, expected, data.groups.other || null);
        if (result) {
          load();
          status.textContent = 'Next step added. Undo is available.';
          draw();
        }
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = false;
      }
    };
    item.append(
      button('Add to calendar', () => add('daily')),
      button('Add to Weekly Notes', () => add('weekly')),
    );
    return item;
  }
  function refresh() {
    if (dirty || element.contains(document.activeElement)) return;
    try {
      load();
      draw();
    } catch (error) {
      status.textContent = error.message;
      element.replaceChildren(status);
    }
  }
  refresh();
  return {
    element,
    refresh,
    get busy() {
      return busy;
    },
    get active() {
      return element.contains(document.activeElement);
    },
    reset() {
      chosen = null;
      dirty = false;
      open.clear();
      load();
      draw();
    },
  };
}
