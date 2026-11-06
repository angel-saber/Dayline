import { node } from '../../shared/dom.js?v=f7bbc01b5bdc';
import { hourInput, inputMinute } from './available-hours.js?v=f7bbc01b5bdc';
export const AWAKE_HOURS_KEY = 'dayline.awake-hours.v1';
export const AWAKE_HOURS_EVENT = 'dayline:awake-hours';
export const DEFAULT_AWAKE_HOURS = Object.freeze({ from: 420, to: 1380 });
export function validAwakeHours(value) {
  if (
    !value ||
    !Number.isInteger(value.from) ||
    value.from < 0 ||
    value.from >= 1440 ||
    !Number.isInteger(value.to) ||
    value.to < 0 ||
    value.to >= 1440
  )
    throw Error('Choose valid wake and sleep times.');
  return { from: value.from, to: value.to };
}
export function readAwakeHours(storage = localStorage) {
  try {
    return validAwakeHours(
      JSON.parse(storage.getItem(AWAKE_HOURS_KEY) || JSON.stringify(DEFAULT_AWAKE_HOURS)),
    );
  } catch {
    return { ...DEFAULT_AWAKE_HOURS };
  }
}
export function awakeMinutes(hours) {
  const h = validAwakeHours(hours);
  return (h.to - h.from + 1440) % 1440 || 1440;
}
export function isAwake(minute, hours) {
  const h = validAwakeHours(hours);
  return (
    h.from === h.to ||
    (h.from < h.to ? minute >= h.from && minute < h.to : minute >= h.from || minute < h.to)
  );
}
export function commitmentAllocation(items, timing) {
  return items.reduce(
    (sum, item) =>
      sum + item.minutes + (item.breakMinutes ?? (timing.autoBreak ? timing.breakMinutes : 0)),
    0,
  );
}
export function assertCommitmentBudget(previous, next, hours, timing) {
  const before = commitmentAllocation(previous, timing),
    after = commitmentAllocation(next, timing),
    budget = awakeMinutes(hours);
  if (after > budget && after > before)
    throw Error(
      `This would use ${after} of ${budget} awake minutes, including breaks. Adjust Awake Hours in Settings if appropriate, or shorten existing commitments before adding more.`,
    );
  return after;
}
export function setupAwakeHours({ root, toast, storage = localStorage }) {
  const card = node('section', 'settings-card');
  card.id = 'awake-hours-settings';
  const heading = node('h2', '', 'Awake Hours');
  heading.tabIndex = -1;
  card.append(
    heading,
    node(
      'p',
      '',
      'Separate from Available Hours: the part of your day you expect to be awake. Daily Commitments and their configured breaks must fit within this time. Overnight ranges are supported; equal times mean a full 24-hour span. This preference is saved on this device.',
    ),
  );
  const form = node('form', 'awake-hours-fields');
  const saved = readAwakeHours(storage);
  function field(text, value) {
    const label = node('label', '', text),
      input = node('input');
    input.type = 'time';
    input.required = true;
    input.value = hourInput(value);
    input.setAttribute('aria-label', text);
    label.append(input);
    form.append(label);
    return input;
  }
  const from = field('Wake time', saved.from),
    to = field('Sleep time', saved.to),
    status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  const save = node('button', 'primary', 'Save Awake Hours');
  save.type = 'submit';
  form.append(save, status);
  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      const next = validAwakeHours({ from: inputMinute(from.value), to: inputMinute(to.value) });
      storage.setItem(AWAKE_HOURS_KEY, JSON.stringify(next));
      status.textContent = `Awake Hours saved · ${awakeMinutes(next)} minutes per day. Existing commitments were kept.`;
      window.dispatchEvent(new window.Event(AWAKE_HOURS_EVENT));
    } catch (error) {
      status.textContent = 'Could not save Awake Hours. ' + error.message;
      toast(status.textContent);
    }
  };
  card.append(form);
  root.append(card);
  return card;
}
