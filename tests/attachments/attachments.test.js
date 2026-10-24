import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validAttachments,
  addFiles,
  exportFiles,
  prepareFiles,
  MAX_FILE_SIZE,
} from '../../dist/js/features/attachments/attachments.js';
import { validState } from '../../dist/js/shared/storage.js';
const meta = { id: 'file-1', name: 'notes.txt', type: 'text/plain', size: 5 };
const state = {
  version: 1,
  days: {
    '2026-10-23': [{ id: 'note-1', minute: 600, text: '', done: false, attachments: [meta] }],
  },
  settings: { interval: 60 },
};
test('attachment-only notes and metadata survive validated storage', () => {
  assert.deepEqual(validState(state).days['2026-10-23'][0].attachments, [meta]);
  for (const attachments of [
    [meta, meta],
    [{ ...meta, size: -1 }],
    [{ ...meta, size: MAX_FILE_SIZE + 1 }],
    [{ ...meta, id: '../file' }],
    Array(11).fill(meta),
  ])
    assert.throws(() => validAttachments(attachments));
});
test('file batches reject limits before touching file storage', async () => {
  let writes = 0;
  const write = async () => {
    writes++;
  };
  await assert.rejects(addFiles([{ name: 'huge', size: MAX_FILE_SIZE + 1 }], [], write), /10 MB/);
  await assert.rejects(addFiles([{}], Array(10).fill(meta), write), /10 attachments/);
  assert.equal(writes, 0);
});
test('binary backups round trip and assign fresh IDs to protect existing files', async () => {
  const blob = new Blob(['hello'], { type: 'text/plain' }),
    backup = await exportFiles(state, async () => blob);
  assert.equal(backup.attachmentFiles[meta.id], 'aGVsbG8=');
  const restored = prepareFiles(validState(backup), backup.attachmentFiles);
  const item = restored.state.days['2026-10-23'][0].attachments[0];
  assert.notEqual(item.id, meta.id);
  assert.equal(item.id, restored.files[0].id);
  assert.equal(await restored.files[0].blob.text(), 'hello');
  assert.equal(state.days['2026-10-23'][0].attachments[0].id, meta.id);
});
test('missing and corrupt attachment data cannot silently produce an incomplete backup', async () => {
  await assert.rejects(
    exportFiles(state, async () => undefined),
    /Missing file/,
  );
  assert.throws(() => prepareFiles(state, {}), /Missing or invalid/);
  assert.throws(() => prepareFiles(state, { 'file-1': '!bad' }), /Missing or invalid/);
  assert.throws(() => prepareFiles(state, { 'file-1': 'YQ==' }), /Invalid file size/);
  assert.deepEqual(prepareFiles(validState({ version: 1, days: {} }), undefined).files, []);
});
test('successful uploads await durable storage and propagate write failures', async () => {
  const file = new Blob(['hello'], { type: 'text/plain' });
  file.name = 'notes.txt';
  let stored;
  const added = await addFiles([file], [], async (items) => {
    stored = items;
  });
  assert.equal(added[0].name, 'notes.txt');
  assert.equal(stored[0].id, added[0].id);
  assert.equal(stored[0].blob, file);
  await assert.rejects(
    addFiles([file], [], async () => {
      throw new Error('Quota');
    }),
    /Quota/,
  );
});
