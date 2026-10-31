import { openAttachmentPreview, downloadAttachmentBlob } from './preview.js?v=f2c75fe48c17';
// Files stay in this browser; notes contain only small, portable references.
export const MAX_FILE_SIZE = 10 * 1024 * 1024,
  MAX_ATTACHMENTS = 10,
  MAX_BACKUP_SIZE = 100 * 1024 * 1024;
export function validAttachments(value) {
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS)
    throw new Error('Invalid attachments.');
  const seen = new Set();
  return value.map((item) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !/^[\w-]{1,100}$/.test(item.id) ||
      seen.has(item.id) ||
      typeof item.name !== 'string' ||
      !item.name.length ||
      item.name.length > 255 ||
      typeof item.type !== 'string' ||
      item.type.length > 200 ||
      !Number.isInteger(item.size) ||
      item.size < 0 ||
      item.size > MAX_FILE_SIZE
    )
      throw new Error('Invalid attachment.');
    seen.add(item.id);
    return { id: item.id, name: item.name, type: item.type, size: item.size };
  });
}
let database;
function openDatabase() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('dayline-files', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('File storage is unavailable in this browser.'));
      request.onblocked = () => reject(new Error('Close other Dayline tabs and try again.'));
    }).catch((error) => {
      database = null;
      throw error;
    });
  return database;
}
export async function storeFiles(items) {
  if (!items.length) return;
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    for (const { id, blob } of items) tx.objectStore('files').put(blob, id);
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () =>
      reject(new Error('Could not store files. Your browser may be out of space.'));
  });
}
export async function readFile(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('files').objectStore('files').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not read this file.'));
  });
}
export async function addFiles(files, current = [], write = storeFiles) {
  files = Array.from(files);
  if (!files.length) return [];
  if (current.length + files.length > MAX_ATTACHMENTS)
    throw new Error('Use up to 10 attachments per note.');
  if (files.some((file) => file.size > MAX_FILE_SIZE))
    throw new Error('Each file must be 10 MB or smaller.');
  const metadata = validAttachments(
    files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
    })),
  );
  await write(metadata.map((item, i) => ({ id: item.id, blob: files[i] })));
  return metadata;
}
export function attachmentList(items = [], remove) {
  const list = document.createElement('ul');
  list.className = 'attachment-list';
  for (const item of items) {
    const row = document.createElement('li'),
      download = document.createElement('button');
    download.type = 'button';
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'attachment-preview-link';
    preview.textContent = `${item.name} · ${item.size < 1024 ? item.size + ' B' : item.size < 1048576 ? Math.ceil(item.size / 1024) + ' KB' : (item.size / 1048576).toFixed(1) + ' MB'}`;
    preview.title = 'View attachment';
    preview.setAttribute('aria-label', `View attachment ${item.name}`);
    preview.addEventListener('click', () => openAttachmentPreview(item, () => readFile(item.id)));
    download.textContent = '↓ Download';
    download.title = 'Download attachment';
    download.setAttribute('aria-label', `Download attachment ${item.name}`);
    download.addEventListener('click', async () => {
      try {
        const blob = await readFile(item.id);
        if (!blob)
          throw new Error(
            'This file is not stored on this device. Restore a backup containing the file.',
          );
        downloadAttachmentBlob(item, blob);
      } catch (error) {
        message.textContent = error.message;
      }
    });
    row.append(preview, download);
    if (remove) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Remove';
      button.setAttribute('aria-label', `Remove attachment ${item.name}`);
      button.onclick = () => remove(item.id);
      row.append(button);
    }
    list.append(row);
  }
  const message = document.createElement('li');
  message.className = 'field-hint';
  message.setAttribute('role', 'status');
  list.append(message);
  return list;
}
function references(state) {
  return [
    ...new Map(
      Object.values(state.days)
        .flat()
        .flatMap((note) => note.attachments || [])
        .map((item) => [item.id, item]),
    ).values(),
  ];
}
export async function exportFiles(state, read = readFile) {
  const attachmentFiles = {};
  let total = 0;
  for (const item of references(state)) {
    const blob = await read(item.id);
    if (!blob)
      throw new Error(`Missing file: ${item.name}. Restore it on this device before exporting.`);
    total += blob.size;
    if (total > 70 * 1024 * 1024) throw new Error('Attachments exceed the 70 MB backup limit.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let at = 0; at < bytes.length; at += 8192)
      binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
    attachmentFiles[item.id] = btoa(binary);
  }
  return { ...state, attachmentFiles };
}
export function prepareFiles(state, encoded) {
  const files = [],
    mapping = new Map();
  if (encoded === undefined) return { state, files }; // Older backups may contain references only.
  if (!encoded || typeof encoded !== 'object' || Array.isArray(encoded))
    throw new Error('Invalid attachment backup.');
  const next = structuredClone(state);
  let total = 0;
  for (const item of references(state)) {
    const value = encoded[item.id];
    if (
      typeof value !== 'string' ||
      value.length > Math.ceil(MAX_FILE_SIZE / 3) * 4 ||
      /[^A-Za-z0-9+/=]/.test(value)
    )
      throw new Error(`Missing or invalid file: ${item.name}`);
    let binary;
    try {
      binary = atob(value);
    } catch {
      throw new Error(`Invalid file: ${item.name}`);
    }
    if (binary.length !== item.size) throw new Error(`Invalid file size: ${item.name}`);
    total += binary.length;
    if (total > 70 * 1024 * 1024) throw new Error('Attachments exceed the 70 MB backup limit.');
    const id = crypto.randomUUID();
    mapping.set(item.id, id);
    files.push({
      id,
      blob: new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], { type: item.type }),
    });
  }
  for (const notes of Object.values(next.days))
    for (const note of notes)
      if (note.attachments)
        note.attachments = note.attachments.map((item) => ({ ...item, id: mapping.get(item.id) }));
  return { state: next, files };
}

export function bindFileDrop(host, onFiles) {
  host.addEventListener('dragover', (event) => {
    if ([...event.dataTransfer.types].includes('Files')) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      host.classList.add('file-drop-active');
    }
  });
  host.addEventListener('dragleave', (event) => {
    if (!host.contains(event.relatedTarget)) host.classList.remove('file-drop-active');
  });
  host.addEventListener('drop', (event) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    event.stopPropagation();
    host.classList.remove('file-drop-active');
    onFiles(Array.from(event.dataTransfer.files));
  });
}
