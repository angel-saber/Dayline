import { usFederalHolidays, HOLIDAY_SOURCE } from './holidays.js?v=ac12573d358a';
import { hourInput, inputMinute } from '../settings/available-hours.js?v=ac12573d358a';
import { node } from '../../shared/dom.js?v=ac12573d358a';
import { offsetDay, parseDay } from '../../shared/dates.js?v=ac12573d358a';
import { cycleEnd, repeatDates, repeatPlan } from './model.js?v=ac12573d358a';
const button = (text, action, cls = 'secondary') => {
  const el = node('button', cls, text);
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
};
export function openRepeatCycle({ source, note, apply }) {
  const dialog = node('dialog', 'repeat-dialog');
  dialog.setAttribute('aria-labelledby', 'repeat-heading');
  const heading = node('h2', '', 'Commit to a repeat cycle');
  heading.id = 'repeat-heading';
  const form = node('form');
  const frequency = node('select');
  frequency.setAttribute('aria-label', 'Repeat frequency');
  for (const [value, text] of [
    ['daily', 'Daily'],
    ['weekly', 'Weekly'],
    ['monthly', 'Monthly'],
    ['weekdays', 'Specific weekdays'],
  ]) {
    const option = node('option', '', text);
    option.value = value;
    frequency.append(option);
  }
  const start = node('input');
  start.type = 'date';
  start.required = true;
  start.value = source;
  start.setAttribute('aria-label', 'Repeat start date');
  const weekdays = node('fieldset', 'repeat-weekdays');
  weekdays.hidden = true;
  weekdays.append(node('legend', '', 'Repeat on'));
  for (const [day, text] of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].entries()) {
    const label = node('label', '', text),
      input = node('input');
    input.type = 'checkbox';
    input.value = day;
    input.checked = day === parseDay(source).getDay();
    label.prepend(input);
    weekdays.append(label);
  }
  const duration = node('select');
  duration.setAttribute('aria-label', 'Repeat duration');
  for (const [value, text] of [
    ['days', 'Days'],
    ['weeks', 'Weeks'],
    ['months', 'Months'],
    ['date', 'Custom end date'],
  ]) {
    const option = node('option', '', text);
    option.value = value;
    duration.append(option);
  }
  duration.value = 'weeks';
  const amount = node('input');
  amount.type = 'number';
  amount.min = '1';
  amount.max = '12000';
  amount.step = '1';
  amount.value = '1';
  amount.required = true;
  amount.setAttribute('aria-label', 'Repeat duration amount');
  const end = node('input');
  end.type = 'date';
  end.value = offsetDay(source, 6);
  end.hidden = true;
  end.setAttribute('aria-label', 'Repeat end date');
  const label = (text, input) => {
    const el = node('label', '', text);
    el.append(input);
    return el;
  };
  const fields = node('div', 'repeat-fields');
  fields.append(
    label('Frequency', frequency),
    label('Start date', start),
    label('Duration', duration),
    label('How many?', amount),
    label('Custom end date', end),
  );
  const exceptions = {};
  let reviewPage = 0;
  const review = node('section', 'repeat-review');
  review.setAttribute('aria-label', 'Review individual repeat notes');
  const holidayHelp = node(
    'p',
    'field-hint',
    'Flags show annual U.S. federal holidays and standard observed dates from 2021 onward, using current rules. State/local holidays, special closures, and Inauguration Day are not included.',
  );
  const holidaySource = node('a', '', 'Check the official OPM calendar');
  holidaySource.href = HOLIDAY_SOURCE;
  holidaySource.target = '_blank';
  holidaySource.rel = 'noopener noreferrer';
  holidayHelp.append(document.createTextNode(' '), holidaySource);
  const preview = node('p', 'repeat-preview');
  preview.setAttribute('aria-live', 'polite');
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  const submit = node('button', 'primary', 'Create repeat cycle');
  submit.type = 'submit';
  function rule() {
    return {
      start: start.value,
      end: cycleEnd(start.value, duration.value, Number(amount.value), end.value),
      frequency: frequency.value,
      exceptions,
      weekdays: [...weekdays.querySelectorAll('input')]
        .filter((input) => input.checked)
        .map((input) => Number(input.value)),
    };
  }
  function counts() {
    try {
      const value = rule(),
        plan = repeatPlan(value, source);
      const holidays = plan.filter((item) => usFederalHolidays(item.date).length).length;
      submit.disabled = !plan.length;
      preview.textContent = `${plan.length} new ${plan.length === 1 ? 'note' : 'notes'}, ending ${value.end}. ${holidays} on U.S. federal holiday dates. The existing note is kept. Duration includes the start date. Monthly repeats use the last available day when needed.`;
    } catch (error) {
      preview.textContent = error.message;
      submit.disabled = true;
    }
  }
  function reviewRows(value) {
    review.replaceChildren(node('h3', '', 'Review, adjust, or skip occurrences'));
    const dates = repeatDates(value).filter((date) => date !== source);
    if (!dates.length) {
      review.append(
        node(
          'p',
          'field-hint',
          'Extend the duration or choose another start date to add new occurrences.',
        ),
      );
      return;
    }
    reviewPage = Math.max(0, Math.min(reviewPage, Math.ceil(dates.length / 25) - 1));
    review.append(
      node(
        'p',
        'field-hint',
        `Showing ${reviewPage * 25 + 1}–${Math.min(dates.length, (reviewPage + 1) * 25)} of ${dates.length}. Expand a date to edit its note. Body edits reset that occurrence’s text formatting.`,
      ),
    );
    for (const original of dates.slice(reviewPage * 25, (reviewPage + 1) * 25)) {
      const change = exceptions[original] || {},
        row = node('details', 'repeat-occurrence'),
        summary = node('summary');
      row.dataset.occurrence = original;
      const heading = node('span');
      const describe = () => {
        const date = exceptions[original]?.date || original;
        heading.textContent =
          date +
          (usFederalHolidays(date).length ? ' · ' + usFederalHolidays(date).join(', ') : '') +
          (exceptions[original]?.skip ? ' · Skipped' : '');
      };
      describe();
      summary.append(heading);
      row.append(summary);
      const include = node('input');
      include.type = 'checkbox';
      include.checked = !change.skip;
      include.setAttribute('aria-label', `Include occurrence ${original}`);
      const includeLabel = node('label', '', ' Include this occurrence');
      includeLabel.prepend(include);
      row.append(includeLabel);
      const edit = (key, input, read = () => input.value) => {
        input.addEventListener('input', () => {
          exceptions[original] = { ...exceptions[original], [key]: read() };
          describe();
          counts();
        });
      };
      include.addEventListener('change', () => {
        exceptions[original] = { ...exceptions[original], skip: !include.checked };
        for (const field of row.querySelectorAll('input:not([type="checkbox"]),textarea'))
          field.disabled = !include.checked;
        describe();
        counts();
      });
      const date = node('input');
      date.type = 'date';
      date.value = change.date || original;
      date.min = value.start;
      date.max = value.end;
      date.required = true;
      date.setAttribute('aria-label', `Date for occurrence ${original}`);
      edit('date', date);
      const time = node('input');
      time.type = 'time';
      time.value = hourInput(change.minute ?? note.minute);
      time.required = true;
      time.setAttribute('aria-label', `Time for occurrence ${original}`);
      edit('minute', time, () => inputMinute(time.value));
      const title = node('input');
      title.value = change.title ?? note.title ?? '';
      title.maxLength = 200;
      title.setAttribute('aria-label', `Title for occurrence ${original}`);
      edit('title', title);
      const text = node('textarea');
      text.rows = 3;
      text.value = change.text ?? note.text;
      text.setAttribute('aria-label', `Text for occurrence ${original}`);
      edit('text', text);
      for (const field of [date, time, title, text]) field.disabled = !!change.skip;
      row.append(
        label('Date', date),
        label('Time', time),
        label('Title', title),
        label('Note text', text),
      );
      review.append(row);
    }
    const nav = node('div', 'inline');
    if (reviewPage > 0)
      nav.append(
        button('Previous occurrences', () => {
          reviewPage--;
          reviewRows(rule());
        }),
      );
    if ((reviewPage + 1) * 25 < dates.length)
      nav.append(
        button('Next occurrences', () => {
          reviewPage++;
          reviewRows(rule());
        }),
      );
    review.append(nav);
  }
  function update(event) {
    if (event && review.contains(event.target)) return;
    weekdays.hidden = frequency.value !== 'weekdays';
    amount.parentElement.hidden = duration.value === 'date';
    amount.required = duration.value !== 'date';
    end.parentElement.hidden = duration.value !== 'date';
    end.hidden = duration.value !== 'date';
    end.required = duration.value === 'date';
    end.min = start.value;
    counts();
    try {
      reviewRows(rule());
    } catch {
      review.replaceChildren();
    }
  }
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      if (apply(rule()) !== false) dialog.close();
      else status.textContent = 'Could not save this cycle. No notes were added; please try again.';
    } catch (error) {
      status.textContent = error.message;
    }
  });
  const actions = node('div', 'inline');
  actions.append(
    submit,
    button('Cancel', () => dialog.close()),
  );
  form.append(
    heading,
    node('p', '', note.title || note.text.split('\n')[0] || 'Untitled note'),
    node(
      'p',
      'repeat-philosophy',
      'Your calendar is ever-changing and evolves with you. Dayline doesn’t repeat notes forever: every cycle has a definite end date. When it ends, reflect and recommit by creating a new repeat cycle.',
    ),
    fields,
    weekdays,
    preview,
    holidayHelp,
    review,
    node(
      'p',
      'field-hint',
      'Occurrences remain linked to this finite cycle. Later edits and deletions offer Only this note or This and later repeats. Individual adjustments here apply only to that occurrence. Completion and reports start fresh.',
    ),
    status,
    actions,
  );
  dialog.append(form);
  document.body.append(dialog);
  update();
  const onAccount = () => dialog.close();
  window.addEventListener('dayline:account', onAccount);
  dialog.addEventListener(
    'close',
    () => {
      window.removeEventListener('dayline:account', onAccount);
      dialog.remove();
    },
    { once: true },
  );
  dialog.showModal();
  return dialog;
}
