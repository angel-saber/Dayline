import { parseDay, offsetDay } from '../../shared/dates.js?v=221bd4f8c2b4';
import { usFederalHolidays } from '../../shared/holidays.js?v=221bd4f8c2b4';
import { noteTags, categoryLabel } from '../notes/note-types.js?v=221bd4f8c2b4';

export function summarySource(days) {
  const notes = [],
    reports = new Map();
  for (const [date, entries] of Object.entries(days))
    for (const note of entries) {
      if (note.yearly) continue;
      notes.push({ date, note });
      for (const report of note.focusReports || [])
        if (!reports.has(report.id)) reports.set(report.id, report);
    }
  return { notes, reports: [...reports.values()] };
}
function midnight(date) {
  const value = parseDay(date);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}
export function summarizePeriod(source, start, end, includeWeekly = false) {
  const notes = source.notes.filter(({ date, note }) =>
    note.weekly
      ? includeWeekly && date <= end && offsetDay(date, 6) >= start
      : date >= start && date <= end,
  );
  const tagCounts = new Map();
  for (const { note } of notes) {
    const tags = noteTags(note);
    for (const tag of tags.length ? tags : ['none'])
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  const tags = [...tagCounts]
    .map(([key, count]) => ({
      key,
      label: key === 'none' ? 'Untagged' : categoryLabel(key),
      count,
      percentage: Math.round((count / notes.length) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const from = midnight(start),
    until = midnight(offsetDay(end, 1));
  let focusMs = 0,
    focusSessions = 0;
  for (const report of source.reports) {
    const overlap = Math.max(0, Math.min(until, report.endedAt) - Math.max(from, report.startedAt));
    if (Number.isFinite(overlap) && overlap > 0) {
      focusMs += overlap;
      focusSessions++;
    }
  }
  const holidays = [];
  for (let date = start; date <= end; date = offsetDay(date, 1)) {
    const names = usFederalHolidays(date);
    if (names.length) holidays.push({ date, names });
    if (date === end) break;
  }
  return {
    start,
    end,
    count: notes.length,
    weeklyCount: notes.filter(({ note }) => note.weekly).length,
    tags,
    focusMs,
    focusSessions,
    holidays,
  };
}
export function focusTime(ms) {
  const minutes = Math.floor(ms / 60000),
    hours = Math.floor(minutes / 60);
  return hours
    ? `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
    : minutes
      ? `${minutes}m`
      : ms > 0
        ? `${Math.floor(ms / 1000)}s`
        : '0m';
}
export function summaryParts(summary, preferences = {}) {
  const options = {
    notes: true,
    tags: true,
    focus: true,
    holidays: true,
    tagMode: 'percentage',
    ...preferences,
  };
  const parts = [];
  if (options.notes)
    parts.push({
      key: 'notes',
      text: `${summary.count} ${summary.count === 1 ? 'note' : 'notes'}${summary.weeklyCount ? ` (${summary.weeklyCount} weekly)` : ''}`,
    });
  if (options.tags) {
    const tags = summary.tags.map((tag) =>
      options.tagMode === 'count'
        ? `${tag.label} ${tag.count} ${tag.count === 1 ? 'note' : 'notes'}`
        : `${tag.label} ${tag.percentage}%`,
    );
    parts.push({ key: 'tags', text: tags.length ? tags.join(' · ') : 'No tags yet' });
  }
  if (options.focus) parts.push({ key: 'focus', text: `Focus ${focusTime(summary.focusMs)}` });
  if (options.holidays && summary.holidays.length)
    parts.push({
      key: 'holidays',
      text:
        summary.holidays.length === 1
          ? summary.holidays[0].names.join(', ')
          : `${summary.holidays.length} holiday dates`,
    });
  return parts;
}
export function summaryLine(summary, preferences = {}) {
  return summaryParts(summary, preferences)
    .map((part) => part.text)
    .join(' · ');
}
