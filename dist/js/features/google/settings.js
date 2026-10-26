import { node } from '../../shared/dom.js?v=4c96946d1cdc';
import { googleConfig } from './config.js?v=4c96946d1cdc';
import { googleReady } from './model.js?v=4c96946d1cdc';
import { openGoogleAction } from './connection.js?v=4c96946d1cdc';

export function setupGoogleSettings(root) {
  if (!root) return;
  root.append(
    node('h2', '', 'Google connections'),
    node(
      'p',
      'field-hint',
      'Optional and separate from your Dayline sign-in. Link selected Drive files or create a Meet link from any note editor. Authorize Google when prompted; access is not saved in Dayline.',
    ),
  );
  const actions = node('div', 'inline');
  const status = node('p', 'field-hint');
  status.setAttribute('role', 'status');
  for (const [action, label] of [
    ['connect-drive', 'Connect Google Drive'],
    ['connect-meet', 'Connect Google Meet'],
  ]) {
    const button = node('button', 'secondary', label);
    button.type = 'button';
    button.disabled = !googleReady(googleConfig, action);
    button.onclick = async () => {
      button.disabled = true;
      status.textContent = 'Continue in the Google connection window…';
      try {
        await openGoogleAction(action);
        status.textContent =
          'Google permission granted. Open a note to link a Drive file or create a Meet link. You can manage or revoke Dayline’s access in your Google account.';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    actions.append(button);
  }
  if (!googleReady(googleConfig, 'drive') || !googleReady(googleConfig, 'meet'))
    status.textContent =
      'Google connections need owner setup before use. Existing notes, file uploads and sharing still work.';
  const help = node('a', '', 'Google setup instructions');
  help.href = 'https://github.com/angel-saber/Dayline/blob/main/docs/GOOGLE_SETUP.md';
  help.target = '_blank';
  help.rel = 'noopener noreferrer';
  const manage = node('a', '', 'Manage Google permissions');
  manage.href = 'https://myaccount.google.com/connections';
  manage.target = '_blank';
  manage.rel = 'noopener noreferrer';
  root.append(actions, status, help, node('span', '', ' · '), manage);
}
