import { dayKey, offsetDay } from '../../shared/dates.js?v=70187e0ed5b2';
import { validCommitments, practiceProgress, COMMITMENTS_KEY } from './model.js?v=70187e0ed5b2';
export const COMMITMENT_STATE_KEY = 'dayline.commitment-state.v1';
export const DURATION_PRESETS = [2, 5, 10, 15, 25, 30, 45, 60, 90, 120];
export function suggestedPracticeBreak(minutes) {
  return minutes < 25 ? 0 : minutes <= 30 ? 5 : minutes <= 60 ? 10 : 15;
}
export function newCommitmentState(items = []) {
  return {
    version: 1,
    items: validCommitments(items),
    marks: {},
    game: {
      enabled: false,
      cap: 3,
      nextDate: '',
      misses: 0,
      wins: 0,
      pending: null,
      snapshots: {},
    },
    pingEnabled: true,
    lastPing: '',
  };
}
const dateOK = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !isNaN(Date.parse(value + 'T12:00:00Z')) &&
  new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
export function validCommitmentState(v) {
  if (
    !v ||
    v.version !== 1 ||
    typeof v.pingEnabled !== 'boolean' ||
    typeof v.lastPing !== 'string' ||
    v.lastPing.length > 100 ||
    !v.marks ||
    typeof v.marks !== 'object' ||
    Array.isArray(v.marks) ||
    !v.game
  )
    throw Error('Invalid daily commitment history.');
  const items = validCommitments(v.items),
    g = v.game;
  if (
    typeof g.enabled !== 'boolean' ||
    !Number.isInteger(g.cap) ||
    g.cap < 1 ||
    g.cap > 100 ||
    !Number.isInteger(g.misses) ||
    g.misses < 0 ||
    g.misses > 2 ||
    !Number.isInteger(g.wins) ||
    g.wins < 0 ||
    g.wins > 6 ||
    !(g.nextDate === '' || dateOK(g.nextDate)) ||
    !(g.pending === null || dateOK(g.pending)) ||
    !g.snapshots ||
    typeof g.snapshots !== 'object' ||
    Array.isArray(g.snapshots)
  )
    throw Error('Invalid game progress.');
  const marks = {},
    snapshots = {};
  if (Object.keys(v.marks).length > 10000 || Object.keys(g.snapshots).length > 10000)
    throw Error('Too much commitment history.');
  for (const [date, ids] of Object.entries(v.marks)) {
    if (
      !dateOK(date) ||
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((id) => typeof id !== 'string' || !id || id.length > 100)
    )
      throw Error('Invalid completion history.');
    marks[date] = [...new Set(ids)];
  }
  for (const [date, values] of Object.entries(g.snapshots)) {
    if (!dateOK(date)) throw Error('Invalid game date.');
    snapshots[date] = validCommitments(values);
  }
  return {
    version: 1,
    items,
    marks,
    game: {
      enabled: g.enabled,
      cap: g.cap,
      nextDate: g.nextDate,
      misses: g.misses,
      wins: g.wins,
      pending: g.pending,
      snapshots,
    },
    pingEnabled: v.pingEnabled,
    lastPing: v.lastPing,
  };
}
export function readCommitmentState(storage) {
  const raw = storage.getItem(COMMITMENT_STATE_KEY);
  return raw
    ? validCommitmentState(JSON.parse(raw))
    : newCommitmentState(validCommitments(JSON.parse(storage.getItem(COMMITMENTS_KEY) || '[]')));
}
export function commitmentDone(state, item, date, days) {
  return (
    !!state.marks[date]?.includes(item.id) ||
    practiceProgress(days, item.id, new Date(date + 'T12:00:00')) >= item.minutes * 60000
  );
}
export function evaluateGame(value, days, today = dayKey()) {
  const state = structuredClone(value),
    g = state.game;
  if (!g.enabled || g.pending) return state;
  if (!g.nextDate) g.nextDate = today;
  for (let date = g.nextDate; date < today; date = offsetDay(date, 1)) {
    const targets = g.snapshots[date] || state.items;
    const success =
      targets.length > 0 && targets.every((item) => commitmentDone(state, item, date, days));
    g.nextDate = offsetDay(date, 1);
    if (!targets.length) {
      g.wins = 0;
      g.misses = 0;
      continue;
    }
    if (success) {
      g.misses = 0;
      g.wins++;
      if (g.wins === 7) {
        g.cap = Math.min(100, g.cap + 1);
        g.wins = 0;
      }
    } else {
      g.wins = 0;
      g.misses++;
      if (g.misses === 2) {
        g.pending = date;
        break;
      }
    }
  }
  if (!g.snapshots[today]) g.snapshots[today] = structuredClone(state.items);
  return state;
}
export function toggleGame(value, enabled, today = dayKey()) {
  const state = structuredClone(value);
  state.game = {
    enabled,
    cap: Math.max(3, state.items.length),
    nextDate: today,
    misses: 0,
    wins: 0,
    pending: null,
    snapshots: { [today]: structuredClone(state.items) },
  };
  return state;
}
export function acknowledgePenalty(value, id, today = dayKey()) {
  const state = structuredClone(value);
  if (!state.game.enabled || !state.game.pending) throw Error('No adjustment is waiting.');
  if (state.items.length > 1) {
    if (!state.items.some((item) => item.id === id))
      throw Error('Choose the commitment to remove.');
    state.items = state.items.filter((item) => item.id !== id);
    state.game.cap = Math.max(1, state.game.cap - 1);
  } else if (state.items.length === 1) {
    state.items[0].minutes = Math.max(2, state.items[0].minutes - 5);
    // Duration adjustments do not remove additional earned slots.
  }
  state.game.pending = null;
  state.game.nextDate = today;
  state.game.misses = 0;
  state.game.wins = 0;
  state.game.snapshots[today] = structuredClone(state.items);
  return state;
}
export function changeItems(value, items, today = dayKey()) {
  const state = structuredClone(value);
  state.items = validCommitments(items);
  if (
    state.game.enabled &&
    state.items.length > value.items.length &&
    (state.game.pending || state.items.length > state.game.cap)
  )
    throw Error(
      'Complete a full week to unlock another commitment slot, or acknowledge the waiting adjustment first.',
    );
  if (state.game.enabled && state.game.nextDate <= today)
    state.game.snapshots[today] = structuredClone(state.items);
  return state;
}
export function pendingCommitments(state, days, today = dayKey()) {
  return state.items.filter((item) => !commitmentDone(state, item, today, days));
}
