import {
  dayKey,
  parseDay,
  offsetDay,
  bucket,
  slots,
} from '../../shared/schedule.js?v=fe286a6e269a';
import { PERSONALITY_MANTRAS, VOICE_QUOTES } from '../../personalities/index.js?v=fe286a6e269a';
export const MANTRAS = PERSONALITY_MANTRAS.zen;
export const INSPIRATION = VOICE_QUOTES.zen;
export function intervalAt(at, interval) {
  const d = new Date(at),
    minute = bucket(d.getHours() * 60 + d.getMinutes(), interval);
  return { date: dayKey(d), minute, key: `${dayKey(d)}:${minute}:${interval}` };
}
export function findFocusNote(days, id, date) {
  if (!id) return null;
  if (days[date]?.some((e) => !e.weekly && e.id === id))
    return { date, entry: days[date].find((e) => !e.weekly && e.id === id) };
  for (const [key, list] of Object.entries(days)) {
    const entry = list.find((e) => !e.weekly && e.id === id);
    if (entry) return { date: key, entry };
  }
  return null;
}
export function focusIntervalNotes(state, page) {
  return (state.days[page.date] || [])
    .filter(
      (entry) =>
        !entry.weekly &&
        bucket(entry.minute, page.interval || state.settings.interval) === page.minute,
    )
    .slice()
    .sort((a, b) => a.minute - b.minute);
}
export function focusPage(state, at) {
  const slot = intervalAt(at, state.settings.interval),
    list = focusIntervalNotes(state, { ...slot, interval: state.settings.interval });
  const note = list.find((e) => !e.done) || list[0];
  return {
    ...slot,
    interval: state.settings.interval,
    startedAt: at,
    noteId: note?.id || null,
    title: note?.title || '',
    text: note?.text || '',
    log: '',
  };
}
export function newFocus(state, now, id, owner) {
  return {
    version: 1,
    id,
    owner,
    phase: 'prepare',
    launchedAt: now,
    startedAt: null,
    endedAt: null,
    interval: state.settings.interval,
    mantra: MANTRAS[0],
    seed: Math.floor(Math.random() * INSPIRATION.length),
    pages: [focusPage(state, now)],
    viewIndex: 0,
    reflection: { progress: '', learned: '', next: '' },
  };
}
export function advanceFocus(session, state, now) {
  if (session.phase === 'reflect' || session.endedAt) return false;
  const slot = intervalAt(now, state.settings.interval),
    last = session.pages.at(-1);
  if (last.key === slot.key) return false;
  if (session.phase === 'prepare') {
    session.pages = [focusPage(state, now)];
    session.viewIndex = 0;
    session.interval = state.settings.interval;
    return true;
  }
  // Reconstruct elapsed intervals after sleep; each keeps its own interruption page.
  let at = last.startedAt,
    guard = 0;
  if (session.interval === state.settings.interval) {
    while (guard++ < 2000) {
      const here = intervalAt(at, session.interval),
        next = parseDay(here.date);
      next.setHours(0, 0, 0, 0);
      next.setMinutes(Math.min(1440, here.minute + session.interval));
      const boundary = next.getTime();
      if (boundary <= at || boundary > now) break;
      const page = focusPage(state, boundary);
      if (page.key !== session.pages.at(-1).key) session.pages.push(page);
      at = boundary;
      if (page.key === slot.key) break;
    }
  }
  if (session.pages.at(-1).key !== slot.key) session.pages.push(focusPage(state, now));
  session.interval = state.settings.interval;
  session.viewIndex = session.pages.length - 1;
  return true;
}
export function commitFocus(session, state, now) {
  advanceFocus(session, state, now);
  session.mantra = session.mantra.trim();
  if (!session.mantra) throw new Error('Choose or write a mantra before committing.');
  session.phase = 'active';
  session.startedAt = now;
  session.pages[0].startedAt = now;
  return session;
}
export function extendFocusNote(days, id, sourceDate, targetDate, targetMinute, interval) {
  const found = findFocusNote(days, id, sourceDate);
  if (!found) throw new Error('This note is no longer available.');
  if (found.entry.done) throw new Error('Reopen the completed note before extending it.');
  if (found.date === targetDate && bucket(found.entry.minute, interval) === targetMinute)
    return days;
  const displaced = (days[targetDate] || []).filter(
    (e) => !e.weekly && bucket(e.minute, interval) === targetMinute && e.id !== id,
  );
  let emptyDay = targetDate,
    emptyMinute = targetMinute;
  if (displaced.length) {
    const starts = slots(interval);
    let index = starts.indexOf(targetMinute) + 1,
      foundEmpty = false;
    for (let count = 0; count < starts.length * 366; count++, index++) {
      if (index >= starts.length) {
        emptyDay = offsetDay(emptyDay, 1);
        index = 0;
      }
      emptyMinute = starts[index];
      if (
        !(days[emptyDay] || []).some((e) => !e.weekly && bucket(e.minute, interval) === emptyMinute)
      ) {
        foundEmpty = true;
        break;
      }
    }
    if (!foundEmpty) throw new Error('No empty interval was found in the next year.');
  }
  const next = { ...days };
  const touched = new Set([found.date, targetDate, ...(displaced.length ? [emptyDay] : [])]);
  for (const date of touched) next[date] = [...(days[date] || [])];
  next[found.date] = next[found.date].filter((e) => e.id !== id);
  if (displaced.length) {
    const ids = new Set(displaced.map((e) => e.id));
    next[targetDate] = next[targetDate].filter((e) => !ids.has(e.id));
    next[emptyDay].push(...displaced.map((e) => ({ ...e, minute: emptyMinute })));
  }
  if (next[targetDate].some((e) => !e.weekly && e.id === id))
    throw new Error('That interval contains a conflicting note ID.');
  next[targetDate].push({ ...found.entry, minute: targetMinute });
  for (const date of touched) next[date].sort((a, b) => a.minute - b.minute);
  return next;
}
export function focusReport(session) {
  const endedAt = session.endedAt ?? Date.now();
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - session.startedAt),
    mantra: session.mantra,
    logs: session.pages.map((p) => ({ date: p.date, minute: p.minute, text: p.log })),
    reflection: { ...session.reflection },
  };
}
const text = (value) => typeof value === 'string';
export function validFocusReports(value) {
  if (!Array.isArray(value)) throw new Error('Invalid focus reports.');
  const seen = new Set();
  return value.map((r) => {
    if (
      !r ||
      !text(r.id) ||
      seen.has(r.id) ||
      !Number.isFinite(r.startedAt) ||
      !Number.isFinite(r.endedAt) ||
      r.endedAt < r.startedAt ||
      r.durationMs !== r.endedAt - r.startedAt ||
      !text(r.mantra) ||
      !Array.isArray(r.logs) ||
      !r.reflection ||
      !['progress', 'learned', 'next'].every((k) => text(r.reflection[k]))
    )
      throw new Error('Invalid focus report.');
    seen.add(r.id);
    const logs = r.logs.map((l) => {
      const date = new Date(l?.date + 'T12:00:00Z');
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(l?.date) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== l.date ||
        !Number.isInteger(l.minute) ||
        l.minute < 0 ||
        l.minute >= 1440 ||
        !text(l.text)
      )
        throw new Error('Invalid focus log.');
      return { date: l.date, minute: l.minute, text: l.text };
    });
    return {
      id: r.id,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      durationMs: r.durationMs,
      mantra: r.mantra,
      logs,
      reflection: {
        progress: r.reflection.progress,
        learned: r.reflection.learned,
        next: r.reflection.next,
      },
    };
  });
}
export function attachFocusReport(days, session) {
  const report = focusReport(session),
    page = session.pages[session.viewIndex]?.noteId
      ? session.pages[session.viewIndex]
      : [...session.pages].reverse().find((p) => p.noteId) || session.pages.at(-1);
  const found = findFocusNote(days, page.noteId, page.date),
    date = found?.date || page.date;
  const entry = found?.entry || {
    id: `focus-${session.id}`,
    title: page.title || 'Focus session',
    text: page.text || '',
    minute: page.minute,
    done: false,
    task: false,
  };
  if (entry.focusReports?.some((r) => r.id === report.id)) return days;
  const updated = { ...entry, focusReports: [...(entry.focusReports || []), report] };
  return {
    ...days,
    [date]: found
      ? days[date].map((e) => (e === entry ? updated : e))
      : [...(days[date] || []), updated].sort((a, b) => a.minute - b.minute),
  };
}
export function validFocusDraft(s) {
  if (
    !s ||
    s.version !== 1 ||
    !text(s.id) ||
    !text(s.owner) ||
    !['prepare', 'active', 'reflect'].includes(s.phase) ||
    !text(s.mantra) ||
    !Number.isFinite(s.launchedAt) ||
    !Number.isInteger(s.interval) ||
    s.interval < 1 ||
    s.interval > 1440 ||
    !Number.isInteger(s.seed) ||
    s.seed < 0 ||
    !Array.isArray(s.pages) ||
    !s.pages.length ||
    !Number.isInteger(s.viewIndex) ||
    s.viewIndex < 0 ||
    s.viewIndex >= s.pages.length ||
    !s.reflection ||
    !['progress', 'learned', 'next'].every((k) => text(s.reflection[k]))
  )
    throw new Error('Unreadable focus draft.');
  if (s.phase !== 'prepare' && (!Number.isFinite(s.startedAt) || s.startedAt < s.launchedAt))
    throw new Error('Invalid focus start time.');
  if (s.phase === 'reflect' && (!Number.isFinite(s.endedAt) || s.endedAt < s.startedAt))
    throw new Error('Invalid focus finish time.');
  for (const p of s.pages) {
    if (
      !p ||
      !text(p.key) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
      !Number.isInteger(p.minute) ||
      p.minute < 0 ||
      p.minute >= 1440 ||
      !Number.isFinite(p.startedAt) ||
      !(p.noteId === null || text(p.noteId)) ||
      !text(p.title) ||
      !text(p.text) ||
      !text(p.log)
    )
      throw new Error('Invalid focus interval page.');
  }
  return s;
}
export function durationLabel(ms) {
  const seconds = Math.floor(ms / 1000),
    h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}
