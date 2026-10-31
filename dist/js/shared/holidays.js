import { dayKey, parseDay, offsetDay } from './dates.js?v=268df83d9262';
// Annual U.S. federal holidays under current OPM rules. No network requests.
export const HOLIDAY_SOURCE =
  'https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/';
export function usFederalHolidays(date) {
  const year = Number(date.slice(0, 4));
  if (year < 2021) return [];
  const names = [];
  const add = (day, name, fixed = false) => {
    if (day === date) names.push(name);
    if (fixed) {
      const weekday = parseDay(day).getDay();
      if (
        (weekday === 6 && offsetDay(day, -1) === date) ||
        (weekday === 0 && offsetDay(day, 1) === date)
      )
        names.push(name + ' (observed)');
    }
  };
  for (const y of [year - 1, year, year + 1]) {
    if (y < 2021) continue;
    const fixed = (month, day, name) => add(dayKey(new Date(y, month - 1, day, 12)), name, true);
    const nth = (month, weekday, n, name) => {
      const first = new Date(y, month - 1, 1, 12);
      add(
        dayKey(new Date(y, month - 1, 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7, 12)),
        name,
      );
    };
    fixed(1, 1, 'New Year’s Day');
    nth(1, 1, 3, 'Birthday of Martin Luther King, Jr.');
    nth(2, 1, 3, 'Washington’s Birthday');
    const lastMay = new Date(y, 5, 0, 12);
    lastMay.setDate(lastMay.getDate() - ((lastMay.getDay() + 6) % 7));
    add(dayKey(lastMay), 'Memorial Day');
    fixed(6, 19, 'Juneteenth National Independence Day');
    fixed(7, 4, 'Independence Day');
    nth(9, 1, 1, 'Labor Day');
    nth(10, 1, 2, 'Columbus Day');
    fixed(11, 11, 'Veterans Day');
    nth(11, 4, 4, 'Thanksgiving Day');
    fixed(12, 25, 'Christmas Day');
  }
  return names;
}
