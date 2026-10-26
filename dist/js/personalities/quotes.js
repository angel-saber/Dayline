import { getPersonality } from './index.js?v=6558b5ba29d9';
// Original local copy; no API, tracking, or network requests.
export function dailyQuote(date = new Date(), mode = 'zen') {
  // Use local calendar components, then UTC for day arithmetic. This keeps the
  // choice stable through daylight-saving changes and refreshes on local days.
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const pool = getPersonality(mode).quotes;
  return pool[((day % pool.length) + pool.length) % pool.length];
}
