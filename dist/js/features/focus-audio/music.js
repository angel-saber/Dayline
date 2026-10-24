// Original procedural scores. Personality folders own their profiles and scores.
import { getPersonality } from '../../personalities/index.js?v=280f4d8eaa90';
export function musicProfile(layout) {
  const { bars, ...profile } = getPersonality(layout).soundtrack;
  return { ...profile };
}
export function musicLength(sampleRate, layout) {
  const profile = getPersonality(layout).soundtrack;
  return Math.round(((sampleRate * 60) / profile.bpm) * profile.bars);
}
export function renderMusic(data, rate, layout) {
  getPersonality(layout).renderScore(data, rate);
}
