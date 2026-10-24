import zen from './zen/index.js';
import builder from './builder/index.js';
import founder from './founder/index.js';
import astronaut from './astronaut/index.js';
import gamer from './gamer/index.js';
import { DEFAULT_COPY } from './default-copy.js';

export const PERSONALITIES = Object.freeze({ zen, builder, founder, astronaut, gamer });
export const VOICE_QUOTES = Object.fromEntries(
  Object.entries(PERSONALITIES).map(([id, value]) => [id, value.quotes]),
);
export const PERSONALITY_MANTRAS = Object.fromEntries(
  Object.entries(PERSONALITIES).map(([id, value]) => [id, value.mantras]),
);
export function getPersonality(id) {
  return Object.hasOwn(PERSONALITIES, id) ? PERSONALITIES[id] : PERSONALITIES.zen;
}
export function personality() {
  return typeof document === 'undefined' ? 'zen' : document.documentElement.dataset.layout || 'zen';
}
export function voice(key, mode = personality()) {
  const copy = Object.hasOwn(PERSONALITIES, mode) ? PERSONALITIES[mode].copy : DEFAULT_COPY;
  if (Object.hasOwn(copy, key)) return copy[key];
  return Object.hasOwn(DEFAULT_COPY, key) ? DEFAULT_COPY[key] : key;
}
export function focusMantras(fallback, mode = personality()) {
  return Object.hasOwn(PERSONALITY_MANTRAS, mode) ? PERSONALITY_MANTRAS[mode] : fallback;
}
export function focusIdeas(fallback, mode = personality()) {
  return Object.hasOwn(VOICE_QUOTES, mode) ? VOICE_QUOTES[mode] : fallback;
}
export function applyPersonality() {
  document.querySelectorAll('[data-voice]').forEach((el) => {
    el.textContent = voice(el.dataset.voice);
  });
  for (const field of ['name', 'description'])
    document.querySelectorAll('[data-personality-' + field + ']').forEach((el) => {
      el.textContent = getPersonality(
        el.dataset[field === 'name' ? 'personalityName' : 'personalityDescription'],
      )[field === 'description' ? 'settingsDescription' : field];
    });
}
