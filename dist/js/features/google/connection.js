import { googleConfig } from './config.js?v=525142851605';
import { GOOGLE_ACTIONS, googleReady, validGoogleLinks } from './model.js?v=525142851605';

// Google tokens never enter the planner. A separate same-origin window owns
// short-lived authorization and sends back only selected names and safe URLs.
export function openGoogleAction(action, { signal, browser = window, config = googleConfig } = {}) {
  if (!GOOGLE_ACTIONS.includes(action)) return Promise.reject(new Error('Unknown Google action.'));
  if (!googleReady(config, action))
    return Promise.reject(
      new Error('Google integration needs owner setup. See Settings → Google connections.'),
    );
  if (signal?.aborted) return Promise.reject(new Error('Google action cancelled.'));
  const state = crypto.randomUUID();
  const url = new URL('../../../google-connect.html', import.meta.url);
  url.search = new URL(import.meta.url).search;
  url.hash = new URLSearchParams({ action, state }).toString();
  const popup = browser.open(url.href, '_blank', 'popup,width=700,height=720');
  if (!popup) return Promise.reject(new Error('Allow pop-ups for Dayline, then try again.'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, links) => {
      if (settled) return;
      settled = true;
      browser.removeEventListener('message', receive);
      browser.removeEventListener('pagehide', abort);
      browser.removeEventListener('dayline:account', abort);
      signal?.removeEventListener('abort', abort);
      clearInterval(closed);
      clearTimeout(deadline);
      popup.close();
      if (error) reject(error);
      else resolve(links);
    };
    const abort = () => finish(new Error('Google action cancelled.'));
    const receive = (event) => {
      if (
        event.origin !== browser.location.origin ||
        event.source !== popup ||
        event.data?.state !== state ||
        event.data?.type !== 'dayline:google'
      )
        return;
      if (event.data.error) return finish(new Error(String(event.data.error).slice(0, 300)));
      try {
        finish(null, validGoogleLinks(event.data.links));
      } catch {
        finish(new Error('Google returned an invalid link.'));
      }
    };
    const closed = setInterval(() => {
      if (popup.closed) finish(new Error('Google window closed. No links were added.'));
    }, 500);
    const deadline = setTimeout(
      () => finish(new Error('Google connection timed out. Please try again.')),
      5 * 60 * 1000,
    );
    browser.addEventListener('message', receive);
    browser.addEventListener('pagehide', abort);
    browser.addEventListener('dayline:account', abort);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
