import { node } from '../../shared/dom.js?v=ac12573d358a';
export const FAVORITES_KEY = 'dayline.activity-favorites.v1';
export function validFavorites(value) {
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some((id) => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,50}$/.test(id))
  )
    throw new Error('Invalid favorite activities.');
  return [...new Set(value)];
}
export function setupActivityFavorites({ root, toast, storage }) {
  const entries = new Map();
  const dock = node('aside', 'activity-favorites-dock');
  dock.setAttribute('aria-label', 'Favorite guided activities');
  root.append(dock);
  function read() {
    try {
      return validFavorites(
        JSON.parse((storage ?? globalThis.localStorage).getItem(FAVORITES_KEY) || '[]'),
      );
    } catch {
      return [];
    }
  }
  function refresh() {
    const favorites = read();
    dock.replaceChildren();
    for (const [id, entry] of entries) {
      const selected = favorites.includes(id);
      entry.button.textContent = selected ? '★ Favorited' : '☆ Favorite';
      entry.button.setAttribute('aria-pressed', String(selected));
      entry.button.setAttribute(
        'aria-label',
        `${selected ? 'Unfavorite' : 'Favorite'} ${entry.title}`,
      );
    }
    for (const id of favorites) {
      const entry = entries.get(id);
      if (!entry) continue;
      const quick = node('button', 'secondary activity-quick-launch', entry.title);
      quick.type = 'button';
      quick.dataset.activity = id;
      quick.addEventListener('click', () => {
        if (document.querySelector('dialog[open]')) {
          toast('Close the current window before starting another activity.');
          return;
        }
        entry.launch();
      });
      dock.append(quick);
    }
    dock.hidden = !dock.childElementCount;
  }
  function register(id, title, launch) {
    if (entries.has(id)) throw new Error('This activity is already registered.');
    const favorite = node('button', 'secondary activity-favorite');
    favorite.type = 'button';
    favorite.dataset.favoriteActivity = id;
    entries.set(id, { title, launch, button: favorite });
    favorite.addEventListener('click', () => {
      const current = read(),
        next = current.includes(id) ? current.filter((key) => key !== id) : [...current, id];
      try {
        (storage ?? globalThis.localStorage).setItem(
          FAVORITES_KEY,
          JSON.stringify(validFavorites(next)),
        );
        refresh();
      } catch {
        toast('Could not save favorite activities in this browser.');
      }
    });
    refresh();
    return favorite;
  }
  window.addEventListener('storage', (event) => {
    if (event.key === FAVORITES_KEY || event.key === null) refresh();
  });
  refresh();
  return { register, refresh, dock };
}
