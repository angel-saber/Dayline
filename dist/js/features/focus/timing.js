export const TIMING_KEY = 'dayline.focus-timing.v1';
export const TIMING_DEFAULTS = Object.freeze({
  mode: 'untimed',
  workMinutes: 30,
  breakMinutes: 5,
  autoBreak: true,
  sound: true,
  flowThresholds: [25, 50, 90],
  flowBreaks: [5, 8, 10, 15],
});
export function validTiming(value) {
  if (
    !value ||
    !['timed', 'untimed'].includes(value.mode) ||
    !Number.isInteger(value.workMinutes) ||
    value.workMinutes < 1 ||
    value.workMinutes > 1440 ||
    !Number.isInteger(value.breakMinutes) ||
    value.breakMinutes < 1 ||
    value.breakMinutes > 120 ||
    typeof value.autoBreak !== 'boolean' ||
    typeof value.sound !== 'boolean' ||
    !Array.isArray(value.flowThresholds) ||
    value.flowThresholds.length !== 3 ||
    value.flowThresholds.some(
      (n, i, a) => !Number.isInteger(n) || n < 1 || n > 1440 || (i > 0 && n <= a[i - 1]),
    ) ||
    !Array.isArray(value.flowBreaks) ||
    value.flowBreaks.length !== 4 ||
    value.flowBreaks.some((n) => !Number.isInteger(n) || n < 1 || n > 120)
  )
    throw Error('Choose valid timer lengths and increasing Flowtime thresholds.');
  const result = {
    mode: value.mode,
    workMinutes: value.workMinutes,
    breakMinutes: value.breakMinutes,
    autoBreak: value.autoBreak,
    sound: value.sound,
    flowThresholds: [...value.flowThresholds],
    flowBreaks: [...value.flowBreaks],
  };
  for (const key of ['alerted', 'breakStarted'])
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'boolean') throw Error('Invalid timer status.');
      result[key] = value[key];
    }
  return result;
}
export function readTiming(storage = globalThis.localStorage) {
  try {
    return validTiming(JSON.parse(storage.getItem(TIMING_KEY) || JSON.stringify(TIMING_DEFAULTS)));
  } catch {
    return structuredClone(TIMING_DEFAULTS);
  }
}
export function sessionTiming(preferences = TIMING_DEFAULTS, minutes = null) {
  const result = validTiming(preferences);
  return validTiming({
    ...result,
    ...(minutes !== null ? { mode: 'timed', workMinutes: minutes } : {}),
    alerted: false,
    breakStarted: false,
  });
}
export function flowtimeBreak(durationMs, preferences = TIMING_DEFAULTS) {
  const p = validTiming(preferences),
    minutes = Math.max(0, durationMs) / 60000;
  const i = p.flowThresholds.findIndex((limit) => minutes < limit);
  return p.flowBreaks[i < 0 ? 3 : i];
}
export function workDeadline(session) {
  return session.timing?.mode === 'timed' && session.startedAt !== null
    ? session.startedAt + session.timing.workMinutes * 60000
    : null;
}
export function timerDue(session, now) {
  const deadline = workDeadline(session);
  return (
    session.phase === 'active' && deadline !== null && now >= deadline && !session.timing.alerted
  );
}

export function sessionBreakSuggestion(session) {
  const timing = session.timing || TIMING_DEFAULTS;
  const duration = Math.max(0, (session.endedAt ?? Date.now()) - session.startedAt);
  const overtime =
    session.practice && timing.mode === 'timed' && duration > timing.workMinutes * 60000;
  return timing.mode === 'untimed' || overtime
    ? flowtimeBreak(duration, timing)
    : timing.breakMinutes;
}
