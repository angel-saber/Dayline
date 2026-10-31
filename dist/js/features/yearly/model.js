import { dayKey } from '../../shared/dates.js?v=47449d930371';
import { validDate } from '../bulk/model.js?v=47449d930371';
import { weekStart } from '../monthly/weekly-model.js?v=47449d930371';
export const DIMENSIONS = ['work', 'health', 'learning', 'relationships', 'spirituality'];
export const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'];
export function validYear(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 9998)
    throw new Error('Choose a year from 1900 to 9998.');
  return year;
}
export function validYearly(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Yearly record.');
  const {
    year,
    quarter,
    kind,
    status = 'active',
    dimension = '',
    nextStep = '',
    reflection = '',
    history = [],
    updatedAt = 0,
  } = value;
  validYear(year);
  if (kind === 'life' && year !== 1900) throw new Error('Invalid life planner anchor.');
  if (
    !Number.isSafeInteger(updatedAt) ||
    updatedAt < 0 ||
    !Number.isFinite(new Date(updatedAt).getTime())
  )
    throw new Error('Invalid Yearly update time.');
  if (
    !Number.isInteger(quarter) ||
    quarter < 0 ||
    quarter > 4 ||
    !['direction', 'quarter', 'intention', 'reflection', 'life'].includes(kind) ||
    (kind === 'direction' || kind === 'reflection' || kind === 'life') !== (quarter === 0)
  )
    throw new Error('Invalid Yearly section.');
  if (!['active', 'released'].includes(status) || !['', ...DIMENSIONS].includes(dimension))
    throw new Error('Invalid intention options.');
  for (const text of [nextStep, reflection])
    if (typeof text !== 'string' || text.length > 20000)
      throw new Error('Keep Yearly fields under 20,000 characters.');
  if (
    !Array.isArray(history) ||
    history.length > 100 ||
    history.some(
      (item) =>
        !item ||
        typeof item.text !== 'string' ||
        item.text.length > 20000 ||
        !Number.isFinite(item.at),
    )
  )
    throw new Error('Invalid previous direction.');
  return {
    year,
    quarter,
    kind,
    status,
    dimension,
    nextStep,
    reflection,
    updatedAt,
    history: history.map(({ text, at }) => ({ text, at })),
  };
}
export function validYearlySource(value) {
  if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 200)
    throw new Error('Invalid intention link.');
  return { year: validYear(value.year), id: value.id };
}
export function yearPosition(year, now = new Date()) {
  validYear(year);
  const today = dayKey(now),
    start = `${year}-01-01`,
    end = `${year + 1}-01-01`;
  // UTC day ordinals avoid DST changing the displayed number of calendar days.
  const ordinal = (key) => Date.parse(key + 'T00:00:00Z') / 86400000;
  const total = ordinal(end) - ordinal(start),
    elapsed = Math.max(0, Math.min(total, ordinal(today) - ordinal(start)));
  return {
    elapsed,
    total,
    remaining: total - elapsed,
    percent: (elapsed / total) * 100,
    currentQuarter: now.getFullYear() === year ? Math.floor(now.getMonth() / 3) + 1 : null,
  };
}
export function yearRecords(days, year) {
  return (days[`${validYear(year)}-01-01`] || [])
    .filter((note) => note.yearly?.year === year)
    .sort(
      (a, b) => (b.yearly.updatedAt || 0) - (a.yearly.updatedAt || 0) || a.id.localeCompare(b.id),
    );
}
export function writeYearly(days, record, newId = () => crypto.randomUUID()) {
  const yearly = validYearly(record.yearly),
    date = `${yearly.year}-01-01`,
    before = days[date] || [];
  if (
    typeof record.title !== 'string' ||
    record.title.length > 200 ||
    typeof record.text !== 'string' ||
    record.text.length > (yearly.kind === 'life' ? 200000 : 20000)
  )
    throw new Error('Use a title up to 200 characters and notes up to 20,000.');
  if (yearly.kind === 'intention' && !record.title.trim())
    throw new Error('Give this intention a short title.');
  const existing = record.id ? before.find((note) => note.id === record.id && note.yearly) : null;
  if (record.id && !existing)
    throw new Error('This Yearly item changed or is no longer available. Reopen it before saving.');
  if (
    !existing &&
    yearly.kind !== 'intention' &&
    before.some(
      (note) =>
        note.id !== record.id &&
        note.yearly?.kind === yearly.kind &&
        note.yearly?.quarter === yearly.quarter,
    )
  )
    throw new Error('This section was updated elsewhere. Reopen it to keep the latest version.');
  const id = existing?.id || newId();
  if (!id || (!existing && before.some((note) => note.id === id)))
    throw new Error('Could not create a unique intention.');
  yearly.updatedAt = Math.max(
    Date.now(),
    ...before.filter((note) => note.yearly).map((note) => (note.yearly.updatedAt || 0) + 1),
  );
  const entry = {
    id,
    minute: 0,
    done: false,
    title: record.title.trim(),
    text: record.text,
    yearly,
  };
  const entries = existing
    ? before.map((note) => (note === existing ? entry : note))
    : [...before, entry];
  if (new TextEncoder().encode(JSON.stringify(entries)).length > 900000)
    throw new Error(
      'This year has reached its storage limit. Export a backup before adding more history.',
    );
  return { days: { ...days, [date]: entries }, id, date };
}
export function linkedNotes(days, record) {
  return Object.entries(days)
    .flatMap(([date, notes]) =>
      notes
        .filter(
          (note) =>
            !note.yearly &&
            note.yearlySource?.id === record.id &&
            note.yearlySource?.year === record.yearly.year,
        )
        .map((entry) => ({ date, entry })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.entry.minute - b.entry.minute);
}
export function planNextStep(
  days,
  record,
  { mode, date, time, title, text },
  newId = () => crypto.randomUUID(),
) {
  if (
    !record?.yearly ||
    record.yearly.kind !== 'intention' ||
    !yearRecords(days, record.yearly.year).some((note) => note.id === record.id)
  )
    throw new Error('This intention is no longer available.');
  if (!validDate(date) || !['weekly', 'daily'].includes(mode))
    throw new Error('Choose a valid destination.');
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 200 ||
    typeof text !== 'string' ||
    text.length > 20000
  )
    throw new Error('Add a next-step title of 1–200 characters.');
  if (mode === 'daily' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error('Choose a valid time.');
  const target = mode === 'weekly' ? weekStart(date) : date,
    list = days[target] || [],
    id = newId();
  if (!id || list.some((note) => note.id === id))
    throw new Error('Could not create a unique next step.');
  const [hour, minute] = mode === 'daily' ? time.split(':').map(Number) : [0, 0];
  const note = {
    id,
    title: title.trim(),
    text,
    minute: hour * 60 + minute,
    done: false,
    ...(mode === 'weekly' ? { weekly: true } : {}),
    yearlySource: { year: record.yearly.year, id: record.id },
  };
  return {
    days: { ...days, [target]: [...list, note].sort((a, b) => a.minute - b.minute) },
    date: target,
    id,
  };
}
export function carryIntentions(days, year, ids, newId = () => crypto.randomUUID()) {
  validYear(year + 1);
  const records = yearRecords(days, year).filter(
    (note) => note.yearly.kind === 'intention' && ids.includes(note.id),
  );
  if (!records.length) throw new Error('Select at least one intention.');
  if (new Set(ids).size !== records.length)
    throw new Error(
      'A selected intention changed or is no longer available. Review the selection again.',
    );
  let next = days;
  for (const record of records)
    next = writeYearly(
      next,
      {
        title: record.title,
        text: record.text,
        yearly: {
          ...record.yearly,
          year: year + 1,
          quarter: 1,
          status: 'active',
          reflection: '',
          history: [],
        },
      },
      newId,
    ).days;
  return next;
}
