import { node } from '../../shared/dom.js?v=ac12573d358a';
import { dayKey } from '../../shared/dates.js?v=ac12573d358a';
import {
  validYearly,
  DIMENSIONS,
  SEASONS,
  yearPosition,
  yearRecords,
  linkedNotes,
} from './model.js?v=ac12573d358a';

const button = (text, action, className = 'secondary') => {
  const item = node('button', className, text);
  item.type = 'button';
  item.onclick = action;
  return item;
};
const names = ['', 'January–March', 'April–June', 'July–September', 'October–December'];
export function setupYearly({
  root,
  getState,
  saveRecord,
  planStep,
  carry,
  openNote,
  openCompass,
  toast,
  now = () => new Date(),
}) {
  let year = now().getFullYear(),
    renderedYear = null,
    context = null;
  const dialog = node('dialog', 'activity-dialog yearly-dialog');
  dialog.setAttribute('aria-labelledby', 'yearly-dialog-heading');
  document.body.append(dialog);
  const storedSeasons = () => {
    try {
      return localStorage.getItem('dayline.yearly-seasons.v1') !== 'off';
    } catch {
      return true;
    }
  };
  let seasons = storedSeasons();
  function modal(title, build) {
    dialog.replaceChildren();
    const header = node('div', 'activity-header'),
      heading = node('h2', '', title);
    heading.id = 'yearly-dialog-heading';
    header.append(
      heading,
      button('Close', () => dialog.close()),
    );
    const form = node('form', 'yearly-form'),
      error = node('p', 'activity-error');
    error.setAttribute('role', 'alert');
    dialog.append(header, form, error);
    const submit = build(form, (message) => {
      error.textContent = message;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      error.textContent = '';
      try {
        if (submit() !== false) dialog.close();
      } catch (err) {
        error.textContent = err.message;
      }
    });
    if (!dialog.open) dialog.showModal();
  }
  function field(
    form,
    label,
    value = '',
    { type = 'textarea', hint = '', required = false, limit = 20000 } = {},
  ) {
    const wrap = node('label', 'yearly-field', label),
      input = node(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    else input.rows = 3;
    input.value = value;
    input.required = required;
    input.maxLength = limit;
    input.setAttribute('aria-label', label);
    wrap.append(input);
    if (hint) wrap.append(node('span', 'field-hint', hint));
    form.append(wrap);
    return input;
  }
  function select(form, label, options, value) {
    const wrap = node('label', 'yearly-field', label),
      input = node('select');
    input.setAttribute('aria-label', label);
    for (const [key, text] of options) {
      const option = node('option', '', text);
      option.value = key;
      input.append(option);
    }
    input.value = String(value);
    wrap.append(input);
    form.append(wrap);
    return input;
  }
  function submitButton(form, text) {
    const b = node('button', 'primary', text);
    b.type = 'submit';
    form.append(b);
  }
  function checkFresh(record) {
    if (!record) return;
    const current = yearRecords(getState().days, year).find((note) => note.id === record.id);
    if (
      !current ||
      JSON.stringify({
        title: current.title,
        text: current.text,
        yearly: validYearly(current.yearly),
      }) !==
        JSON.stringify({
          title: record.title,
          text: record.text,
          yearly: validYearly(record.yearly),
        })
    )
      throw new Error(
        'This item changed on another device or tab. Close and reopen it to keep the latest version.',
      );
  }
  function edit(kind, quarter, record = null) {
    const base = structuredClone(record),
      meta = record?.yearly || { year, quarter, kind };
    modal(
      kind === 'intention'
        ? record
          ? 'Reshape intention'
          : 'Add an intention'
        : kind === 'quarter'
          ? `Q${quarter} · Direction and memories`
          : kind === 'direction'
            ? 'Make room for what matters'
            : 'What I’m taking forward',
      (form, error) => {
        let title, text, dimension, nextStep, reflection, keep;
        if (kind === 'intention' || kind === 'quarter')
          title = field(
            form,
            kind === 'intention' ? 'Intention' : 'Quarter theme (optional)',
            record?.title || '',
            { type: 'text', required: kind === 'intention', limit: 200 },
          );
        const prompt =
          kind === 'direction'
            ? 'What would you like to make room for this year?'
            : kind === 'quarter'
              ? 'What deserves your attention during this part of the year?'
              : kind === 'reflection'
                ? 'What mattered, what changed, and what will you carry forward or leave behind?'
                : 'Supporting notes (optional)';
        text = field(form, prompt, record?.text || '', {
          hint:
            kind === 'direction'
              ? 'An experience, a change, a little more rest—one sentence is enough. You can revise this anytime.'
              : '',
        });
        if (kind === 'intention') {
          dimension = select(
            form,
            'Life dimension (optional)',
            [
              ['', 'No dimension'],
              ...DIMENSIONS.map((key) => [key, key[0].toUpperCase() + key.slice(1)]),
            ],
            meta.dimension || '',
          );
          nextStep = field(form, 'A possible next step (optional)', meta.nextStep || '');
        }
        if (kind === 'quarter')
          reflection = field(form, 'What I want to remember', meta.reflection || '', {
            hint: 'Experiences, changes, lessons, small wins, or anything that mattered.',
          });
        if (kind === 'direction' && record?.text) {
          const label = node('label', 'summary-setting-toggle');
          keep = node('input');
          keep.type = 'checkbox';
          keep.checked = true;
          label.append(keep, document.createTextNode('Keep previous version'));
          form.append(label);
        }
        submitButton(form, 'Save');
        return () => {
          checkFresh(base);
          const history = [...(meta.history || [])];
          if (keep?.checked && base.text !== text.value) {
            if (history.length >= 100)
              throw new Error(
                'You have 100 previous directions. Uncheck “Keep previous version” to save without adding another.',
              );
            history.push({ text: base.text, at: Date.now() });
          }
          const result = saveRecord({
            ...(base ? { id: base.id } : {}),
            title: title
              ? title.value
              : kind === 'direction'
                ? 'Annual direction'
                : 'What I’m taking forward',
            text: text.value,
            yearly: {
              ...meta,
              dimension: dimension?.value ?? meta.dimension ?? '',
              nextStep: nextStep?.value ?? meta.nextStep ?? '',
              reflection: reflection?.value ?? meta.reflection ?? '',
              history,
            },
          });
          if (!result) {
            error(
              'Could not save. Your draft is still here; try again or download a backup in Settings.',
            );
            return false;
          }
          return true;
        };
      },
    );
  }
  function alter(record, values) {
    try {
      checkFresh(record);
      if (saveRecord({ ...record, yearly: { ...record.yearly, ...values } })) {
        if (values.status === 'active') context = record.id;
        render();
        if (values.status)
          toast(
            values.status === 'released'
              ? 'Set aside. It stays here whenever you want to return.'
              : 'Intention restored.',
          );
      }
    } catch (error) {
      toast(error.message);
    }
  }
  function move(record) {
    modal('Move this intention', (form, error) => {
      form.append(
        node(
          'p',
          'field-hint',
          'Move the original card and its notes to another quarter. Already planned next steps keep their dates.',
        ),
      );
      const target = select(
        form,
        'Quarter',
        [1, 2, 3, 4].map((q) => [String(q), `Q${q} · ${names[q]}`]),
        record.yearly.quarter,
      );
      submitButton(form, 'Move intention');
      return () => {
        checkFresh(record);
        if (
          !saveRecord({ ...record, yearly: { ...record.yearly, quarter: Number(target.value) } })
        ) {
          error('Could not save this move.');
          return false;
        }
        context = record.id;
        toast(`Intention moved to Q${target.value}.`);
        return true;
      };
    });
  }
  function nextStep(record) {
    modal('Plan a next step', (form, error) => {
      form.append(node('p', 'yearly-context', `For: ${record.title}`));
      const mode = select(
        form,
        'Destination',
        [
          ['weekly', 'Weekly Note'],
          ['daily', 'Dated note'],
        ],
        'weekly',
      );
      const date = field(form, 'Date / week containing', dayKey(now()), {
        type: 'date',
        required: true,
      });
      const time = field(form, 'Time', '09:00', { type: 'time' });
      const updateMode = () => {
        time.parentElement.hidden = mode.value !== 'daily';
        time.required = mode.value === 'daily';
      };
      mode.onchange = updateMode;
      updateMode();
      const title = field(
        form,
        'Next-step title',
        record.yearly.nextStep.slice(0, 200) || record.title,
        { type: 'text', required: true, limit: 200 },
      );
      const text = field(form, 'Notes (optional)', '', {
        hint: 'This creates one linked note. It does not complete the intention or fill other dates.',
      });
      submitButton(form, 'Add next step');
      form.append(
        button('Open Monthly Compass instead', () => {
          const seed = {
            id: record.id,
            year: record.yearly.year,
            title: record.title,
            text: record.text,
            dimension: record.yearly.dimension,
          };
          dialog.close();
          openCompass(seed);
        }),
      );
      return () => {
        checkFresh(record);
        if (
          !planStep(record, {
            mode: mode.value,
            date: date.value,
            time: time.value,
            title: title.value,
            text: text.value,
          })
        ) {
          error('Could not save the next step.');
          return false;
        }
        return true;
      };
    });
  }
  function carryReview() {
    const records = yearRecords(getState().days, year).filter(
      (note) => note.yearly.kind === 'intention',
    );
    modal(`Bring intentions into ${year + 1}`, (form, error) => {
      form.append(
        node(
          'p',
          'field-hint',
          `Choose only what still fits. Selected intentions become new cards in Q1 of ${year + 1}; this year and its scheduled notes remain intact. Nothing is selected or carried forward automatically.`,
        ),
      );
      const choices = [];
      for (const record of records) {
        const label = node('label', 'summary-setting-toggle'),
          input = node('input');
        input.type = 'checkbox';
        label.append(
          input,
          document.createTextNode(
            record.title + (record.yearly.status === 'released' ? ' (set aside)' : ''),
          ),
        );
        choices.push([record.id, input]);
        form.append(label);
      }
      if (!records.length)
        form.append(node('p', '', 'There are no intentions to bring forward yet.'));
      submitButton(form, 'Create selected intentions');
      return () => {
        const ids = choices.filter(([, input]) => input.checked).map(([id]) => id);
        if (!ids.length) {
          error('Select at least one intention.');
          return false;
        }
        for (const record of records.filter((note) => ids.includes(note.id))) checkFresh(record);
        if (!carry(year, ids)) {
          error('Could not bring these intentions forward.');
          return false;
        }
        toast(`Selected intentions are ready in ${year + 1}.`);
        return true;
      };
    });
  }
  function intention(record) {
    const card = node('article', 'yearly-intention');
    card.dataset.intentionId = record.id;
    card.append(node('h4', '', record.title));
    if (record.yearly.dimension) card.append(node('span', 'eyebrow', record.yearly.dimension));
    if (record.text) card.append(node('p', 'yearly-copy', record.text));
    if (record.yearly.nextStep)
      card.append(node('p', 'yearly-copy', `Possible next step: ${record.yearly.nextStep}`));
    const actions = node('div', 'yearly-actions');
    actions.append(
      button(
        record.yearly.status === 'released' ? 'Continue' : 'Continue / plan a next step',
        () =>
          record.yearly.status === 'released'
            ? alter(record, { status: 'active' })
            : nextStep(record),
      ),
      button('Reshape', () => edit('intention', record.yearly.quarter, record)),
      button('Move', () => move(record)),
      button(record.yearly.status === 'released' ? 'Keep set aside' : 'Release', () => {
        if (record.yearly.status !== 'released') alter(record, { status: 'released' });
      }),
    );
    if (record.yearly.status === 'released') actions.lastElementChild.remove();
    card.append(actions);
    const linked = linkedNotes(getState().days, record);
    if (linked.length) {
      const details = node('details', 'yearly-linked');
      details.append(node('summary', '', 'Planned next steps'));
      for (const { date, entry } of linked)
        details.append(
          button(
            `${entry.weekly ? 'Week of ' : ''}${date} · ${entry.title || 'Untitled note'}${entry.done ? ' · completed' : ''}`,
            () => openNote(date, entry),
          ),
        );
      card.append(details);
    }
    return card;
  }
  function otherVersions(container, records, chosen) {
    if (!chosen) return;
    const others = records.filter(
      (note) =>
        note.id !== chosen.id &&
        note.yearly.kind === chosen.yearly.kind &&
        note.yearly.quarter === chosen.yearly.quarter,
    );
    if (!others.length) return;
    const versions = node('details', 'yearly-saved-versions');
    versions.append(
      node('summary', '', 'Other saved versions'),
      node(
        'p',
        'field-hint',
        'Changes made separately were both kept. Review them and choose which to show here; neither version is deleted.',
      ),
    );
    for (const record of others) {
      const item = node('section', 'yearly-intention');
      item.append(node('h4', '', record.title), node('p', 'yearly-copy', record.text));
      if (record.yearly.reflection) item.append(node('p', 'yearly-copy', record.yearly.reflection));
      item.append(button('Use this saved version', () => alter(record, {})));
      versions.append(item);
    }
    container.append(versions);
  }
  function render() {
    if (dialog.open) return;
    const open =
      renderedYear === year
        ? new Set(
            [...root.querySelectorAll('.yearly-quarter[open]')].map((el) =>
              Number(el.dataset.quarter),
            ),
          )
        : null;
    const reflectionOpen = renderedYear === year && root.querySelector('.yearly-reflection')?.open;
    renderedYear = year;
    const position = yearPosition(year, now()),
      records = yearRecords(getState().days, year),
      direction = records.find((note) => note.yearly.kind === 'direction');
    root.replaceChildren();
    const header = node('div', 'yearly-header'),
      heading = node('h1', '', String(year));
    heading.id = 'yearly-heading';
    const prev = button('←', () => {
        year--;
        render();
      }),
      next = button('→', () => {
        year++;
        render();
      });
    prev.setAttribute('aria-label', 'Previous year');
    next.setAttribute('aria-label', 'Next year');
    prev.disabled = year <= 1900;
    next.disabled = year >= 9998;
    header.append(prev, heading, next);
    root.append(header, node('p', 'intro', 'There is room to choose what comes next.'));
    const bar = node('progress', 'yearly-time');
    bar.max = position.total;
    bar.value = position.elapsed;
    bar.setAttribute('aria-label', `Time elapsed in ${year}; not a measure of accomplishment`);
    root.append(
      bar,
      node(
        'p',
        'field-hint',
        year === now().getFullYear()
          ? `${now().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} · ${position.remaining} days remaining (including today)`
          : year > now().getFullYear()
            ? `${position.total} days ahead · explore only as far as you want.`
            : 'A year to revisit, without anything to catch up on.',
      ),
    );
    const welcome =
      position.currentQuarter === 1
        ? 'What would you like to make room for?'
        : position.currentQuarter === 4
          ? 'What would make the remaining weeks meaningful?'
          : position.currentQuarter
            ? 'Start with the part of the year you’re in.'
            : 'Keep what still fits. Change what doesn’t.';
    root.append(
      node('p', 'yearly-invitation', welcome),
      node(
        'p',
        'field-hint',
        'Keep what still fits. Change what doesn’t. Past quarters can stay empty, and future plans can wait.',
      ),
    );
    const annual = node('section', 'settings-card yearly-direction');
    annual.append(
      node('h2', '', 'Your direction (optional)'),
      node(
        'p',
        'yearly-copy',
        direction?.text ||
          'An experience, a change, a little more rest. Start here, or go straight to the current quarter.',
      ),
      button(direction ? 'Revise direction' : 'Add a direction', () =>
        edit('direction', 0, direction),
      ),
    );
    if (direction?.yearly.history.length) {
      const history = node('details');
      history.append(node('summary', '', 'Previous directions'));
      for (const item of [...direction.yearly.history].reverse())
        history.append(
          node('p', 'yearly-copy', `${new Date(item.at).toLocaleDateString()} · ${item.text}`),
        );
      annual.append(history);
    }
    otherVersions(annual, records, direction);
    root.append(annual);
    const seasonLabel = node('label', 'summary-setting-toggle'),
      seasonCheck = node('input');
    seasonCheck.type = 'checkbox';
    seasonCheck.checked = seasons;
    seasonLabel.append(
      seasonCheck,
      document.createTextNode('Show seasonal labels (Northern Hemisphere)'),
    );
    seasonCheck.onchange = () => {
      try {
        localStorage.setItem('dayline.yearly-seasons.v1', seasonCheck.checked ? 'on' : 'off');
        seasons = seasonCheck.checked;
        render();
      } catch {
        seasonCheck.checked = seasons;
        toast('Could not save seasonal label preference.');
      }
    };
    root.append(seasonLabel);
    for (let quarter = 1; quarter <= 4; quarter++) {
      const section = node('details', 'yearly-quarter');
      section.dataset.quarter = String(quarter);
      section.open = open ? open.has(quarter) : position.currentQuarter === quarter;
      const data = records.find(
          (note) => note.yearly.kind === 'quarter' && note.yearly.quarter === quarter,
        ),
        title = node('summary');
      title.append(
        node('span', '', `Q${quarter}${seasons ? ' · ' + SEASONS[quarter - 1] : ''}`),
        node(
          'span',
          'field-hint',
          `${names[quarter]}${data?.title ? ' · ' + data.title : ''}${position.currentQuarter === quarter ? ' · Current quarter' : ''}`,
        ),
      );
      section.append(title);
      const body = node('div', 'yearly-quarter-body');
      body.append(
        node('h3', '', 'Direction'),
        node(
          'p',
          'yearly-copy',
          data?.text || 'What deserves your attention here? Leave this blank until it is useful.',
        ),
        button('Edit direction and memories', () => edit('quarter', quarter, data)),
        node('h3', '', 'Possibilities'),
        node(
          'p',
          'field-hint',
          'One to three intentions can be enough. Rest, recovery, and exploration belong here too.',
        ),
      );
      const intentions = records.filter(
        (note) => note.yearly.kind === 'intention' && note.yearly.quarter === quarter,
      );
      for (const record of intentions.filter((note) => note.yearly.status === 'active'))
        body.append(intention(record));
      body.append(button('Add an intention', () => edit('intention', quarter)));
      const released = intentions.filter((note) => note.yearly.status === 'released');
      if (released.length) {
        const aside = node('details', 'yearly-aside');
        aside.append(
          node('summary', '', 'Set aside'),
          node('p', 'field-hint', 'These can rest here. Return to them only if they fit again.'),
        );
        for (const record of released) aside.append(intention(record));
        body.append(aside);
      }
      body.append(
        node('h3', '', 'What I want to remember'),
        node(
          'p',
          'yearly-copy',
          data?.yearly.reflection ||
            'Experiences, changes, lessons, or anything that mattered. No backfilling needed.',
        ),
      );
      otherVersions(body, records, data);
      section.append(body);
      root.append(section);
    }
    const reflection = records.find((note) => note.yearly.kind === 'reflection'),
      end = node('details', 'yearly-quarter yearly-reflection');
    end.open = !!reflectionOpen;
    end.append(node('summary', '', 'What I’m taking forward'));
    const endBody = node('div', 'yearly-quarter-body');
    endBody.append(
      node(
        'p',
        'yearly-copy',
        reflection?.text ||
          'What mattered more than expected? What changed? What will you carry forward, or leave behind? Available whenever you want to reflect.',
      ),
      button('Write a reflection', () => edit('reflection', 0, reflection)),
      button('Bring selected intentions into next year', carryReview),
    );
    otherVersions(endBody, records, reflection);
    end.append(endBody);
    root.append(end);
    if (context) {
      const target = root.querySelector(`[data-intention-id="${CSS.escape(context)}"]`);
      if (target) {
        target.closest('.yearly-quarter').open = true;
        const aside = target.closest('.yearly-aside');
        if (aside) aside.open = true;
        target.scrollIntoView?.({ block: 'center' });
      }
      context = null;
    }
  }
  dialog.addEventListener('close', render);
  window.addEventListener('dayline:notes-changed', () => {
    if (!root.hidden) render();
  });
  window.addEventListener('dayline:account', () => {
    dialog.close();
    renderedYear = null;
    year = now().getFullYear();
    root.replaceChildren();
    if (!root.hidden) render();
  });
  window.addEventListener('focus', () => {
    if (!root.hidden) render();
  });
  return {
    show(source) {
      if (source) {
        year = source.year;
        context = source.id;
      }
      render();
    },
    render,
  };
}
