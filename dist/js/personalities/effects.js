import { getPersonality } from './index.js?v=f99b8ac250a9';
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
  const preview = document.createElement('button');
  preview.type = 'button';
  preview.className = 'secondary effects-preview';
  preview.textContent = 'Preview effects';
  select?.after(preview);
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
    last = -Infinity;
    root.dataset.personalityEffect = getPersonality(root.dataset.layout).effects || 'none';
    root.dataset.effects = effectiveEffects(level, media?.matches, document.hidden);
    if (select) select.value = level;
    preview.disabled =
      root.dataset.effects !== 'full' || !getPersonality(root.dataset.layout).effects;
    if (status)
      status.textContent = media?.matches
        ? 'Animations are off because your device requests reduced motion.'
        : !getPersonality(root.dataset.layout).effects
          ? 'This personality uses a still design. Astronaut and Gamer include optional animated effects.'
          : level === 'full'
            ? 'Full: animated background and visible completion/Focus responses. Preview them without changing any notes.'
            : level === 'subtle'
              ? 'Subtle: static background decoration. Choose Full for animated responses.'
              : 'Off: background decoration and animated responses are hidden. This choice is saved on this device.';
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
    const labels = getPersonality(root.dataset.layout).effectLabels;
    node.innerHTML =
      '<svg class="effect-mark" viewBox="0 0 240 100"><g class="effect-orbital"><ellipse cx="120" cy="50" rx="88" ry="28"/><path d="M45 65L88 36L135 57L183 27"/><circle cx="45" cy="65" r="3"/><circle cx="88" cy="36" r="4"/><circle cx="135" cy="57" r="3"/><circle cx="183" cy="27" r="5"/></g><g class="effect-mastery"><path d="M30 50H210M120 20L150 50L120 80L90 50Z"/><path d="M111 50L118 57L133 40"/><path class="checkpoint-spark" d="M30 25V17M17 50H9M210 25V17M223 50H231M44 30L38 24M196 30L202 24"/><circle class="checkpoint" cx="30" cy="50" r="6"/><circle class="checkpoint" cx="120" cy="50" r="3"/><circle class="checkpoint" cx="210" cy="50" r="6"/></g></svg>';
    const label = document.createElement('span');
    label.textContent = labels?.[event.detail.kind] || 'Progress made';
    node.append(label);
    document.body.append(node);
    // A manual popover floats above modal dialogs without trapping focus or input.
    // Keeping it outside the Focus subtree also survives that window's redraws.
    if (typeof node.showPopover === 'function') {
      node.setAttribute('popover', 'manual');
      try {
        node.showPopover();
      } catch {
        node.removeAttribute('popover');
        document.querySelector('.focus-window[open]')?.append(node);
      }
    } else document.querySelector('.focus-window[open]')?.append(node);
    timer = setTimeout(() => node.remove(), 2400);
  }
  function previewEffect() {
    burst({ detail: { kind: 'focus-commit' } });
  }
  preview.addEventListener('click', previewEffect);
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
      preview.remove();
      select?.removeEventListener('change', change);
      media?.removeEventListener?.('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('dayline:appearance', refresh);
      window.removeEventListener('dayline:effect', burst);
      window.removeEventListener('dayline:focus-state', phase);
    },
  };
}
