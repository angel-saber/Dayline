import { node } from '../../shared/dom.js?v=e07453b1a957';
import { TIMING_KEY, TIMING_DEFAULTS, readTiming, validTiming } from './timing.js?v=e07453b1a957';
export function timingControls(timing, onChange) {
  const section = node('section', 'focus-section focus-timing-controls');
  const header = node('div', 'focus-timing-header');
  const choices = node('div', 'focus-timing-choices');
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', 'Session timing mode');
  const hint = node(
    'p',
    'field-hint focus-timing-hint',
    'Flowtime suggests a break when you finish.',
  );
  const fields = node('div', 'focus-timing-fields');
  function sync() {
    fields.hidden = timing.mode !== 'timed';
    hint.hidden = timing.mode === 'timed';
    for (const b of choices.children)
      b.setAttribute('aria-pressed', String(b.dataset.mode === timing.mode));
  }
  for (const [mode, text] of [
    ['untimed', 'No limit'],
    ['timed', 'Timed'],
  ]) {
    const b = node('button', 'secondary', text);
    b.type = 'button';
    b.dataset.mode = mode;
    b.setAttribute('aria-label', mode === 'untimed' ? 'No time limit · Flowtime' : 'Timed session');
    b.onclick = () => {
      timing.mode = mode;
      sync();
      onChange();
    };
    choices.append(b);
  }
  for (const [key, text, max] of [
    ['workMinutes', 'Work minutes', 1440],
    ['breakMinutes', 'Break minutes', 120],
  ]) {
    const label = node(
        'label',
        'focus-timing-duration',
        key === 'workMinutes' ? 'Work (min)' : 'Break (min)',
      ),
      input = node('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(max);
    input.step = '1';
    input.value = String(timing[key]);
    input.setAttribute('aria-label', text);
    input.oninput = () => {
      const v = Number(input.value);
      if (Number.isInteger(v) && v >= 1 && v <= max) {
        input.setCustomValidity('');
        timing[key] = v;
        onChange();
      } else input.setCustomValidity(`Choose 1–${max} whole minutes.`);
    };
    label.append(input);
    fields.append(label);
  }
  const label = node('label', 'focus-timing-auto-break'),
    automatic = node('input');
  automatic.type = 'checkbox';
  automatic.checked = timing.autoBreak;
  automatic.onchange = () => {
    timing.autoBreak = automatic.checked;
    onChange();
  };
  label.append(automatic, document.createTextNode('Break after reflection'));
  fields.append(label);
  header.append(node('h2', '', 'Session timing'), choices);
  section.append(header, fields, hint);
  sync();
  return section;
}
export function setupTimingSettings({
  root,
  toast,
  primeSound,
  playSound,
  storage = localStorage,
}) {
  const card = node('section', 'settings-card');
  card.append(
    node('h2', '', 'Focus timers & breaks'),
    node(
      'p',
      '',
      'Timed sessions end at the chosen limit. Untimed sessions suggest rest when you finish. Preferences are saved in this browser and copied into new sessions.',
    ),
  );
  const form = node('form', 'focus-timing-settings');
  let current = readTiming(storage);
  const inputs = {};
  const modeLabel = node('label', '', 'Default session mode'),
    mode = node('select');
  for (const [value, text] of [
    ['untimed', 'No time limit · Flowtime'],
    ['timed', 'Timed session'],
  ]) {
    const option = node('option', '', text);
    option.value = value;
    mode.append(option);
  }
  mode.value = current.mode;
  modeLabel.append(mode);
  form.append(modeLabel);
  function number(key, text, value, max) {
    const label = node('label', '', text),
      input = node('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(max);
    input.step = '1';
    input.required = true;
    input.value = String(value);
    input.setAttribute('aria-label', text);
    label.append(input);
    form.append(label);
    inputs[key] = input;
  }
  number('workMinutes', 'Default timed work minutes', current.workMinutes, 1440);
  number('breakMinutes', 'Timed-session break minutes', current.breakMinutes, 120);
  for (const [key, text] of [
    ['autoBreak', 'Start timed-session breaks after reflection'],
    ['sound', 'Play a sound when work or break time is up'],
  ]) {
    const l = node('label'),
      i = node('input');
    i.type = 'checkbox';
    i.checked = current[key];
    inputs[key] = i;
    l.append(i, document.createTextNode(text));
    form.append(l);
  }
  form.append(
    node('h3', '', 'Untimed Flowtime break suggestions'),
    node(
      'p',
      'field-hint',
      'Defaults: under 25 minutes → 5-minute break; 25–49 → 8; 50–89 → 10; 90+ → 15. These are suggestions, not rules. Customize the thresholds and breaks below.',
    ),
  );
  const link = node('a', '', 'Original Flowtime guidance');
  link.href = 'https://medium.com/@UrgentPigeon/the-flowtime-technique-7685101bd191';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  form.append(link);
  for (let i = 0; i < 3; i++)
    number(
      'threshold' + i,
      `Flowtime boundary ${i + 1} (work minutes)`,
      current.flowThresholds[i],
      1440,
    );
  for (let i = 0; i < 4; i++)
    number(
      'break' + i,
      `Flowtime break ${i + 1} (minutes, shortest to longest work band)`,
      current.flowBreaks[i],
      120,
    );
  const save = node('button', 'primary', 'Save Focus timing preferences');
  save.type = 'submit';
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  const test = node('button', 'secondary', 'Test Focus timer sound');
  test.type = 'button';
  test.onclick = () => {
    playSound()?.catch?.((e) => {
      status.textContent = e.message;
      toast(e.message);
    });
  };
  form.append(
    save,
    test,
    status,
    node(
      'p',
      'field-hint',
      'Keep Dayline open for sounds. A sleeping device or suspended tab can delay alerts; returning checks elapsed wall time. Allow audio for Dayline if your browser blocks playback.',
    ),
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      const next = validTiming({
        mode: mode.value,
        workMinutes: Number(inputs.workMinutes.value),
        breakMinutes: Number(inputs.breakMinutes.value),
        autoBreak: inputs.autoBreak.checked,
        sound: inputs.sound.checked,
        flowThresholds: [0, 1, 2].map((i) => Number(inputs['threshold' + i].value)),
        flowBreaks: [0, 1, 2, 3].map((i) => Number(inputs['break' + i].value)),
      });
      storage.setItem(TIMING_KEY, JSON.stringify(next));
      current = next;
      status.textContent = 'Focus timing preferences saved. Existing sessions keep their settings.';
      if (next.sound) primeSound();
    } catch (e) {
      status.textContent = 'Could not save preferences. ' + e.message;
    }
  };
  card.append(form);
  root.append(card);
  return card;
}
