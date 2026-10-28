import { PERSONALITY_IDS } from '../../personalities/index.js?v=acdad351dbea';
// Preferences are device-local and independent of notes, sessions and account sync.
export function restoreAudioSettings(raw, defaults, mode) {
  const result = { ...defaults, soundtrack: PERSONALITY_IDS.includes(mode) ? mode : 'zen' };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const key of Object.keys(defaults)) {
    const value = raw[key];
    if (typeof defaults[key] === 'boolean') {
      if (typeof value === 'boolean') result[key] = value;
    } else if (Number.isFinite(value))
      result[key] = Math.round(
        Math.min(
          key === 'bpm' ? 180 : key === 'beat' ? 15 : 100,
          Math.max(key === 'bpm' ? 30 : key === 'beat' ? 2 : 0, value),
        ),
      );
  }
  if (raw.soundtrackPersonality === mode && PERSONALITY_IDS.includes(raw.soundtrack))
    result.soundtrack = raw.soundtrack;
  return result;
}
