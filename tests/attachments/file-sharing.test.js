import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compressionType,
  scaledDimensions,
  prepareUploadFiles,
  compressPdf,
} from '../../dist/js/features/attachments/file-compression.js';
import {
  shareAttachments,
  prepareShareFiles,
  supportsFileShare,
} from '../../dist/js/features/sharing/share-files.js';
import { SHARE_DEFAULTS } from '../../dist/js/features/sharing/share-note.js';
import * as pdf from '../../dist/vendor/pdf-lib-1.17.1.js';
import { MAX_FILE_SIZE } from '../../dist/js/features/attachments/attachments.js';
const file = (name, type, size) => ({ name, type, size });
test('only PDF and JPEG/PNG/WebP offer compression, with extension fallback for empty MIME', () => {
  for (const [name, type] of [
    ['a.pdf', 'application/pdf'],
    ['a.jpeg', 'image/jpeg'],
    ['a.png', 'image/png'],
    ['a.webp', 'image/webp'],
  ]) {
    assert.equal(compressionType(file(name, type, 1)), type);
    assert.equal(compressionType(file(name, '', 1)), type);
  }
  for (const [name, type] of [
    ['a.zip', 'application/zip'],
    ['a.mp4', 'video/mp4'],
    ['a.mp3', 'audio/mpeg'],
    ['a.gif', 'image/gif'],
    ['a.svg', 'image/svg+xml'],
    ['a.pdf', 'video/mp4'],
  ])
    assert.equal(compressionType(file(name, type, 1)), null);
});
test('image dimensions preserve aspect ratio, do not upscale, and reject excessive pixel counts', () => {
  assert.deepEqual(scaledDimensions(4000, 2000, 1600), [1600, 800]);
  assert.deepEqual(scaledDimensions(600, 1200, 600), [300, 600]);
  assert.deepEqual(scaledDimensions(200, 100), [200, 100]);
  assert.throws(() => scaledDimensions(20000, 20000));
});
test('oversized unsupported files are rejected before review, and cancellation adds none of a batch', async () => {
  let reviews = 0;
  const review = async () => {
    reviews++;
    return null;
  };
  await assert.rejects(
    prepareUploadFiles([file('clip.mp4', 'video/mp4', MAX_FILE_SIZE + 1)], review),
    /only PDF/,
  );
  assert.equal(reviews, 0);
  assert.equal(
    await prepareUploadFiles(
      [file('small.txt', 'text/plain', 1), file('big.jpg', 'image/jpeg', MAX_FILE_SIZE + 1)],
      review,
    ),
    null,
  );
  assert.equal(reviews, 1);
  await assert.rejects(
    prepareUploadFiles([file('huge.pdf', 'application/pdf', 101 * 1024 * 1024)], review),
    /100 MB/,
  );
});
test('accepted copies must fit and keep the original format; originals remain unchanged', async () => {
  const original = file('original.png', 'image/png', MAX_FILE_SIZE + 1),
    copy = file('original.png', 'image/png', 1234);
  assert.deepEqual(await prepareUploadFiles([original], async () => copy), [copy]);
  assert.equal(original.size, MAX_FILE_SIZE + 1);
  await assert.rejects(
    prepareUploadFiles([original], async () => file('copy.jpg', 'image/jpeg', 123)),
    /preserve/,
  );
  await assert.rejects(
    prepareUploadFiles([original], async () => original),
    /fit/,
  );
});
test('PDF optimization produces a readable PDF preserving text, page count and dimensions', async () => {
  const document = await pdf.PDFDocument.create();
  document.addPage([400, 600]).drawText('Dayline PDF compression test');
  const original = new File([await document.save({ useObjectStreams: false })], 'document.pdf', {
    type: 'application/pdf',
  });
  const result = await compressPdf(original, async () => pdf),
    restored = await pdf.PDFDocument.load(await result.file.arrayBuffer());
  assert.equal(result.file.name, original.name);
  assert.equal(result.file.type, 'application/pdf');
  assert.equal(restored.getPageCount(), 1);
  assert.equal(restored.getPage(0).getWidth(), 400);
  assert.equal(restored.getPage(0).getHeight(), 600);
  assert.ok(result.file.size < original.size);
  const streams = [...restored.context.enumerateIndirectObjects()]
    .map(([, value]) => value)
    .filter((value) => value instanceof pdf.PDFRawStream);
  assert.ok(
    streams.some((stream) =>
      new TextDecoder().decode(pdf.decodePDFRawStream(stream).decode()).includes('4461796C696E65'),
    ),
  );
});
test('signed and invalid PDFs are rejected instead of returning a misleading copy', async () => {
  const document = await pdf.PDFDocument.create();
  document.addPage();
  const signature = document.context.obj({ FT: 'Sig', T: pdf.PDFHexString.fromText('Signature') });
  const reference = document.context.register(signature);
  document.getForm().acroForm.addField(reference);
  await assert.rejects(
    compressPdf(
      new File([await document.save()], 'signed.pdf', { type: 'application/pdf' }),
      async () => pdf,
    ),
    /Signed PDFs/,
  );
  await assert.rejects(
    compressPdf(new File(['not PDF'], 'invalid.pdf', { type: 'application/pdf' }), async () => pdf),
  );
});
test('file sharing defaults off, deduplicates shared references and preserves distinct filename collisions', async () => {
  assert.equal(SHARE_DEFAULTS.attachments, false);
  const a = { id: 'a', name: 'plan.pdf', type: 'application/pdf' },
    b = { id: 'b', name: 'plan.pdf', type: 'application/pdf' };
  const items = [{ entry: { attachments: [a] } }, { entry: { attachments: [a, b] } }];
  assert.deepEqual(shareAttachments(items), [a, b]);
  const files = await prepareShareFiles(items, async (id) => new Blob([id]));
  assert.deepEqual(
    files.map((file) => file.name),
    ['plan.pdf', 'plan-2.pdf'],
  );
  assert.equal(await files[1].text(), 'b');
  assert.equal(files[0].type, 'application/pdf');
  await assert.rejects(
    prepareShareFiles(items, async () => null),
    /missing on this device/,
  );
});
test('file sharing support is checked for the actual file batch without silently omitting files', () => {
  const files = [new File(['x'], 'x.txt', { type: 'text/plain' })];
  assert.equal(
    supportsFileShare(files, { share() {}, canShare: (data) => data.files === files }),
    true,
  );
  for (const nav of [
    {},
    { share() {} },
    { share() {}, canShare: () => false },
    {
      share() {},
      canShare() {
        throw Error();
      },
    },
  ])
    assert.equal(supportsFileShare(files, nav), false);
  assert.equal(supportsFileShare([], { share() {}, canShare: () => true }), false);
});
