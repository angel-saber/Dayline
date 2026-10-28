import { node } from '../../shared/dom.js?v=e3a1bdfe567b';
import { offsetDay, parseDay } from '../../shared/dates.js?v=e3a1bdfe567b';
import { cycleEnd, repeatDates } from './model.js?v=e3a1bdfe567b';
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
      weekdays: [...weekdays.querySelectorAll('input')]
        .filter((input) => input.checked)
        .map((input) => Number(input.value)),
    };
  }
  function update() {
    weekdays.hidden = frequency.value !== 'weekdays';
    amount.parentElement.hidden = duration.value === 'date';
    amount.required = duration.value !== 'date';
    end.parentElement.hidden = duration.value !== 'date';
    end.hidden = duration.value !== 'date';
    end.required = duration.value === 'date';
    end.min = start.value;
    try {
      const value = rule(),
        dates = repeatDates(value),
        added = dates.filter((date) => date !== source).length;
      submit.disabled = !added;
      preview.textContent = `${added} new ${added === 1 ? 'note' : 'notes'}, ending ${value.end}. The existing note is kept. Duration includes the start date. Monthly repeats use the last available day when needed.`;
    } catch (error) {
      preview.textContent = error.message;
      submit.disabled = true;
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
    node(
      'p',
      'field-hint',
      'Each occurrence is an independent note at the same time, with the same formatting, tags, and attachment references. Completion and reports start fresh. Editing or deleting one occurrence does not change the others.',
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
