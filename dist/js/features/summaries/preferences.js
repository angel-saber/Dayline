import { node } from '../../shared/dom.js?v=ebeed1edf97a';
export const SUMMARY_PREFERENCES_KEY = 'dayline.summary-display.v1';
export const SUMMARY_PREFERENCES_EVENT = 'dayline:summary-preferences';
export const DEFAULT_SUMMARY_PREFERENCES = Object.freeze({
  notes: true,
  tags: true,
  focus: true,
  holidays: true,
  tagMode: 'percentage',
});
export function validSummaryPreferences(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid summary display preferences.');
  const result = { ...DEFAULT_SUMMARY_PREFERENCES, ...value };
  for (const key of ['notes', 'tags', 'focus', 'holidays'])
    if (typeof result[key] !== 'boolean') throw new Error('Invalid summary display preference.');
  if (!['percentage', 'count'].includes(result.tagMode))
    throw new Error('Choose percentages or note counts.');
  return Object.fromEntries(
    Object.keys(DEFAULT_SUMMARY_PREFERENCES).map((key) => [key, result[key]]),
  );
}
export function readSummaryPreferences(storage) {
  try {
    return validSummaryPreferences(
      JSON.parse((storage ?? globalThis.localStorage).getItem(SUMMARY_PREFERENCES_KEY) || '{}'),
    );
  } catch {
    return { ...DEFAULT_SUMMARY_PREFERENCES };
  }
}
export function saveSummaryPreferences(value, storage) {
  const valid = validSummaryPreferences(value);
  (storage ?? globalThis.localStorage).setItem(SUMMARY_PREFERENCES_KEY, JSON.stringify(valid));
  window.dispatchEvent(new window.Event(SUMMARY_PREFERENCES_EVENT));
  return valid;
}
export function toggleSummaryTagMode() {
  const current = readSummaryPreferences();
  return saveSummaryPreferences({
    ...current,
    tagMode: current.tagMode === 'percentage' ? 'count' : 'percentage',
  });
}
export function setupSummarySettings({ root, toast, storage }) {
  const card = node('section', 'settings-card summary-settings');
  const heading = node('h2', '', 'Calendar summaries');
  const choices = node('fieldset');
  choices.append(node('legend', '', 'Show in summary lines'));
  const inputs = new Map();
  for (const [key, text] of [
    ['notes', 'Number of notes'],
    ['tags', 'Tag breakdown'],
    ['focus', 'Focus time'],
    ['holidays', 'Holidays'],
  ]) {
    const label = node('label', 'summary-setting-toggle'),
      input = node('input');
    input.type = 'checkbox';
    input.dataset.summaryPreference = key;
    input.setAttribute('aria-label', `Show ${text.toLowerCase()} in summary lines`);
    label.append(input, document.createTextNode(text));
    choices.append(label);
    inputs.set(key, input);
    input.addEventListener('change', () =>
      write({ ...readSummaryPreferences(storage), [key]: input.checked }),
    );
  }
  const label = node('label', 'summary-mode-label', 'Tag figures');
  const mode = node('select');
  mode.setAttribute('aria-label', 'Summary tag figures');
  for (const [value, text] of [
    ['percentage', 'Percentages'],
    ['count', 'Number of notes'],
  ]) {
    const option = node('option', '', text);
    option.value = value;
    mode.append(option);
  }
  label.append(mode);
  mode.addEventListener('change', () =>
    write({ ...readSummaryPreferences(storage), tagMode: mode.value }),
  );
  card.append(
    heading,
    choices,
    label,
    node(
      'p',
      'field-hint',
      'Click the tag figures in any summary to switch between percentages and note counts. These display choices are saved in this browser. Hidden figures remain available under Details; turn all four off to hide summary lines entirely.',
    ),
  );
  root.append(card);
  function render() {
    const value = readSummaryPreferences(storage);
    for (const [key, input] of inputs) input.checked = value[key];
    mode.value = value.tagMode;
  }
  function write(value) {
    try {
      saveSummaryPreferences(value, storage);
    } catch {
      toast('Could not save summary display choices in this browser.');
      render();
    }
  }
  window.addEventListener(SUMMARY_PREFERENCES_EVENT, render);
  window.addEventListener('dayline:summary-preference-error', () =>
    toast('Could not save the summary display mode in this browser.'),
  );
  window.addEventListener('storage', (event) => {
    if (event.key === SUMMARY_PREFERENCES_KEY || event.key === null)
      window.dispatchEvent(new window.Event(SUMMARY_PREFERENCES_EVENT));
  });
  render();
  return { element: card, render };
}
