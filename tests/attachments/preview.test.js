import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  previewFormat,
  openAttachmentPreview,
} from '../../dist/js/features/attachments/preview.js';
import { attachmentList } from '../../dist/js/features/attachments/attachments.js';

const png = () =>
  new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], { type: 'text/html' });
test('preview format verifies image/PDF signatures, treats markup as text and rejects unsupported formats', async () => {
  assert.deepEqual(await previewFormat(png(), { name: 'image.png' }), {
    kind: 'image',
    type: 'image/png',
  });
  assert.equal(
    (await previewFormat(new Blob(['%PDF-1.7\n'], { type: 'text/html' }), { name: 'file.pdf' }))
      .kind,
    'pdf',
  );
  assert.equal(
    (
      await previewFormat(new Blob(['<script>bad()</script>'], { type: 'application/pdf' }), {
        name: 'spoof.pdf',
      })
    ).kind,
    'unsupported',
  );
  assert.equal(
    (
      await previewFormat(new Blob(['<svg onload="bad()"/>'], { type: 'image/svg+xml' }), {
        name: 'file.svg',
      })
    ).kind,
    'text',
  );
  assert.equal(
    (
      await previewFormat(new Blob(['<html>source</html>'], { type: 'text/html' }), {
        name: 'page.html',
      })
    ).kind,
    'text',
  );
  assert.equal(
    (await previewFormat(new Blob(['data'], { type: 'video/mp4' }), { name: 'clip.mp4' })).kind,
    'video',
  );
  assert.equal(
    (await previewFormat(new Blob(['data'], { type: 'audio/mpeg' }), { name: 'sound.mp3' })).kind,
    'audio',
  );
  assert.equal(
    (
      await previewFormat(
        new Blob(['data'], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
        { name: 'file.docx' },
      )
    ).kind,
    'unsupported',
  );
});

test('preview stays local, cleans up URLs/media, handles missing files and ignores stale reads', async () => {
  const previous = new Map(
    ['document', 'navigator'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const { window } = parseHTML('<html><body><button id="origin">Open</button></body></html>');
  const revoked = [],
    created = [];
  const options = {
    createURL: (blob) => {
      created.push(blob);
      return 'blob:preview-' + created.length;
    },
    revokeURL: (url) => revoked.push(url),
  };
  const item = { id: 'file-1', name: 'Image.png', type: 'image/png', size: 9 };
  let current;
  try {
    Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
    Object.defineProperty(globalThis, 'navigator', {
      value: { pdfViewerEnabled: true },
      configurable: true,
    });
    window.HTMLElement.prototype.showModal = function () {
      this.open = true;
    };
    window.HTMLElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new window.Event('close'));
    };
    window.HTMLElement.prototype.focus = function () {};
    window.HTMLElement.prototype.pause = function () {
      this.dataset.paused = 'true';
    };
    window.HTMLElement.prototype.load = function () {};
    current = await openAttachmentPreview(item, async () => png(), options);
    assert.equal(created.length, 1);
    assert.equal(created[0].type, 'image/png');
    assert.equal(current.dialog.querySelector('img').alt, 'Image.png');
    assert.equal(current.dialog.querySelector('a[download]'), null);
    current.close();
    assert.deepEqual(revoked, ['blob:preview-1']);
    assert.equal(document.querySelector('dialog'), null);
    current = await openAttachmentPreview(
      { ...item, name: 'source.html' },
      async () =>
        new Blob(['<script>bad()</script><img src="https://example.invalid">'], {
          type: 'text/html',
        }),
      options,
    );
    assert.match(current.dialog.querySelector('pre').textContent, /<script>/);
    assert.equal(current.dialog.querySelector('script,img,iframe'), null);
    assert.equal(created.length, 1);
    current.close();
    current = await openAttachmentPreview(
      { ...item, name: 'large.txt' },
      async () => new Blob(['a'.repeat(270000)], { type: 'text/plain' }),
      options,
    );
    assert.equal(current.dialog.querySelector('pre').textContent.length, 256 * 1024);
    assert.match(current.dialog.textContent, /first 256 KB/);
    current.close();
    current = await openAttachmentPreview(item, async () => null, options);
    assert.match(current.dialog.textContent, /not stored on this device/);
    assert.equal(current.dialog.querySelector('button.secondary').disabled, true);
    current.close();
    current = await openAttachmentPreview(
      { ...item, name: 'file.docx' },
      async () => new Blob(['office']),
      options,
    );
    assert.match(current.dialog.textContent, /preview is not available/);
    assert.equal(current.dialog.querySelector('button.secondary').disabled, false);
    current.close();
    navigator.pdfViewerEnabled = false;
    current = await openAttachmentPreview(
      { ...item, name: 'file.pdf' },
      async () => new Blob(['%PDF-1.7\n']),
      options,
    );
    assert.equal(current.dialog.querySelector('iframe'), null);
    assert.equal(created.length, 1);
    current.close();
    navigator.pdfViewerEnabled = true;
    let resolveRead;
    const pending = openAttachmentPreview(
      item,
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
      options,
    );
    const old = document.querySelector('dialog');
    old.querySelector('button').click();
    resolveRead(png());
    await pending;
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(created.length, 1);
    current = await openAttachmentPreview(
      { ...item, name: 'file.pdf' },
      async () => new Blob(['%PDF-1.7\n']),
      options,
    );
    assert.equal(current.dialog.querySelector('iframe').getAttribute('src'), 'blob:preview-2');
    current.close();
    assert.equal(revoked.at(-1), 'blob:preview-2');
    current = await openAttachmentPreview(
      { ...item, name: 'sound.mp3' },
      async () => new Blob(['audio'], { type: 'audio/mpeg' }),
      options,
    );
    const audio = current.dialog.querySelector('audio');
    assert.equal(audio.controls, true);
    current.close();
    assert.equal(audio.dataset.paused, 'true');
    assert.equal(audio.getAttribute('src'), null);
    const removed = [];
    const list = attachmentList([item], (id) => removed.push(id));
    assert.ok(list.querySelector('[aria-label="View attachment Image.png"]'));
    assert.ok(list.querySelector('[aria-label="Download attachment Image.png"]'));
    list.querySelector('[aria-label="Remove attachment Image.png"]').click();
    assert.deepEqual(removed, ['file-1']);
  } finally {
    current?.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
