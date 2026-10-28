import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shareNoteText,
  emailNoteUrl,
  SHARE_DEFAULTS,
} from '../../dist/js/features/sharing/share-note.js';
const entry = {
  id: 'secret-id',
  minute: 615,
  title: 'Production prep',
  noteType: 'project',
  text: 'Confirm location\nReview shot list\nBring props\nPortfolio',
  task: false,
  tasks: [
    { start: 0, done: false },
    { start: 17, done: true },
  ],
  bullets: [{ start: 34 }],
  format: [{ start: 46, end: 55, href: 'https://example.com/' }],
  focusReports: [
    {
      id: 'focus-private',
      startedAt: 1,
      durationMs: 120000,
      mantra: 'Private mantra',
      logs: [{ date: '2026-10-23', minute: 615, text: 'Private interruption' }],
      reflection: { progress: 'Private progress', learned: 'Private lesson', next: 'Private next' },
    },
  ],
  guidedActivities: [
    {
      id: 'guided-private',
      completedAt: 1,
      answers: {
        work: 'Private work',
        health: 'Private health',
        learning: 'Private learning',
        relationships: 'Private relationships',
        spirituality: 'Private spirituality',
      },
    },
  ],
};
test('clean shared text includes title, precise time, type, tasks, bullets, and hyperlink destinations', () => {
  const text = shareNoteText(entry, '2026-10-23');
  assert.ok(text.startsWith('Production prep\n'));
  assert.ok(text.includes('10:15 AM'));
  assert.ok(text.includes('\nProject\n'));
  assert.ok(text.includes('☐ Confirm location'));
  assert.ok(text.includes('☑ Review shot list'));
  assert.ok(text.includes('• Bring props'));
  assert.ok(text.includes('Portfolio (https://example.com/)'));
  assert.ok(text.endsWith('Planned with Dayline'));
  assert.ok(!text.includes('secret-id'));
});
test('reports are excluded by default and can be included independently', () => {
  assert.equal(SHARE_DEFAULTS.focusReports, false);
  assert.equal(SHARE_DEFAULTS.guidedReports, false);
  const base = shareNoteText(entry, '2026-10-23');
  assert.ok(!base.includes('Private'));
  const focus = shareNoteText(entry, '2026-10-23', { focusReports: true });
  assert.ok(focus.includes('Private interruption'));
  assert.ok(focus.includes('Private mantra'));
  assert.ok(focus.includes('Private next'));
  assert.ok(!focus.includes('Private work'));
  const guided = shareNoteText(entry, '2026-10-23', { guidedReports: true });
  assert.ok(guided.includes('Private spirituality'));
  assert.ok(!guided.includes('Private interruption'));
  assert.ok(!shareNoteText(entry, '2026-10-23').includes('Private'));
});
test('date/time and type can be excluded without altering the note or checkbox state', () => {
  const before = structuredClone(entry),
    text = shareNoteText(entry, '2026-10-23', { dateTime: false, type: false });
  assert.ok(!text.includes('10:15'));
  assert.ok(!text.includes('2026'));
  assert.ok(!text.includes('\nProject\n'));
  assert.deepEqual(entry, before);
});
test('email drafts encode title and exact preview contents without adding recipients or sending anything', () => {
  const text = 'A & B\n☐ Visit https://example.com/?a=1&b=2',
    url = emailNoteUrl('Prep & plans', text),
    query = new URLSearchParams(url.slice('mailto:?'.length));
  assert.equal(query.get('subject'), 'Prep & plans');
  assert.equal(query.get('body'), text);
  assert.equal(query.size, 2);
  assert.ok(url.startsWith('mailto:?'));
});

test('formatted shares preserve overlapping styles, colors, lists, links and indentation without executable HTML', async () => {
  const { shareNotesHtml } = await import('../../dist/js/features/sharing/share-note.js');
  const note = {
    ...entry,
    title: '<img src=x onerror=alert(1)>',
    text: 'Bold & safe\nDone\nBullet',
    tasks: [{ start: 12, done: true }],
    bullets: [{ start: 17 }],
    indents: [{ start: 17, level: 2 }],
    format: [
      {
        start: 0,
        end: 4,
        bold: true,
        italic: true,
        underline: true,
        highlight: 'blue',
        href: 'https://example.com/?a=1&b=2',
      },
    ],
  };
  const before = structuredClone(note);
  const html = shareNotesHtml([{ entry: note, date: '2026-10-23' }]);
  assert.ok(html.includes('<strong>Bold</strong>'));
  assert.ok(html.includes('<em>'));
  assert.ok(html.includes('<u>'));
  assert.ok(html.includes('background-color:#cde7ff'));
  assert.ok(html.includes('href="https://example.com/?a=1&amp;b=2"'));
  assert.ok(html.includes('☑ <s>Done</s>'));
  assert.ok(html.includes('    • Bullet'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('Private interruption'));
  assert.deepEqual(note, before);
  const bulk = shareNotesHtml(
    [
      { entry: note, date: '2026-10-23' },
      { entry, date: '2026-10-24' },
    ],
    { organize: 'category' },
    '12',
    '<Plan>',
  );
  assert.ok(bulk.includes('&lt;Plan&gt;'));
  assert.ok(bulk.includes('<strong>Bold</strong>'));
  assert.equal((bulk.match(/Planned with Dayline/g) || []).length, 1);
});

test('formatted clipboard includes HTML and text and falls back cleanly', async () => {
  const { copyFormatted } = await import('../../dist/js/features/sharing/share-format.js');
  let written;
  class Item {
    constructor(data) {
      this.data = data;
    }
  }
  assert.equal(
    await copyFormatted(
      '<b>Hello</b>',
      'Hello',
      {
        write: async (items) => {
          written = items[0].data;
        },
      },
      Item,
    ),
    true,
  );
  assert.equal(await written['text/html'].text(), '<b>Hello</b>');
  assert.equal(await written['text/plain'].text(), 'Hello');
  let plain;
  assert.equal(
    await copyFormatted(
      '<b>Hello</b>',
      'Hello',
      {
        write: async () => {
          throw Error('unsupported');
        },
        writeText: async (text) => {
          plain = text;
        },
      },
      Item,
    ),
    false,
  );
  assert.equal(plain, 'Hello');
});
