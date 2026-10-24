import { getPersonality } from './index.js?v=5010270c32fe';
const KEY = 'dayline.effects.v1';
const LEVELS = ['full', 'subtle', 'off'];
export function effectiveEffects(level, reduced, hidden) {
  return reduced || hidden ? 'off' : LEVELS.includes(level) ? level : 'full';
}
export function setupPersonalityEffects() {
  const root = document.documentElement;
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const select = document.querySelector('#visual-effects');
  const status = document.querySelector('#effects-status');
  const scene = document.createElement('div');
  scene.className = 'personality-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML =
    '<i class="scene-orbit"></i><i class="scene-orbit second"></i><i class="scene-stars"></i><i class="scene-grid"></i><svg class="scene-skills" viewBox="0 0 240 340"><path d="M120 25V105L40 180V270M120 105L200 180V270M40 180H200M40 270L120 315L200 270"/><circle cx="120" cy="25" r="6"/><circle cx="120" cy="105" r="6"/><circle cx="40" cy="180" r="6"/><circle cx="200" cy="180" r="6"/><circle cx="40" cy="270" r="6"/><circle cx="200" cy="270" r="6"/><circle cx="120" cy="315" r="6"/></svg>';
  document.body.prepend(scene);
  let level = 'full',
    timer,
    last = -Infinity;
  try {
    level = localStorage.getItem(KEY) || 'full';
  } catch {}
  if (!LEVELS.includes(level)) level = 'full';
  function clear() {
    clearTimeout(timer);
    document.querySelectorAll('.personality-burst').forEach((node) => node.remove());
  }
  function refresh() {
    clear();
    root.dataset.personalityEffect = getPersonality(root.dataset.layout).effects || 'none';
    root.dataset.effects = effectiveEffects(level, media?.matches, document.hidden);
    if (select) select.value = level;
    if (status)
      status.textContent = media?.matches
        ? 'Motion is off to respect your reduced-motion preference.'
        : 'Visual effects only. This choice is saved on this device.';
  }
  function change() {
    level = LEVELS.includes(select?.value) ? select.value : 'full';
    try {
      localStorage.setItem(KEY, level);
    } catch {}
    refresh();
  }
  function burst(event) {
    if (
      !getPersonality(root.dataset.layout).effects ||
      root.dataset.effects !== 'full' ||
      Date.now() - last < 300
    )
      return;
    if (!['complete', 'focus-commit', 'focus-finish'].includes(event.detail?.kind)) return;
    clear();
    last = Date.now();
    const node = document.createElement('div');
    node.className = 'personality-burst';
    node.dataset.kind = event.detail.kind;
    node.setAttribute('aria-hidden', 'true');
    (document.querySelector('.focus-window[open]') || document.body).append(node);
    timer = setTimeout(() => node.remove(), 1800);
  }
  function phase(event) {
    root.dataset.focusActive = String(event.detail?.phase === 'active');
  }
  select?.addEventListener('change', change);
  media?.addEventListener?.('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('dayline:appearance', refresh);
  window.addEventListener('dayline:effect', burst);
  window.addEventListener('dayline:focus-state', phase);
  refresh();
  return {
    destroy() {
      clear();
      scene.remove();
      select?.removeEventListener('change', change);
      media?.removeEventListener?.('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('dayline:appearance', refresh);
      window.removeEventListener('dayline:effect', burst);
      window.removeEventListener('dayline:focus-state', phase);
    },
  };
}
