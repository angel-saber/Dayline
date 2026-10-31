import { validDate } from '../../bulk/model.js?v=f99b8ac250a9';
import { dayKey, offsetDay, parseDay } from '../../../shared/dates.js?v=f99b8ac250a9';
import { weekStart } from '../../monthly/weekly-model.js?v=f99b8ac250a9';
import { repeatDates, addMonths } from '../../repeating/model.js?v=f99b8ac250a9';
import { validTags } from '../../notes/note-types.js?v=f99b8ac250a9';
import { writeYearly } from '../model.js?v=f99b8ac250a9';
export const LIFE_DATE = '1900-01-01';
export const GROUPS = {
  occasions: ['Birthdays & anniversaries', 'event', 'annual'],
  payments: ['Payments & renewals', 'admin', 'monthly'],
  health: ['Health & care', 'personal', 'none'],
  connection: ['Family & connection', 'personal', 'none'],
  home: ['Home & documents', 'admin', 'none'],
  rest: ['Rest & experiences', 'personal', 'none'],
  other: ['Something else', '', 'none'],
};
export const SUGGESTIONS = {
  occasions: ['Birthday', 'Anniversary'],
  payments: ['Payment', 'Subscription review', 'Insurance renewal', 'Credit report review'],
  health: ['Health appointment', 'Dental visit', 'Prescription renewal'],
  connection: ['Family time', 'Catch-up', 'Visit someone'],
  home: ['Vehicle maintenance', 'Lease renewal', 'Passport or ID expiry', 'Pet care'],
  rest: ['Time off', 'Celebration', 'Something to look forward to'],
  other: [],
};
export const SUPPORT = {
  'Emergency readiness': [
    'Emergency kit',
    'First-aid supplies',
    'Flashlight & batteries',
    'Backup charging',
    'Emergency contacts',
    'Household meeting plan',
  ],
  'Important information': [
    'Essential document locations',
    'Accessible contact list',
    'Instructions for someone trusted',
  ],
  'Digital resilience': [
    'Device backups',
    'Account recovery methods',
    'Password manager',
    'Account security review',
  ],
  'Everyday essentials': [
    'Supplies you rely on',
    'Spare-key arrangement',
    'Basic household tools',
    'Transport alternatives',
  ],
  'Financial resilience': [
    'Recurring bills overview',
    'Manageable savings goal',
    'Insurance information location',
  ],
  'People & support': [
    'Someone to call',
    'Practical help you can ask for',
    'Care for dependents or pets',
  ],
};
export const blankRow = () => ({
  title: '',
  date: '',
  time: '',
  text: '',
  amount: '',
  tags: '',
  frequency: '',
  end: '',
});
export function defaults(key, today = dayKey()) {
  return {
    time: '',
    reminder: '',
    tag: GROUPS[key][1],
    frequency: GROUPS[key][2],
    end: `${Number(today.slice(0, 4)) + 1}-12-31`,
    mode: 'daily',
  };
}
export function validLifeData(value) {
  if (!value || value.version !== 1 || !value.groups || !value.support)
    throw Error('Invalid life planner data.');
  const result = { version: 1, groups: {}, support: {}, links: [] };
  for (const [key, group] of Object.entries(value.groups)) {
    if (!Object.hasOwn(GROUPS, key) || !Array.isArray(group.rows) || group.rows.length > 60)
      throw Error('Keep each list to 60 rows.');
    const config = group.defaults;
    if (
      !config ||
      ['time', 'reminder', 'tag', 'frequency', 'end', 'mode'].some(
        (k) => typeof config[k] !== 'string' || config[k].length > 100,
      )
    )
      throw Error('Invalid scheduling defaults.');
    result.groups[key] = {
      defaults: Object.fromEntries(
        ['time', 'reminder', 'tag', 'frequency', 'end', 'mode'].map((k) => [k, config[k]]),
      ),
      hidden: !!group.hidden,
      rows: group.rows.map((row) => {
        const clean = blankRow();
        for (const k of Object.keys(clean)) {
          if (row[k] === undefined) row = { ...row, [k]: '' };
          if (typeof row[k] !== 'string' || row[k].length > (k === 'text' ? 2000 : 200))
            throw Error('A life planner field is too long.');
          clean[k] = row[k];
        }
        return clean;
      }),
    };
  }
  const statuses = ['To consider', 'In place', 'Revisit', 'Not relevant'];
  const items = new Set(Object.values(SUPPORT).flat());
  for (const [key, item] of Object.entries(value.support)) {
    if (
      (!items.has(key) && !key.startsWith('custom:')) ||
      key.length > 100 ||
      !statuses.includes(item.status) ||
      typeof item.text !== 'string' ||
      item.text.length > 1000
    )
      throw Error('Invalid life support item.');
    result.support[key] = { status: item.status, text: item.text };
  }
  if (Object.keys(result.support).length > 100) throw Error('Keep life support to 100 items.');
  if (value.links !== undefined && !Array.isArray(value.links))
    throw Error('Invalid planned note links.');
  for (const link of (value.links || []).slice(-100)) {
    if (!validDate(link.date) || typeof link.id !== 'string' || typeof link.title !== 'string')
      throw Error('Invalid planned note link.');
    result.links.push({ date: link.date, id: link.id, title: link.title });
  }
  return result;
}
export function readLife(days) {
  const records = (days[LIFE_DATE] || [])
    .filter((n) => n.yearly?.kind === 'life')
    .sort((a, b) => b.yearly.updatedAt - a.yearly.updatedAt);
  const record = records[0];
  return {
    record,
    data: record
      ? validLifeData(JSON.parse(record.text))
      : { version: 1, groups: {}, support: {}, links: [] },
  };
}
export function writeLife(days, data, expected = null, newId) {
  const { record } = readLife(days);
  if ((record?.text || null) !== expected)
    throw Error(
      'These lists changed on another device. Reload the lists before saving; your current entries are still here.',
    );
  return writeYearly(
    days,
    {
      id: record?.id,
      title: 'Life foundations',
      text: JSON.stringify(validLifeData(data)),
      yearly: { year: 1900, quarter: 0, kind: 'life' },
    },
    newId,
  );
}
export function resolveDate(raw, today = dayKey()) {
  raw = raw.trim();
  if (validDate(raw)) return raw;
  const iso = raw.match(/^(\d{1,2})[/-](\d{1,2})$/);
  const named = raw.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  const months = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  let month, day;
  if (iso) {
    month = Number(iso[1]);
    day = Number(iso[2]);
  } else if (named) {
    month =
      months.findIndex(
        (m) => m === named[1].toLowerCase() || m.slice(0, 3) === named[1].toLowerCase(),
      ) + 1;
    day = Number(named[2]);
  }
  if (!month || !day) throw Error('Use YYYY-MM-DD, May 12, or MM/DD.');
  for (let year = Number(today.slice(0, 4)); year <= Number(today.slice(0, 4)) + 8; year++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (validDate(date) && date >= today) return date;
  }
  throw Error('Choose a valid date.');
}
export function parseList(text) {
  const lines = text.split(/\r?\n/).filter((s) => s.trim());
  if (!lines.length) throw Error('Paste at least one item.');
  if (lines.length > 60) throw Error('Paste up to 60 items at once.');
  return lines.map((line) => {
    const parts = line.split(/\s+[—–]\s+|\t|\s+-\s+/);
    return {
      ...blankRow(),
      title: parts[0].trim(),
      date: (parts[1] || '').trim(),
      time: (parts[2] || '').trim(),
    };
  });
}
const minute = (time) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Use a valid time.');
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
};
export function planLifeRows(data, key, today = dayKey(), newId = () => crypto.randomUUID()) {
  const group = data.groups[key];
  if (!group) throw Error('Choose a list.');
  const notes = [],
    errors = {},
    used = new Set();
  const unique = () => {
    const id = newId();
    if (!id || used.has(id)) throw Error('Could not create unique notes.');
    used.add(id);
    return id;
  };
  group.rows.forEach((row, index) => {
    if (!Object.values(row).some((v) => v.trim())) return;
    try {
      if (!row.title.trim()) throw Error('Add a name or title.');
      if (!row.date.trim()) throw Error('Choose a date.');
      const date = resolveDate(row.date, today),
        time = row.time || group.defaults.time,
        frequency = row.frequency || group.defaults.frequency,
        end = row.end || group.defaults.end,
        weekly = group.defaults.mode === 'weekly';
      if (date < today) throw Error('Choose today or a future date.');
      if (weekly && frequency !== 'none')
        throw Error('Choose No repeat for an undated Weekly Note.');
      let dates = [date];
      if (frequency !== 'none') {
        if (!validDate(end) || end < date)
          throw Error('Choose a repeat end date on or after this occasion.');
        if (frequency === 'annual') {
          dates = [];
          for (let i = 0; i < 1000; i++) {
            const d = addMonths(date, 12 * i);
            if (d > end) break;
            dates.push(d);
          }
          if (dates.length === 1000 && addMonths(date, 12000) <= end)
            throw Error('Use a shorter cycle: up to 1000 notes per batch.');
        } else dates = repeatDates({ start: date, end, frequency });
      }
      const tags = row.tags.trim()
        ? row.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) =>
              ['project', 'admin', 'event', 'personal'].includes(t.toLowerCase())
                ? t.toLowerCase()
                : `custom:${t}`,
            )
        : group.defaults.tag
          ? [group.defaults.tag]
          : [];
      validTags(tags);
      const cycle = dates.length > 1 ? unique() : null;
      for (const occurrence of dates) {
        if (notes.length >= 1000) throw Error('Use a shorter cycle: up to 1000 notes per batch.');
        const entry = {
          id: unique(),
          title: row.title.trim(),
          text: [row.text, row.amount ? `Amount: ${row.amount}` : ''].filter(Boolean).join('\n'),
          minute: time
            ? minute(time)
            : group.defaults.reminder
              ? minute(group.defaults.reminder)
              : 0,
          done: false,
          task: false,
          tasks: [],
          format: [],
          bullets: [],
          indents: [],
          tags,
        };
        if (weekly) {
          entry.weekly = true;
          entry.minute = 0;
        } else if (!time) {
          entry.allDay = true;
          entry.remind = !!group.defaults.reminder;
        }
        if (cycle) entry.repeat = { id: cycle, start: date, end, occurrence };
        notes.push({ date: weekly ? weekStart(occurrence) : occurrence, entry });
      }
    } catch (error) {
      errors[index] = error.message;
    }
  });
  if (!notes.length && !Object.keys(errors).length) errors[0] = 'Add at least one item.';
  return { notes, errors };
}
export function scheduleLife(
  days,
  data,
  key,
  expected,
  today,
  newId = () => crypto.randomUUID(),
  restoreGroup = undefined,
) {
  const plan = planLifeRows(data, key, today, newId);
  if (Object.keys(plan.errors).length) throw Error('Check the highlighted rows before scheduling.');
  const previous = { [LIFE_DATE]: structuredClone(days[LIFE_DATE] || []) },
    next = { ...days },
    seen = new Set(
      Object.values(days)
        .flat()
        .map((n) => n.id),
    );
  for (const { date, entry } of plan.notes) {
    if (seen.has(entry.id)) throw Error('Could not create unique notes.');
    seen.add(entry.id);
    previous[date] ??= structuredClone(days[date] || []);
    next[date] = [...(next[date] || []), entry].sort((a, b) => a.minute - b.minute);
    if (new TextEncoder().encode(JSON.stringify(next[date])).length > 900000)
      throw Error('This day has reached its storage limit.');
  }
  const updated = structuredClone(data);
  updated.groups[key].rows = [blankRow()];
  if (restoreGroup !== undefined) {
    if (restoreGroup) updated.groups[key] = structuredClone(restoreGroup);
    else delete updated.groups[key];
  }
  updated.links = [
    ...updated.links,
    ...plan.notes
      .slice(0, 20)
      .map(({ date, entry }) => ({ date, id: entry.id, title: entry.title })),
  ].slice(-100);
  const result = writeLife(next, updated, expected, newId);
  return { ...result, previous, count: plan.notes.length };
}
