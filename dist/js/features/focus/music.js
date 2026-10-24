// Original procedural scores. Personality folders own their profiles and scores.
import { getPersonality } from '../../personalities/index.js?v=new-personalities-1';
import { renderScore as zen } from '../../personalities/zen/music.js';
import { renderScore as builder } from '../../personalities/builder/music.js';
import { renderScore as founder } from '../../personalities/founder/music.js';
import { renderScore as astronaut } from '../../personalities/astronaut/music.js';
import { renderScore as gamer } from '../../personalities/gamer/music.js';
const scores = { zen, builder, founder, astronaut, gamer };
export function musicProfile(layout) {
  const { bars, ...profile } = getPersonality(layout).soundtrack;
  return { ...profile };
}
export function musicLength(sampleRate, layout) {
  const profile = getPersonality(layout).soundtrack;
  return Math.round(((sampleRate * 60) / profile.bpm) * profile.bars);
}
export function renderMusic(data, rate, layout) {
  scores[getPersonality(layout).id](data, rate);
}
