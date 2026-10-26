import { googleConfig } from './config.js?v=4c96946d1cdc';
import { GOOGLE_ACTIONS, googleReady, validGoogleLinks } from './model.js?v=4c96946d1cdc';
import {
  prepareGoogle,
  authorizeGoogle,
  chooseDriveFiles,
  createMeetLink,
} from './providers/google.js?v=4c96946d1cdc';

const parameters = new URLSearchParams(location.hash.slice(1));
const action = parameters.get('action'),
  state = parameters.get('state');
const status = document.querySelector('#google-status');
const proceed = document.querySelector('#google-continue');
const cancel = document.querySelector('#google-cancel');
const kind = action?.endsWith('drive') ? 'drive' : 'meet';
const valid = GOOGLE_ACTIONS.includes(action) && /^[\w-]{36}$/.test(state || '') && window.opener;
function send(links, error) {
  window.opener?.postMessage({ type: 'dayline:google', state, links, error }, location.origin);
}
cancel.onclick = () => {
  send([], 'Google action cancelled. No links were added.');
  window.close();
};
async function prepare() {
  proceed.disabled = true;
  status.textContent = 'Loading Google…';
  try {
    await prepareGoogle(kind);
    status.textContent =
      kind === 'drive'
        ? 'Choose a Google account. Dayline requests access only to files you select.'
        : 'Choose a Google account to allow Dayline to create Meet links.';
    proceed.textContent = 'Continue to Google';
    proceed.onclick = connect;
  } catch (error) {
    status.textContent = error.message;
    proceed.textContent = 'Retry loading Google';
    proceed.onclick = prepare;
  }
  proceed.disabled = false;
}
async function connect() {
  proceed.disabled = true;
  status.textContent = 'Complete the Google permission window…';
  try {
    // The token lives only in this operation’s memory; never stored or posted.
    const token = await authorizeGoogle(kind, googleConfig);
    status.textContent =
      kind === 'drive' ? 'Choose your files in Google Drive…' : 'Creating your Meet link…';
    const links = action.startsWith('connect-')
      ? []
      : kind === 'drive'
        ? await chooseDriveFiles(token, googleConfig)
        : await createMeetLink(token);
    send(validGoogleLinks(links));
    status.textContent = 'Complete. You can return to Dayline.';
    proceed.hidden = true;
  } catch (error) {
    status.textContent = error.message;
    proceed.disabled = false;
    proceed.textContent = 'Try again';
  }
}
if (!valid || !googleReady(googleConfig, action)) {
  status.textContent = 'Open this window from Dayline after the owner completes Google setup.';
} else {
  document.querySelector('#google-title').textContent =
    kind === 'drive' ? 'Connect Google Drive' : 'Connect Google Meet';
  prepare();
}
