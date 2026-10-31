import { validTags, categoryLabel } from '../notes/note-types.js?v=b8179ad8cdac';
export const BREATHS = [
  ['possibility', 'perfection'],
  ['courage', 'judgment'],
  ['curiosity', 'the need to know everything'],
  ['willingness', 'hesitation'],
];
export const INTEREST = [
  ['Find the interesting part', 'The part I’m curious about is…'],
  ['Give it meaning', 'Doing this makes room for…'],
  ['Practice a skill', 'I’ll use this task to get better at…'],
  ['Try a different method', 'This time, I’ll try…'],
  ['Make it a game', 'My small challenge is to…'],
  ['Make progress visible', 'I’ll track progress by…'],
];
export const ACCESS = [
  ['Shrink the first step', 'For now, I only need to…'],
  ['Start for two minutes', 'Start for two minutes.'],
  ['Make a rough version', 'Make a rough version before refining it.'],
  ['Use an example', 'I can start from this example or template…'],
  ['Resolve one unknown', 'Before proceeding, I need to find out…'],
  ['Ask for help', 'I can ask ___ to help with…'],
  ['Prepare what I need', 'Starting will be easier once I have…'],
];
export const PERMISSIONS = [
  ['Making mistakes', 'I can make mistakes and adjust.'],
  ['Being judged', 'This attempt doesn’t need an audience yet.'],
  ['Not knowing enough', 'I can learn what I need as I go.'],
  ['Wasting effort', 'I can try an approach and change direction.'],
  ['Producing disappointing work', 'I can make something imperfect before improving it.'],
];
export const RECOVERY_CHOICES = [
  'Quiet rest',
  'Movement',
  'Water or food',
  'Something enjoyable',
  'Choose my own',
];
export const ACKNOWLEDGMENTS = [
  'I made progress',
  'I learned something',
  'I changed approach',
  'I practiced',
  'I showed up',
];
const TEXT_FIELDS = [
  'outcome',
  'evidence',
  'ifStuck',
  'interest',
  'access',
  'fear',
  'permission',
  'warmupText',
  'warmupSavedText',
  'ritual',
  'parked',
  'breathIn',
  'breathOut',
];
export function newFlow(tags = []) {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, ''])),
    tags: [...tags],
    readiness: '',
    warmup: '',
    breathIn: 'possibility',
    breathOut: 'perfection',
    steps: [{ action: '', strategy: '', done: false }],
    space: { dnd: false, tabs: false, materials: false, people: false },
    hideClock: false,
  };
}
export function validFlow(value) {
  if (!value || typeof value !== 'object') throw Error('Invalid Focus preparation.');
  const result = newFlow();
  for (const key of TEXT_FIELDS) {
    if (typeof value[key] !== 'string' || value[key].length > 10000)
      throw Error('Keep preparation fields under 10,000 characters.');
    result[key] = value[key];
  }
  result.tags = validTags(value.tags);
  if (
    !['', 'compelling', 'manageable', 'both', 'ready'].includes(value.readiness) ||
    !['', 'breathing', 'movement', 'rehearse', 'rough', 'ritual'].includes(value.warmup)
  )
    throw Error('Invalid preparation choice.');
  result.readiness = value.readiness;
  result.warmup = value.warmup;
  if (!Array.isArray(value.steps) || !value.steps.length || value.steps.length > 30)
    throw Error('Use 1–30 preparation steps.');
  result.steps = value.steps.map((s) => {
    if (
      !s ||
      typeof s.action !== 'string' ||
      s.action.length > 2000 ||
      typeof s.strategy !== 'string' ||
      s.strategy.length > 2000 ||
      typeof s.done !== 'boolean'
    )
      throw Error('Invalid preparation step.');
    return { action: s.action, strategy: s.strategy, done: s.done };
  });
  if (!value.space || typeof value.hideClock !== 'boolean')
    throw Error('Invalid attention preferences.');
  for (const key of Object.keys(result.space)) {
    if (typeof value.space[key] !== 'boolean') throw Error('Invalid attention preference.');
    result.space[key] = value.space[key];
  }
  result.hideClock = value.hideClock;
  if (JSON.stringify(result).length > 120000) throw Error('This preparation is too large.');
  return result;
}
export function suggestedBreak(durationMs) {
  const minutes = Math.max(0, durationMs) / 60000;
  return minutes < 25 ? 3 : minutes < 50 ? 5 : minutes < 90 ? 10 : 15;
}
export function newRecovery(durationMs) {
  return {
    minutes: suggestedBreak(durationMs),
    activity: '',
    custom: '',
    acknowledgment: '',
    win: '',
    celebrate: false,
    startTimer: false,
  };
}
export function validRecovery(value) {
  if (
    !value ||
    !Number.isInteger(value.minutes) ||
    value.minutes < 1 ||
    value.minutes > 120 ||
    !['', ...RECOVERY_CHOICES].includes(value.activity) ||
    !['', ...ACKNOWLEDGMENTS].includes(value.acknowledgment) ||
    typeof value.custom !== 'string' ||
    value.custom.length > 2000 ||
    typeof value.win !== 'string' ||
    value.win.length > 10000 ||
    typeof value.celebrate !== 'boolean' ||
    typeof value.startTimer !== 'boolean'
  )
    throw Error('Invalid recovery choices.');
  return {
    minutes: value.minutes,
    activity: value.activity,
    custom: value.custom,
    acknowledgment: value.acknowledgment,
    win: value.win,
    celebrate: value.celebrate,
    startTimer: value.startTimer,
  };
}
export function flowLines(flow) {
  if (!flow) return [];
  const f = validFlow(flow),
    lines = [];
  for (const [key, label] of [
    ['outcome', 'Outcome'],
    ['evidence', 'Evidence of progress'],
    ['ifStuck', 'If I get stuck'],
    ['interest', 'Make it compelling'],
    ['access', 'Make it approachable'],
    ['fear', 'What I’m risking'],
    ['permission', 'My permission'],
    ['ritual', 'My starting ritual'],
    ['warmupText', 'Warm-up attempt'],
  ])
    if (f[key].trim()) lines.push(`${label}: ${f[key]}`);
  if (f.tags.length) lines.push(`Outcome categories: ${f.tags.map(categoryLabel).join(' · ')}`);
  f.steps.forEach((step, i) => {
    if (step.action || step.strategy)
      lines.push(
        `${step.done ? '☑' : '☐'} Step ${i + 1}: ${step.action}${step.strategy ? ' — ' + step.strategy : ''}`,
      );
  });
  if (f.warmup)
    lines.push(
      `Warm-up: ${{ breathing: 'Breathe with intention', movement: 'Move into the task', rehearse: 'Rehearse the first move', rough: 'Make a low-stakes attempt', ritual: 'Use my own ritual' }[f.warmup]}`,
    );
  if (f.warmup === 'breathing') lines.push(`Inhale ${f.breathIn}. Exhale ${f.breathOut}.`);
  const space = {
    dnd: 'Do Not Disturb',
    tabs: 'Distracting tabs closed',
    materials: 'Materials ready',
    people: 'Let others know',
  };
  const checked = Object.keys(space).filter((k) => f.space[k]);
  if (checked.length) lines.push(`Space prepared: ${checked.map((k) => space[k]).join(' · ')}`);
  return lines;
}
export function recoveryLines(recovery) {
  if (!recovery) return [];
  const r = validRecovery(recovery),
    lines = [`Chosen break: ${r.minutes} minutes`];
  if (r.activity)
    lines.push(`Recovery: ${r.activity === 'Choose my own' ? r.custom || r.activity : r.activity}`);
  if (r.acknowledgment) lines.push(r.acknowledgment);
  if (r.win) lines.push(r.win);
  return lines;
}
