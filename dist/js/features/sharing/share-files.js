import { readFile } from '../attachments/attachments.js?v=02773a4d1197';
export function shareAttachments(items) {
  return [
    ...new Map(
      items.flatMap(({ entry }) => entry.attachments || []).map((file) => [file.id, file]),
    ).values(),
  ];
}
export async function prepareShareFiles(items, read = readFile) {
  const names = new Set(),
    files = [];
  for (const item of shareAttachments(items)) {
    const blob = await read(item.id);
    if (!blob)
      throw new Error(
        `${item.name} is missing on this device. Restore a backup containing it first.`,
      );
    let name = item.name,
      index = 2;
    const dot = name.lastIndexOf('.'),
      base = dot > 0 ? name.slice(0, dot) : name,
      extension = dot > 0 ? name.slice(dot) : '';
    while (names.has(name.toLowerCase())) name = `${base}-${index++}${extension}`;
    names.add(name.toLowerCase());
    files.push(
      new File([blob], name, { type: item.type || blob.type || 'application/octet-stream' }),
    );
  }
  return files;
}
export function supportsFileShare(files, nav = navigator) {
  try {
    return (
      !!files.length &&
      typeof nav.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files })
    );
  } catch {
    return false;
  }
}
