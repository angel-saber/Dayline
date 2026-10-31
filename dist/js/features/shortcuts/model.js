import { safeLink } from '../notes/formatting/links.js?v=268df83d9262';
export const SHORTCUTS_KEY = 'dayline.shortcuts.v1';
export const DEFAULT_SHORTCUTS = Object.freeze([
  { id: 'google-meet', name: 'Open Google Meet', url: 'https://meet.google.com/' },
  { id: 'google-drive', name: 'Open Google Drive', url: 'https://drive.google.com/' },
]);
export function shortcutValues(name, url) {
  const label = typeof name === 'string' ? name.trim() : '';
  const href = typeof url === 'string' && url.length <= 2048 ? safeLink(url) : null;
  if (!label || label.length > 60) throw new Error('Enter a name of up to 60 characters.');
  if (!href) throw new Error('Enter a valid http or https web address.');
  return { name: label, url: href };
}
export function validShortcuts(value) {
  if (!Array.isArray(value) || value.length > 30) throw new Error('Use up to 30 custom shortcuts.');
  const ids = new Set(DEFAULT_SHORTCUTS.map((item) => item.id));
  return value.map((item) => {
    if (!item || typeof item.id !== 'string' || !/^[\w-]{1,100}$/.test(item.id) || ids.has(item.id))
      throw new Error('Invalid shortcut.');
    ids.add(item.id);
    return { id: item.id, ...shortcutValues(item.name, item.url) };
  });
}
