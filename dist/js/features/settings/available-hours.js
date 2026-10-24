export const DEFAULT_AVAILABLE_HOURS = Object.freeze({
  from: 540,
  to: 1020,
  hideBefore: false,
  hideAfter: false,
});
export function validAvailableHours(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Number.isInteger(value.from) ||
    !Number.isInteger(value.to) ||
    value.from < 0 ||
    value.from >= 1440 ||
    value.to < 1 ||
    value.to > 1440 ||
    value.from >= value.to ||
    ['hideBefore', 'hideAfter'].some(
      (key) => value[key] !== undefined && typeof value[key] !== 'boolean',
    )
  )
    throw new Error(
      'Available hours must end after they start. Use midnight as the end of the day, or choose a later end time.',
    );
  return {
    from: value.from,
    to: value.to,
    hideBefore: value.hideBefore === true,
    hideAfter: value.hideAfter === true,
  };
}
export function availableHours(settings = {}) {
  return settings.availableHours
    ? validAvailableHours(settings.availableHours)
    : { ...DEFAULT_AVAILABLE_HOURS };
}
export function hourInput(minute) {
  return `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
export function inputMinute(value, end = false) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hour, minute] = value.split(':').map(Number),
    result = hour * 60 + minute;
  return end && result === 0 ? 1440 : result;
}
// Keep boundary intervals that overlap available hours, including their notes.
export function dailySlotVisible(minute, interval, hours) {
  return (
    !(hours.hideBefore && Math.min(1440, minute + interval) <= hours.from) &&
    !(hours.hideAfter && minute >= hours.to)
  );
}
