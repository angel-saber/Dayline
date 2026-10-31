import { validLifeData } from '../features/yearly/life/model.js?v=47449d930371';
import { validYearly, validYearlySource } from '../features/yearly/model.js?v=47449d930371';
import { validRepeat } from '../features/repeating/series.js?v=47449d930371';
import { validIndents } from '../features/notes/formatting/indents.js?v=47449d930371';
import { validAvailableHours } from '../features/settings/available-hours.js?v=47449d930371';
import { validAttachments } from '../features/attachments/attachments.js?v=47449d930371';
import {
  validNoteType,
  validTags,
  validTagSettings,
} from '../features/notes/note-types.js?v=47449d930371';
import { validGuidedReports } from '../features/activities/model.js?v=47449d930371';
import { validBullets } from '../features/notes/formatting/bullets.js?v=47449d930371';
import { validFocusReports } from '../features/focus/model.js?v=47449d930371';
import { DEFAULT_SETTINGS } from './schedule.js?v=47449d930371';
import { validFormat } from '../features/notes/formatting/format.js?v=47449d930371';
import { validTasks } from '../features/notes/formatting/tasks.js?v=47449d930371';
const KEY = 'dayline.v1';
export function validState(value) {
  if (
    !value ||
    value.version !== 1 ||
    !value.days ||
    typeof value.days !== 'object' ||
    Array.isArray(value.days)
  )
    throw new Error('This is not a Dayline backup.');
  const days = {};
  for (const [key, entries] of Object.entries(value.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(entries))
      throw new Error('Invalid day in backup.');
    const calendarDate = new Date(`${key}T12:00:00Z`);
    if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== key)
      throw new Error('Invalid calendar day in backup.');
    const seen = new Set();
    days[key] = entries.map((e) => {
      if (
        !e ||
        typeof e.id !== 'string' ||
        seen.has(e.id) ||
        typeof e.text !== 'string' ||
        !Number.isInteger(e.minute) ||
        e.minute < 0 ||
        e.minute >= 1440 ||
        typeof e.done !== 'boolean'
      )
        throw new Error('Invalid entry in backup.');
      seen.add(e.id);
      const result = { id: e.id, text: e.text, minute: e.minute, done: e.done };
      if (e.weekly !== undefined) {
        if (e.weekly !== true || new Date(key + 'T12:00:00').getDay() !== 0)
          throw new Error('Invalid weekly note.');
        result.weekly = true;
      }
      if (e.yearly !== undefined) {
        result.yearly = validYearly(e.yearly);
        if (result.yearly.kind === 'life') {
          if (e.text.length > 200000) throw new Error('Life planner data is too large.');
          validLifeData(JSON.parse(e.text));
        }
        if (key !== `${result.yearly.year}-01-01` || e.weekly || e.repeat || e.yearlySource)
          throw new Error('Invalid Yearly storage location.');
      }
      if (e.yearlySource !== undefined) result.yearlySource = validYearlySource(e.yearlySource);
      if (e.repeat !== undefined) result.repeat = validRepeat(e.repeat);
      for (const field of ['allDay', 'remind'])
        if (e[field] !== undefined) {
          if (typeof e[field] !== 'boolean') throw new Error('Invalid all-day reminder.');
          result[field] = e[field];
        }
      if (e.attachments !== undefined) result.attachments = validAttachments(e.attachments);
      if (e.noteType !== undefined) result.noteType = validNoteType(e.noteType);
      if (e.tags !== undefined) result.tags = validTags(e.tags);
      if (e.guidedActivities !== undefined)
        result.guidedActivities = validGuidedReports(e.guidedActivities);
      if (e.focusReports !== undefined) result.focusReports = validFocusReports(e.focusReports);
      if (e.title !== undefined) {
        if (typeof e.title !== 'string' || e.title.length > 200)
          throw new Error('Invalid note title.');
        result.title = e.title;
      }
      if (e.format !== undefined) result.format = validFormat(e.format, e.text);
      if (e.indents !== undefined) result.indents = validIndents(e.indents, e.text);
      if (e.bullets !== undefined) result.bullets = validBullets(e.bullets, e.text);
      if (e.tasks !== undefined) result.tasks = validTasks(e.tasks, e.text);
      if (e.task !== undefined) {
        if (typeof e.task !== 'boolean') throw new Error('Invalid checkbox task.');
        result.task = e.task;
      }
      return result;
    });
  }
  const s = { ...DEFAULT_SETTINGS, ...value.settings };
  if (!Number.isInteger(s.interval) || s.interval < 1 || s.interval > 1440)
    throw new Error('Invalid interval.');
  return {
    version: 1,
    days,
    settings: {
      interval: s.interval,
      clock: s.clock === '24' ? '24' : '12',
      notifications: s.notifications === true,
      sound: s.sound === true,
      ...(s.availableHours !== undefined
        ? { availableHours: validAvailableHours(s.availableHours) }
        : {}),
      ...(s.tags !== undefined ? { tags: validTagSettings(s.tags) } : {}),
    },
  };
}
export function load(storage = localStorage) {
  const raw = storage.getItem(KEY);
  return raw
    ? validState(JSON.parse(raw))
    : { version: 1, days: {}, settings: { ...DEFAULT_SETTINGS } };
}
export function save(state, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify(state));
}
