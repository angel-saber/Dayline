import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createNoteEditor } from '../../dist/js/features/notes/note-editor.js';

test('shared editor inserts Google links into latest text, survives popup clicks, rolls back save failure and ignores stale results', async () => {
  const names = ['window', 'document', 'Node', 'NodeFilter'];
  const previous = new Map(
    names.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const { window, document } = parseHTML('<html><head></head><body></body></html>');
  window.getSelection = () => null;
  let resolveGoogle,
    requestedSignal,
    saved,
    refuse = false,
    closed = 0;
  const entry = { title: 'Existing title', text: 'Keep this', format: [], tasks: [] };
  try {
    for (const [name, value] of Object.entries({
      window,
      document,
      Node: window.Node,
      NodeFilter: { SHOW_TEXT: 4 },
    }))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    const editor = createNoteEditor({
      entry,
      label: 'Note',
      onChange(value) {
        saved = value;
        return !refuse;
      },
      onDone() {
        closed++;
      },
      openGoogle(action, { signal }) {
        assert.equal(action, 'drive');
        requestedSignal = signal;
        return new Promise((resolve) => {
          resolveGoogle = resolve;
        });
      },
    });
    document.body.append(editor.element);
    const button = [...editor.element.querySelectorAll('button')].find(
      (button) => button.textContent === 'Attach from Drive',
    );
    button.click();
    assert.equal(button.disabled, true);
    document.body.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(closed, 0);
    const title = editor.element.querySelector('.note-title-input');
    title.value = 'Edited while connecting';
    title.dispatchEvent(new window.Event('input'));
    resolveGoogle([{ name: 'Outline', url: 'https://drive.google.com/file/d/abc/view' }]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(saved.title, 'Edited while connecting');
    assert.equal(saved.text, 'Keep this\nOutline');
    assert.equal(saved.format.at(-1).href, 'https://drive.google.com/file/d/abc/view');
    assert.equal(button.disabled, false);
    refuse = true;
    button.click();
    resolveGoogle([{ name: 'Unsaved', url: 'https://drive.google.com/file/d/xyz/view' }]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(editor.element.textContent, /Could not save the links/);
    assert.match(editor.element.textContent, /https:\/\/drive.google.com\/file\/d\/xyz\/view/);
    assert.equal(editor.element.querySelector('.rich-editor').textContent, 'Keep thisOutline');
    refuse = false;
    button.click();
    editor.destroy();
    assert.equal(requestedSignal.aborted, true);
    const before = saved;
    resolveGoogle([{ name: 'Stale', url: 'https://drive.google.com/file/d/stale/view' }]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(saved, before);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
