import { replaceText } from '../notes/editor-state.js?v=525142851605';
import { setLink } from '../notes/formatting/format.js?v=525142851605';

export const GOOGLE_ACTIONS = Object.freeze(['drive', 'meet', 'connect-drive', 'connect-meet']);
export function googleReady(config, action) {
  return !!config.clientId && (!action.endsWith('drive') || !!(config.apiKey && config.appId));
}
export function validGoogleLinks(value) {
  if (!Array.isArray(value) || value.length > 10) throw new Error('Invalid Google links.');
  return value.map((item) => {
    const url = new URL(item.url);
    if (
      url.protocol !== 'https:' ||
      !!url.port ||
      url.href.length > 4096 ||
      url.username ||
      url.password ||
      !['drive.google.com', 'docs.google.com', 'meet.google.com'].includes(url.hostname) ||
      (url.hostname === 'meet.google.com' && !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname))
    )
      throw new Error('Invalid Google link.');
    return {
      name:
        String(item.name || 'Google file')
          .replace(/[\r\n\u0000-\u001f]/g, ' ')
          .slice(0, 200)
          .trim() || 'Google file',
      url: url.href,
    };
  });
}
// Use the existing text/link schema: account sync, backups and clean sharing all
// retain these references without storing Drive bytes or changing permissions.
export function appendGoogleLinks(state, items) {
  let next = state;
  for (const { name, url } of validGoogleLinks(items)) {
    const prefix = next.text && !next.text.endsWith('\n') ? '\n' : '';
    const start = next.text.length + prefix.length;
    next = replaceText(next, next.text.length, next.text.length, prefix + name, {});
    next = { ...next, format: setLink(next.text, next.format, start, start + name.length, url) };
  }
  return next;
}
