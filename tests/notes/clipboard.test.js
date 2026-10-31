import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  noteFragment,
  writeNoteClipboard,
  readNoteClipboard,
  pasteNoteFragment,
  NOTE_CLIPBOARD,
} from '../../dist/js/features/notes/clipboard.js';
import { validState } from '../../dist/js/shared/storage.js';
import { createNoteEditor } from '../../dist/js/features/notes/note-editor.js';
import { renderNoteLines } from '../../dist/js/features/notes/render.js';
const source = {
  text: 'First\nSecond\nThird',
  format: [
    {
      start: 0,
      end: 12,
      bold: true,
      italic: true,
      underline: true,
      highlight: 'green',
      href: 'https://example.com/',
    },
  ],
  tasks: [{ start: 0, done: true }],
  bullets: [{ start: 6 }],
  indents: [{ start: 6, level: 2 }],
};
const clipboard = () => {
  const values = new Map();
  return { getData: (k) => values.get(k) || '', setData: (k, v) => values.set(k, v), values };
};
const empty = (text) => ({ text, format: [], tasks: [], bullets: [], indents: [] });
test('whole and partial note copies round-trip styles and line tools through custom and HTML clipboard formats', () => {
  const fragment = noteFragment(source, 0, source.text.length),
    data = clipboard();
  assert.equal(writeNoteClipboard(data, fragment), true);
  assert.deepEqual(readNoteClipboard(data), { ...source });
  data.values.delete(NOTE_CLIPBOARD);
  assert.deepEqual(readNoteClipboard(data), { ...source });
  assert.ok(data.getData('text/html').includes('<strong>'));
  assert.ok(data.getData('text/html').includes('☑'));
  const part = noteFragment(source, 2, 10);
  assert.equal(part.text, 'rst\nSeco');
  assert.deepEqual(part.tasks, [{ start: 0, done: true }]);
  assert.deepEqual(part.bullets, [{ start: 4 }]);
  assert.equal(part.format[0].end, 8);
});
test('copy retains an empty trailing task line and literal markup remains text', () => {
  const state = { ...empty('<img>\n'), tasks: [{ start: 6, done: false }] };
  const data = clipboard();
  writeNoteClipboard(data, noteFragment(state, 0, state.text.length));
  assert.ok(data.getData('text/html').includes('&lt;img&gt;'));
  assert.ok(!data.getData('text/html').includes('<img>'));
  assert.deepEqual(readNoteClipboard(data), state);
});
test('paste replaces only selected text, offsets styles, preserves neighbors, and applies line tools only to destination line starts', () => {
  const fragment = noteFragment(source, 0, source.text.length);
  const state = {
    ...empty('Before\nreplace\nAfter'),
    format: [{ start: 15, end: 20, italic: true }],
  };
  const next = pasteNoteFragment(state, 7, 14, fragment);
  assert.equal(next.text, 'Before\nFirst\nSecond\nThird\nAfter');
  assert.deepEqual(next.tasks, [{ start: 7, done: true }]);
  assert.deepEqual(next.bullets, [{ start: 13 }]);
  assert.deepEqual(next.indents, [{ start: 13, level: 2 }]);
  assert.ok(next.format.some((m) => m.start === 26 && m.italic));
  const inline = pasteNoteFragment(empty('prefix '), 7, 7, fragment);
  assert.deepEqual(inline.tasks, []);
  assert.deepEqual(inline.bullets, [{ start: 13 }]);
  const note = { ...next, id: 'pasted', minute: 600, done: false };
  assert.deepEqual(
    validState({ version: 1, days: { '2026-10-28': [note] } }).days['2026-10-28'][0],
    note,
  );
  assert.equal(state.text, 'Before\nreplace\nAfter');
});
test('untrusted clipboard ranges, links, versions and mismatched plain text fall back safely', () => {
  for (const patch of [
    { version: 2 },
    { format: [{ start: 0, end: 900, bold: true }] },
    { format: [{ start: 0, end: 1, href: 'javascript:alert(1)' }] },
    { tasks: [{ start: 2, done: true }] },
    { indents: [{ start: 0, level: 999 }] },
  ]) {
    const data = clipboard(),
      fragment = { ...noteFragment(source, 0, 5), ...patch };
    data.setData('text/plain', fragment.text);
    data.setData(NOTE_CLIPBOARD, JSON.stringify(fragment));
    assert.equal(readNoteClipboard(data), null);
  }
  const data = clipboard();
  writeNoteClipboard(data, noteFragment(source, 0, 5));
  data.setData('text/plain', 'Something else');
  assert.equal(readNoteClipboard(data), null);
  data.values.delete(NOTE_CLIPBOARD);
  data.setData('text/html', '<img src=x onerror=alert(1)><b>Something else</b>');
  assert.equal(readNoteClipboard(data), null);
});
test('editor copy, cut, paste and undo use the same model as displayed-note copying', () => {
  const { window } = parseHTML('<html><body></body></html>'),
    { document } = window;
  const globals = ['window', 'document', 'Node', 'NodeFilter'];
  const previous = globals.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  Object.assign(globalThis, { window, document, Node: window.Node, NodeFilter: { SHOW_TEXT: 4 } });
  let native;
  window.getSelection = () => native || { rangeCount: 0, removeAllRanges() {}, addRange() {} };
  document.createRange = () => ({ setStart() {}, setEnd() {} });
  const select = (surface, end) => {
    native = {
      rangeCount: 1,
      anchorNode: surface,
      anchorOffset: 0,
      focusNode: surface,
      focusOffset: end,
      removeAllRanges() {},
      addRange() {},
    };
  };
  const event = (type, data) => {
    const e = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'clipboardData', { value: data });
    return e;
  };
  let editor, target;
  try {
    editor = createNoteEditor({ entry: { ...source, task: false }, onChange() {}, onDone() {} });
    document.body.append(editor.element);
    const surface = editor.element.querySelector('.rich-editor');
    select(surface, surface.children.length);
    const data = clipboard();
    surface.dispatchEvent(event('copy', data));
    assert.deepEqual(readNoteClipboard(data), source);
    let saved;
    target = createNoteEditor({
      onChange: (s) => {
        saved = s;
      },
      onDone() {},
    });
    document.body.append(target.element);
    const destination = target.element.querySelector('.rich-editor');
    target.setTags(['personal']);
    assert.equal(saved, undefined);
    assert.equal(
      target.element.querySelector('[data-note-type=personal]').getAttribute('aria-pressed'),
      'true',
    );
    select(destination, 0);
    destination.dispatchEvent(event('paste', data));
    assert.equal(saved.text, source.text);
    assert.deepEqual(saved.tags, ['personal']);
    assert.deepEqual(saved.format, source.format);
    assert.deepEqual(saved.tasks, source.tasks);
    const undo = new window.Event('beforeinput', { cancelable: true });
    Object.defineProperty(undo, 'inputType', { value: 'historyUndo' });
    native = null;
    destination.dispatchEvent(undo);
    assert.equal(saved.text, '');
    select(surface, surface.children.length);
    surface.dispatchEvent(event('cut', data));
    assert.equal(surface.textContent.replace(/\u200b/g, ''), '');
    const body = document.createElement('div');
    document.body.append(body);
    renderNoteLines(
      body,
      source.text,
      source.format,
      source.tasks,
      () => {},
      null,
      source.bullets,
      source.indents,
    );
    select(body, body.children.length);
    const rendered = clipboard();
    body.dispatchEvent(event('copy', rendered));
    assert.deepEqual(readNoteClipboard(rendered), source);
  } finally {
    editor?.destroy();
    target?.destroy();
    for (const [k, d] of previous) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
});
