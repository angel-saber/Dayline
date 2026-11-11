import { node } from '../../shared/dom.js?v=6d1be00d390d';
export const BREAK_KEY = 'dayline.focus-break.v1';
export function setupBreakTimer({
  root = document.body,
  storage = localStorage,
  now = Date.now,
  canShow = () => true,
  onComplete = () => {},
} = {}) {
  const panel = node('aside', 'focus-break-timer'),
    label = node('span'),
    stop = node('button', 'secondary', 'End break');
  panel.setAttribute('aria-label', 'Optional recovery timer');
  stop.type = 'button';
  panel.append(label, stop);
  root.append(panel);
  let deadline = null,
    completed = false,
    sound = true;
  function read() {
    try {
      const value = JSON.parse(storage.getItem(BREAK_KEY) || 'null');
      deadline =
        value &&
        Number.isFinite(value.until) &&
        value.until > 0 &&
        value.until <= now() + 120 * 60000
          ? value.until
          : null;
      completed = value?.alerted === true;
      sound = value?.sound !== false;
    } catch {
      deadline = null;
    }
  }
  function tick() {
    panel.hidden = deadline === null || !canShow();
    if (deadline === null) return;
    const seconds = Math.max(0, Math.ceil((deadline - now()) / 1000));
    label.textContent = seconds
      ? `Break · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
      : 'Break complete · return when ready';
    if (!seconds && !completed) {
      try {
        const saved = JSON.parse(storage.getItem(BREAK_KEY) || 'null');
        if (saved?.until === deadline && saved.alerted) completed = true;
      } catch {}
    }
    if (!seconds && !completed && canShow()) {
      completed = true;
      label.setAttribute('role', 'status');
      try {
        storage.setItem(BREAK_KEY, JSON.stringify({ until: deadline, alerted: true, sound }));
      } catch {}
      onComplete(sound);
    }
    stop.textContent = seconds ? 'End break' : 'Dismiss';
  }
  function clear() {
    deadline = null;
    completed = false;
    try {
      storage.removeItem(BREAK_KEY);
    } catch {
      /* Keep the local timer dismissed. */
    }
    tick();
  }
  stop.onclick = clear;
  const onStorage = (e) => {
    if (e.key === BREAK_KEY || e.key === null) {
      read();
      tick();
    }
  };
  const onVisibility = () => {
    if (!document.hidden) tick();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('dayline:account', clear);
  window.addEventListener('dayline:entry-view', tick);
  document.addEventListener('visibilitychange', onVisibility);
  read();
  tick();
  const timer = setInterval(tick, 1000);
  return {
    start(minutes, startedAt = now(), playSound = true) {
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120)
        throw Error('Choose 1–120 break minutes.');
      if (!Number.isFinite(startedAt) || typeof playSound !== 'boolean')
        throw Error('Invalid break timer.');
      sound = playSound;
      deadline = startedAt + minutes * 60000;
      completed = false;
      try {
        storage.setItem(BREAK_KEY, JSON.stringify({ until: deadline, sound }));
      } catch {
        /* The timer can still run in this tab. */
      }
      tick();
    },
    stop: clear,
    remaining: () => (deadline === null ? null : Math.max(0, deadline - now())),
    element: panel,
    destroy() {
      clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('dayline:account', clear);
      window.removeEventListener('dayline:entry-view', tick);
      document.removeEventListener('visibilitychange', onVisibility);
      panel.remove();
    },
    tick,
  };
}
