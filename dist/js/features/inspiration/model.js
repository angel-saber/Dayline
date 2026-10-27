import { STORIES } from './catalog.js?v=3ed5f18227e2';
export const FAVORITES_KEY = 'dayline.inspiration.favorites.v1';
export const CHALLENGES = [...new Set(STORIES.map((story) => story.challenge))];
export const FIELDS = [...new Set(STORIES.map((story) => story.field))].sort((a, b) =>
  a.localeCompare(b),
);
const PEOPLE = new Set(STORIES.map((story) => story.person));
export function validFavorites(value) {
  if (!Array.isArray(value) || value.some((name) => typeof name !== 'string' || !PEOPLE.has(name)))
    throw new Error('Saved favorites could not be read.');
  return [...new Set(value)];
}
export function filterStories({
  challenge = '',
  field = '',
  search = '',
  favoritesOnly = false,
  favorites = [],
} = {}) {
  const query = search.trim().toLocaleLowerCase();
  const favoriteSet = new Set(favorites);
  return STORIES.filter(
    (story) =>
      (!challenge || story.challenge === challenge) &&
      (!field || story.field === field) &&
      (!favoritesOnly || favoriteSet.has(story.person)) &&
      (!query ||
        [story.person, story.title, story.story, story.takeaway].some((value) =>
          value.toLocaleLowerCase().includes(query),
        )),
  );
}
export function storyNote(story) {
  return {
    title: `Inspiration · ${story.person}`,
    text: `${story.title}\n\n${story.story}\n\nTry this: ${story.takeaway}\n\nRead the source: ${story.source}`,
  };
}
