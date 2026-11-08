import { node } from '../../shared/dom.js?v=4a8d127fdc4d';
const KEY = 'dayline.list-layout.v1';
export function readLayout(view, storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(KEY) || '{}')[view] === 'list' ? 'list' : 'schedule';
  } catch {
    return 'schedule';
  }
}
export function writeLayout(view, value, storage = globalThis.localStorage) {
  try {
    let saved;
    try {
      saved = JSON.parse(storage.getItem(KEY) || '{}');
    } catch {
      saved = {};
    }
    const next = {};
    for (const key of ['daily', 'monthly', 'yearly'])
      next[key] = saved?.[key] === 'list' ? 'list' : 'schedule';
    next[view] = value;
    storage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
export function layoutToggle(view, onChange, onError = () => {}) {
  const group = node('div', 'planner-layout-toggle');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', `${view} layout`);
  for (const [value, label] of [
    ['schedule', 'Schedule'],
    ['list', 'List'],
  ]) {
    const button = node('button', '', label);
    button.type = 'button';
    button.dataset.layoutOption = value;
    button.setAttribute('aria-pressed', String(readLayout(view) === value));
    button.onclick = () => {
      if (writeLayout(view, value)) onChange();
      else onError('Layout preference could not be saved.');
    };
    group.append(button);
  }
  return group;
}
