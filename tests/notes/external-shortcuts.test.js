import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createNoteEditor } from '../../dist/js/features/notes/note-editor.js';
import { validState } from '../../dist/js/shared/storage.js';
import { shareNoteText } from '../../dist/js/features/sharing/share-note.js';

test('shared editor offers safe Google shortcuts without connection setup or editing the note', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const { document } = parseHTML('<html><head></head><body></body></html>');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  let saves = 0;
  const entry = {
    id: 'saved',
    minute: 600,
    title: 'Keep',
    text: 'Google Meet',
    done: false,
    format: [{ start: 0, end: 11, href: 'https://meet.google.com/abc-defg-hij' }],
    tasks: [],
  };
  const original = structuredClone(entry);
  let editor;
  try {
    editor = createNoteEditor({
      entry,
      label: 'Note',
      onChange() {
        saves++;
      },
      onDone() {},
    });
    document.body.append(editor.element);
    const links = [...editor.element.querySelectorAll('.note-external-shortcuts a')];
    assert.deepEqual(
      links.map((link) => [link.textContent, link.href]),
      [
        ['Open Google Meet', 'https://meet.google.com/'],
        ['Open Google Drive', 'https://drive.google.com/'],
      ],
    );
    for (const link of links) {
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
      assert.equal(link.href.includes('Keep'), false);
    }
    assert.equal(document.querySelectorAll('script,iframe').length, 0);
    assert.equal(saves, 0);
    assert.deepEqual(entry, original);
    const restored = validState({ version: 1, days: { '2026-10-26': [entry] } }).days[
      '2026-10-26'
    ][0];
    assert.ok(shareNoteText(restored, '2026-10-26').includes(entry.format[0].href));
    assert.ok(editor.element.textContent.includes('paste it into this note'));
  } finally {
    editor?.destroy();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
