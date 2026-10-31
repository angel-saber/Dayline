import { validYearlySource } from '../yearly/model.js?v=34bd393decd8';
import { weekStart } from '../monthly/weekly-model.js?v=34bd393decd8';
import { activityCatalog, activityFields, lifeDimensions } from './catalog.js?v=34bd393decd8';
import { dayKey, bucket, offsetDay } from '../../shared/schedule.js?v=34bd393decd8';
export const dimensions = [
  {
    key: 'work',
    label: 'Work',
    question:
      'What is one small activity you can do today to move your work or responsibilities forward?',
    hint: 'Draft a paragraph, send one email, or spend two minutes starting.',
  },
  {
    key: 'health',
    label: 'Health',
    question: 'What is one activity you can do today to care for your body or mind?',
    hint: 'Take a short walk, prepare a meal, rest, or stretch.',
  },
  {
    key: 'learning',
    label: 'Learning',
    question: 'What is one thing you can explore or practice today?',
    hint: 'Read a few pages, research a question, or practice a skill.',
  },
  {
    key: 'relationships',
    label: 'Relationships',
    question: 'What is one activity you can do today to nurture a connection?',
    hint: 'Check in with someone, offer help, or make time to listen.',
  },
  {
    key: 'spirituality',
    label: 'Spirituality',
    question:
      'What is one activity you can do today to connect with your values, meaning, or faith?',
    hint: 'Reflect, pray, meditate, spend time in nature, or practice gratitude. Choose what spirituality means to you.',
  },
];
export function validGuidedReports(reports) {
  if (!Array.isArray(reports)) throw new Error('Invalid guided activities.');
  const seen = new Set();
  return reports.map((r) => {
    if (
      !r ||
      typeof r.id !== 'string' ||
      !r.id ||
      seen.has(r.id) ||
      !Number.isFinite(r.completedAt) ||
      !Number.isFinite(new Date(r.completedAt).getTime()) ||
      !r.answers
    )
      throw new Error('Invalid guided activity.');
    const fields = r.activity
      ? activityFields(r.activity)
      : dimensions.map((d) => ({ key: d.key }));
    if (
      (r.activity && !Object.hasOwn(activityCatalog, r.activity)) ||
      !fields.every(
        (f) =>
          typeof r.answers[f.key] === 'string' &&
          (f.optional || r.answers[f.key].trim()) &&
          r.answers[f.key].length <= 2000,
      )
    )
      throw new Error('Invalid guided activity answers.');
    if (r.activity === 'untangle' && !['act', 'ask', 'later'].some((k) => r.answers[k].trim()))
      throw new Error('Sort at least one thought.');
    const result = {
      id: r.id,
      completedAt: r.completedAt,
      answers: Object.fromEntries(fields.map((f) => [f.key, r.answers[f.key]])),
    };
    if (r.activity) result.activity = r.activity;
    if (r.yearlySource !== undefined) result.yearlySource = validYearlySource(r.yearlySource);
    if (r.timer !== undefined) {
      if (
        r.activity !== 'two-minute' ||
        !r.timer ||
        !Number.isFinite(r.timer.elapsedMs) ||
        r.timer.elapsedMs < 0 ||
        r.timer.elapsedMs > 120000 ||
        typeof r.timer.completed !== 'boolean' ||
        r.timer.completed !== r.timer.elapsedMs >= 120000
      )
        throw new Error('Invalid action timer.');
      result.timer = { elapsedMs: r.timer.elapsedMs, completed: r.timer.completed };
    }
    if (r.schedule !== undefined) {
      if (
        r.activity !== 'compass' ||
        !r.schedule ||
        (r.schedule.mode !== undefined && r.schedule.mode !== 'weekly') ||
        (r.schedule.mode !== 'weekly' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.schedule.time))
      )
        throw new Error('Invalid Compass time.');
      const date = r.schedule.date ?? dayKey(new Date(r.completedAt));
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(new Date(date + 'T12:00:00Z').getTime()) ||
        new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date
      )
        throw new Error('Invalid Compass date.');
      result.schedule =
        r.schedule.mode === 'weekly' ? { mode: 'weekly', date } : { time: r.schedule.time, date };
    }
    seen.add(r.id);
    return result;
  });
}
export function attachGuidedPlan(days, interval, report) {
  report = validGuidedReports([report])[0];
  const now = new Date(report.completedAt),
    date = dayKey(now),
    minute = bucket(now.getHours() * 60 + now.getMinutes(), interval),
    list = days[date] || [];
  if (list.some((e) => e.guidedActivities?.some((r) => r.id === report.id)))
    return { days, date, minute };
  const existing = list.find(
      (e) => !e.weekly && !e.yearly && bucket(e.minute, interval) === minute,
    ),
    entry = existing || {
      id: `guided-${report.id}`,
      title: report.activity ? activityCatalog[report.activity].title : 'Guided Planning',
      text: '',
      minute,
      done: false,
      task: false,
      format: [],
      tasks: [],
    };
  const updated = { ...entry, guidedActivities: [...(entry.guidedActivities || []), report] };
  const next = {
    ...days,
    [date]: existing
      ? list.map((e) => (e === existing ? updated : e))
      : [...list, updated].sort((a, b) => a.minute - b.minute),
  };
  if (report.activity === 'compass' && report.schedule) {
    const title = compassTitle(date),
      [hour, min] = (report.schedule.time || '00:00').split(':').map(Number);
    for (let week = 1; week <= 4; week++) {
      const target =
          report.schedule.mode === 'weekly'
            ? weekStart(offsetDay(date, (week - 1) * 7))
            : offsetDay(date, (week - 1) * 7),
        text = lifeDimensions
          .map(
            ([key, label]) =>
              `${label} — ${report.answers[`${key}.project`].replace(/\s+/g, ' ')}: ${report.answers[`${key}.week${week}`].replace(/\s+/g, ' ')}`,
          )
          .join('\n');
      let start = 0;
      const tasks = text.split('\n').map((line) => {
        const task = { start, done: false };
        start += line.length + 1;
        return task;
      });
      const note = {
        id: `compass-${report.id}-week-${week}`,
        title,
        text,
        minute: hour * 60 + min,
        done: false,
        task: false,
        format: [],
        tasks,
        ...(report.schedule.mode === 'weekly' ? { weekly: true } : {}),
        ...(report.yearlySource ? { yearlySource: report.yearlySource } : {}),
      };
      next[target] = [...(next[target] || []), note].sort((a, b) => a.minute - b.minute);
    }
  }
  return { date, minute, days: next };
}
export function breathingFrame(elapsed, mode) {
  const total = 120000,
    period = mode === 'energize' ? 6000 : 10000,
    inhale = mode === 'energize' ? 3000 : 4000,
    t = Math.min(total, Math.max(0, elapsed)),
    phase = t % period;
  return {
    done: t >= total,
    remaining: Math.ceil((total - t) / 1000),
    instruction:
      t >= total ? 'Take a natural breath.' : phase < inhale ? 'Inhale gently' : 'Exhale gently',
    expansion: phase < inhale ? phase / inhale : 1 - (phase - inhale) / (period - inhale),
  };
}

export function compassTitle(date) {
  return `Monthly Compass [${date} - ${offsetDay(date, 28)}]`;
}
export function compassDates(date) {
  return [0, 7, 14, 21].map((delta) => offsetDay(date, delta));
}
