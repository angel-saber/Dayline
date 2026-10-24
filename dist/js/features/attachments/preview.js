// Preview local bytes only. Never navigate to uploaded HTML or use an online viewer.
const TEXT_LIMIT = 256 * 1024;
const MEDIA = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
]);
export async function previewFormat(blob, item) {
  const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const starts = (values) => values.every((value, index) => bytes[index] === value);
  const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to));
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return { kind: 'image', type: 'image/png' };
  if (starts([255, 216, 255])) return { kind: 'image', type: 'image/jpeg' };
  if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return { kind: 'image', type: 'image/gif' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    return { kind: 'image', type: 'image/webp' };
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12)))
    return { kind: 'image', type: 'image/avif' };
  if (ascii(0, 2) === 'BM') return { kind: 'image', type: 'image/bmp' };
  if (ascii(0, 5) === '%PDF-') return { kind: 'pdf', type: 'application/pdf' };
  const type = (blob.type || item.type || '').toLowerCase().split(';')[0].trim();
  if (MEDIA.has(type)) return { kind: type.startsWith('audio/') ? 'audio' : 'video', type };
  // HTML, SVG and other markup may be read as inert source text, never embedded.
  if (
    type.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/javascript', 'image/svg+xml'].includes(
      type,
    ) ||
    /\.(txt|md|csv|tsv|log|json|xml|html?|svg|css|js)$/i.test(item.name)
  )
    return { kind: 'text', type: 'text/plain' };
  return { kind: 'unsupported' };
}
export function downloadAttachmentBlob(item, blob) {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = item.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
let active;
export async function openAttachmentPreview(
  item,
  read,
  {
    createURL = (blob) => URL.createObjectURL(blob),
    revokeURL = (url) => URL.revokeObjectURL(url),
  } = {},
) {
  active?.close();
  const dialog = document.createElement('dialog');
  dialog.className = 'attachment-preview-window';
  dialog.setAttribute('aria-labelledby', 'attachment-preview-title');
  const header = document.createElement('div');
  header.className = 'attachment-preview-header';
  const title = document.createElement('h2');
  title.id = 'attachment-preview-title';
  title.textContent = item.name;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close preview';
  header.append(title, close);
  const content = document.createElement('div');
  content.className = 'attachment-preview-content';
  content.textContent = 'Loading attachment…';
  const status = document.createElement('p');
  status.className = 'field-hint';
  status.setAttribute('role', 'status');
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'secondary';
  download.textContent = 'Download';
  download.disabled = true;
  dialog.append(header, content, status, download);
  document.body.append(dialog);
  let closed = false,
    blob,
    url;
  const previousFocus = document.activeElement;
  function dispose() {
    if (closed) return;
    closed = true;
    for (const media of content.querySelectorAll('audio,video')) {
      media.pause();
      media.removeAttribute('src');
      media.load();
    }
    if (url) revokeURL(url);
    dialog.remove();
    if (active?.dialog === dialog) active = null;
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  function closePreview() {
    if (dialog.open) dialog.close();
    dispose();
  }
  active = { dialog, close: closePreview };
  close.addEventListener('click', closePreview);
  dialog.addEventListener('close', dispose);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closePreview();
  });
  let backdrop = false;
  function outside(event) {
    const r = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    );
  }
  dialog.addEventListener('pointerdown', (event) => {
    backdrop = event.isPrimary && event.button === 0 && outside(event);
  });
  dialog.addEventListener('pointerup', (event) => {
    if (backdrop && outside(event)) closePreview();
    backdrop = false;
  });
  dialog.addEventListener('pointercancel', () => {
    backdrop = false;
  });
  download.addEventListener('click', () => {
    if (blob) downloadAttachmentBlob(item, blob);
  });
  dialog.showModal();
  try {
    blob = await read();
    if (closed) return;
    if (!(blob instanceof Blob))
      throw new Error(
        'This file is not stored on this device. Restore a backup containing the file.',
      );
    const format = await previewFormat(blob, item);
    if (closed) return;
    download.disabled = false;
    content.replaceChildren();
    if (format.kind === 'text') {
      const text = await blob.slice(0, TEXT_LIMIT).text();
      if (closed) return;
      const pre = document.createElement('pre');
      pre.textContent = text;
      content.append(pre);
      status.textContent =
        blob.size > TEXT_LIMIT
          ? 'Showing the first 256 KB. Download to read the complete file.'
          : 'Text preview. Markup is displayed as source text.';
    } else if (
      format.kind === 'unsupported' ||
      (format.kind === 'pdf' && globalThis.navigator?.pdfViewerEnabled === false)
    ) {
      content.textContent = 'A preview is not available for this file type in your browser.';
      status.textContent = 'You can still download the original file.';
    } else {
      // Re-type verified image/PDF bytes so an untrusted supplied MIME cannot load HTML.
      url = createURL(new Blob([blob], { type: format.type }));
      const view = document.createElement(
        format.kind === 'image' ? 'img' : format.kind === 'pdf' ? 'iframe' : format.kind,
      );
      if (format.kind === 'image') view.alt = item.name;
      else if (format.kind === 'pdf') {
        view.title = 'PDF preview: ' + item.name;
        view.referrerPolicy = 'no-referrer';
      } else {
        view.controls = true;
        view.preload = 'metadata';
      }
      view.addEventListener('error', () => {
        status.textContent =
          'Your browser could not display this file. Download remains available.';
      });
      view.src = url;
      content.append(view);
      status.textContent =
        format.kind === 'pdf'
          ? 'PDF preview uses your browser’s viewer. If it does not display, Download remains available.'
          : 'Preview only. The original attachment is unchanged.';
    }
  } catch (error) {
    if (!closed) {
      content.textContent = 'Unable to preview this attachment.';
      status.textContent = error.message;
    }
  }
  return { dialog, close: closePreview };
}
