import { node } from '../../shared/dom.js?v=e3a1bdfe567b';
import { STORIES } from './catalog.js?v=e3a1bdfe567b';
import {
  CHALLENGES,
  FIELDS,
  FAVORITES_KEY,
  validFavorites,
  filterStories,
} from './model.js?v=e3a1bdfe567b';
const button = (label, action, cls = 'secondary') => {
  const value = node('button', cls, label);
  value.type = 'button';
  value.addEventListener('click', action);
  return value;
};
export function setupInspiration({
  root,
  saveStory,
  storage = localStorage,
  random = Math.random,
}) {
  const card = node('section', 'settings-card activity-card');
  const launch = button('Explore the library', open, 'primary');
  card.append(
    node('h2', '', 'Inspiration Library'),
    node(
      'p',
      'field-hint',
      `${STORIES.length} real stories of creativity, persistence, movement and new beginnings.`,
    ),
    launch,
  );
  root.insertBefore(card, root.querySelector('.activity-card'));
  const dialog = node('dialog', 'inspiration-library');
  dialog.setAttribute('aria-labelledby', 'inspiration-library-heading');
  const header = node('div', 'activity-header');
  const heading = node('h2', '', 'Inspiration Library');
  heading.id = 'inspiration-library-heading';
  header.append(
    heading,
    button('Close', () => dialog.close()),
  );
  const filters = node('div', 'inspiration-filters');
  function select(label, values) {
    const wrap = node('label', '', label);
    const input = node('select');
    input.setAttribute('aria-label', label);
    for (const [value, text] of [['', 'All'], ...values.map((item) => [item, item])]) {
      const option = node('option', '', text);
      option.value = value;
      input.append(option);
    }
    wrap.append(input);
    filters.append(wrap);
    return input;
  }
  const challenge = select('What do you need?', CHALLENGES);
  const field = select('Field', FIELDS);
  const searchLabel = node('label', '', 'Search people and stories');
  const search = node('input');
  search.type = 'search';
  search.placeholder = 'Name or keyword';
  search.setAttribute('aria-label', 'Search people and stories');
  searchLabel.append(search);
  filters.append(searchLabel);
  const favoriteLabel = node('label', 'inspiration-favorites-toggle');
  const favoritesOnly = node('input');
  favoritesOnly.type = 'checkbox';
  favoriteLabel.append(favoritesOnly, document.createTextNode(' Favorite role models only'));
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  const result = node('div', 'inspiration-result');
  const nav = node('div', 'inline inspiration-navigation');
  const previous = button('Previous', () => show(index - 1));
  const next = button('Next story', () => show(index + 1));
  const another = button('Show me another', () => {
    if (filtered.length < 2) return;
    const offset = 1 + Math.floor(random() * (filtered.length - 1));
    show((index + offset) % filtered.length);
  });
  nav.append(previous, next, another);
  dialog.append(
    header,
    node(
      'p',
      'field-hint',
      'Explore real stories and ideas for your next step. Favorites are saved in this browser on this device.',
    ),
    filters,
    favoriteLabel,
    status,
    result,
    nav,
  );
  document.body.append(dialog);
  let favorites = [],
    unreadable = false,
    filtered = STORIES,
    index = 0,
    returnFocus = null;
  try {
    favorites = validFavorites(JSON.parse(storage.getItem(FAVORITES_KEY) || '[]'));
  } catch {
    unreadable = true;
    status.textContent = 'Saved favorites could not be read and have not been changed.';
  }
  function show(target = 0) {
    index = Math.max(0, Math.min(target, Math.max(0, filtered.length - 1)));
    result.replaceChildren();
    previous.disabled = index <= 0 || !filtered.length;
    next.disabled = index >= filtered.length - 1;
    another.disabled = filtered.length < 2;
    if (!filtered.length) {
      result.append(node('p', '', 'No stories match these choices. Try another filter or search.'));
      return;
    }
    const story = filtered[index];
    const article = node('article', 'inspiration-story');
    const meta = node('p', 'eyebrow', `${story.challenge} · ${story.field}`);
    const person = node('p', 'inspiration-person', story.person);
    const title = node('h3', '', story.title);
    const favorite = button(
      favorites.includes(story.person) ? '★ Favorited' : '☆ Add favorite',
      () => {
        if (unreadable) {
          status.textContent = 'Saved favorites could not be read and have not been changed.';
          return;
        }
        const updated = favorites.includes(story.person)
          ? favorites.filter((name) => name !== story.person)
          : [...favorites, story.person];
        try {
          const values = validFavorites(updated);
          storage.setItem(FAVORITES_KEY, JSON.stringify(values));
          favorites = values;
          status.textContent = `${story.person} ${favorites.includes(story.person) ? 'added to' : 'removed from'} favorites on this device.`;
        } catch {
          status.textContent = 'Could not save favorites on this device. Please try again.';
          return;
        }
        if (favoritesOnly.checked && !favorites.includes(story.person)) applyFilters();
        else show(index);
        result.querySelector('.inspiration-favorite')?.focus();
      },
    );
    favorite.classList.add('inspiration-favorite');
    favorite.setAttribute('aria-pressed', String(favorites.includes(story.person)));
    favorite.setAttribute(
      'aria-label',
      (favorites.includes(story.person) ? 'Remove favorite: ' : 'Add favorite: ') + story.person,
    );
    const take = node('div', 'inspiration-takeaway');
    take.append(node('h4', '', 'Try this'), node('p', '', story.takeaway));
    const link = node('a', 'inspiration-source', 'Read the source ↗');
    link.href = story.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const actions = node('div', 'inline');
    actions.append(
      favorite,
      button(
        'Save to Daily',
        () => {
          if (saveStory(story) !== false) dialog.close();
        },
        'primary',
      ),
    );
    article.append(
      meta,
      person,
      title,
      node('p', 'inspiration-story-text', story.story),
      take,
      link,
      actions,
    );
    result.append(node('p', 'field-hint', `${index + 1} of ${filtered.length} stories`), article);
  }
  function applyFilters() {
    filtered = filterStories({
      challenge: challenge.value,
      field: field.value,
      search: search.value,
      favoritesOnly: favoritesOnly.checked,
      favorites,
    });
    show(0);
  }
  for (const input of [challenge, field, search, favoritesOnly])
    input.addEventListener(input === search ? 'input' : 'change', applyFilters);
  function open() {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    applyFilters();
    dialog.showModal();
  }
  dialog.addEventListener('close', () => {
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
  window.addEventListener('dayline:account', () => {
    if (dialog.open) dialog.close();
  });
  return { open, dialog };
}
