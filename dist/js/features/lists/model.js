import { offsetDay } from '../../shared/dates.js?v=a34f3afb6430';
export const itemKey = ({ date, entry }) => `${date}/${entry.id}`;
export function listItems(days, view, period, legacyLifeLinks = []) {
  const first = view === 'monthly' ? `${period}-01` : `${period}-01-01`;
  const last = view === 'monthly' ? `${period}-31` : `${period}-12-31`;
  const legacy = new Set(legacyLifeLinks.map((item) => `${item.date}/${item.id}`));
  const legacyCycles = new Set(
    legacyLifeLinks
      .map((item) => days[item.date]?.find((note) => note.id === item.id)?.repeat?.id)
      .filter(Boolean),
  );
  const items = [];
  for (const [date, notes] of Object.entries(days))
    for (const entry of notes) {
      let include = false;
      if (view === 'daily') include = date === period && !entry.weekly && !entry.yearly;
      else if (view === 'monthly')
        include =
          !entry.yearly &&
          (entry.weekly
            ? date <= last && offsetDay(date, 6) >= first
            : date.startsWith(period + '-'));
      else if (entry.yearly)
        include = entry.yearly.kind === 'intention' && entry.yearly.year === Number(period);
      else {
        const inYear = entry.weekly
          ? date <= last && offsetDay(date, 6) >= first
          : date >= first && date <= last;
        include =
          inYear &&
          !!(
            entry.lifeSource ||
            legacy.has(`${date}/${entry.id}`) ||
            legacyCycles.has(entry.repeat?.id)
          );
      }
      if (include) items.push({ date, entry });
    }
  return chronological(items);
}
export function chronological(items) {
  const dateOf = (item) =>
    item.entry.yearly
      ? `${item.entry.yearly.year}-${String((item.entry.yearly.quarter - 1) * 3 + 1).padStart(2, '0')}-01`
      : item.date;
  return [...items].sort(
    (a, b) =>
      dateOf(a).localeCompare(dateOf(b)) ||
      Number(!!b.entry.yearly) - Number(!!a.entry.yearly) ||
      a.entry.minute - b.entry.minute ||
      itemKey(a).localeCompare(itemKey(b)),
  );
}
export function orderedItems(items, view) {
  const sorted = chronological(items),
    positions = new Map(sorted.map((item, i) => [itemKey(item), i]));
  return sorted.sort(
    (a, b) =>
      (a.entry.listOrder?.[view] ?? Number.MAX_SAFE_INTEGER) -
        (b.entry.listOrder?.[view] ?? Number.MAX_SAFE_INTEGER) ||
      positions.get(itemKey(a)) - positions.get(itemKey(b)),
  );
}
export function reorderList(days, items, view, source, target, after = false) {
  if (
    source === target ||
    !items.some((item) => itemKey(item) === source) ||
    !items.some((item) => itemKey(item) === target)
  )
    return days;
  const next = items.filter((item) => itemKey(item) !== source),
    moved = items.find((item) => itemKey(item) === source);
  next.splice(next.findIndex((item) => itemKey(item) === target) + Number(after), 0, moved);
  return saveOrder(days, next, view);
}
export function saveOrder(days, items, view, reset = false) {
  const next = { ...days };
  items.forEach(({ date, entry }, index) => {
    const current = days[date]?.find((note) => note.id === entry.id);
    if (!current || JSON.stringify(current) !== JSON.stringify(entry))
      throw Error('These notes changed. Refresh the list before reordering.');
    const listOrder = { ...current.listOrder };
    if (reset) delete listOrder[view];
    else listOrder[view] = index;
    next[date] = (next[date] || days[date]).map((note) =>
      note.id === entry.id ? { ...note, listOrder } : note,
    );
  });
  return next;
}
export function validListOrder(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        !['daily', 'monthly', 'yearly'].includes(key) ||
        !Number.isSafeInteger(value[key]) ||
        value[key] < 0 ||
        value[key] > 1000000,
    )
  )
    throw Error('Invalid list order.');
  return { ...value };
}
