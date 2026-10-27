import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { STORIES } from '../../dist/js/features/inspiration/catalog.js';
import {
  CHALLENGES,
  FIELDS,
  FAVORITES_KEY,
  filterStories,
  validFavorites,
  storyNote,
} from '../../dist/js/features/inspiration/model.js';
import { setupInspiration } from '../../dist/js/features/inspiration/view.js';
import { validState } from '../../dist/js/shared/storage.js';

test('100 complete, individually addressable stories have safe sources and actionable takeaways', () => {
  assert.equal(STORIES.length, 100);
  assert.equal(new Set(STORIES.map((story) => story.id)).size, 100);
  assert.equal(CHALLENGES.length, 10);
  assert.ok(FIELDS.length >= 10);
  for (const story of STORIES) {
    for (const key of ['person', 'title', 'story', 'takeaway', 'challenge', 'field'])
      assert.ok(story[key].trim(), `${story.id}: ${key}`);
    const source = new URL(story.source);
    assert.equal(source.protocol, 'https:');
    assert.equal(source.username, '');
    assert.equal(source.password, '');
    const note = storyNote(story);
    assert.ok(note.title.includes(story.person));
    assert.ok(note.text.includes(story.story));
    assert.ok(note.text.includes(story.source));
    const saved = { id: story.id, minute: 540, done: false, ...note };
    assert.equal(
      validState({ version: 1, days: { '2026-10-27': [saved] } }).days['2026-10-27'][0].text,
      note.text,
    );
  }
});

test('filters combine challenge, field, search and favorite role models', () => {
  assert.equal(filterStories({ search: 'katherine johnson' })[0].person, 'Katherine Johnson');
  assert.equal(
    filterStories({ challenge: 'Vision', field: 'Science' }).every(
      (item) => item.challenge === 'Vision' && item.field === 'Science',
    ),
    true,
  );
  assert.ok(filterStories({ favoritesOnly: true, favorites: ['Simone Biles'] }).length >= 2);
  assert.equal(
    filterStories({ favoritesOnly: true, favorites: ['Simone Biles'], field: 'Literature' }).length,
    0,
  );
  assert.deepEqual(validFavorites(['Simone Biles', 'Simone Biles']), ['Simone Biles']);
  assert.throws(() => validFavorites(['unknown']));
});

test('library opens from More, browses and saves favorites, protects failed writes, and saves the chosen story', () => {
  const previous = new Map(
    ['window', 'document'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const { window, document } = parseHTML(
    '<html><body><div id="more"><section class="activity-card"></section></div></body></html>',
  );
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  const data = new Map();
  let fail = false,
    saved;
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (fail) throw Error('full');
      data.set(key, value);
    },
  };
  try {
    for (const [name, value] of Object.entries({ window, document }))
      Object.defineProperty(globalThis, name, { configurable: true, value });
    const api = setupInspiration({
      root: document.querySelector('#more'),
      storage,
      random: () => 0,
      saveStory(story) {
        saved = story;
        return true;
      },
    });
    assert.equal(document.querySelectorAll('#more .activity-card').length, 2);
    [...document.querySelectorAll('#more button')]
      .find((b) => b.textContent === 'Explore the library')
      .click();
    assert.equal(api.dialog.open, true);
    assert.match(api.dialog.textContent, /Octavia Butler/);
    const source = api.dialog.querySelector('.inspiration-source');
    assert.equal(source.target, '_blank');
    assert.equal(source.rel, 'noopener noreferrer');
    api.dialog.querySelector('.inspiration-favorite').click();
    assert.deepEqual(JSON.parse(data.get(FAVORITES_KEY)), ['Octavia Butler']);
    fail = true;
    api.dialog.querySelector('.inspiration-favorite').click();
    assert.match(api.dialog.textContent, /Could not save favorites/);
    assert.deepEqual(JSON.parse(data.get(FAVORITES_KEY)), ['Octavia Butler']);
    fail = false;
    const input = api.dialog.querySelector('input[type=search]');
    input.value = 'Katherine Johnson';
    input.dispatchEvent(new window.Event('input'));
    assert.match(api.dialog.textContent, /Katherine Johnson/);
    [...api.dialog.querySelectorAll('button')]
      .find((b) => b.textContent === 'Save to Daily')
      .click();
    assert.equal(saved.person, 'Katherine Johnson');
    assert.equal(api.dialog.open, false);
    assert.deepEqual([...data.keys()], [FAVORITES_KEY]);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
