const scopes = {
  drive: 'https://www.googleapis.com/auth/drive.file',
  meet: 'https://www.googleapis.com/auth/meetings.space.created',
};
export function loadScript(src, doc = document) {
  return new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = src;
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error('Google did not load. Check your connection or content blocker and retry.'));
    }, 20000);
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error('Could not load Google. Check your connection or content blocker.'));
    };
    doc.head.append(script);
  });
}
export async function prepareGoogle(kind, browser = window) {
  await loadScript('https://accounts.google.com/gsi/client');
  if (kind === 'drive') {
    await loadScript('https://apis.google.com/js/api.js');
    await new Promise((resolve, reject) =>
      browser.gapi.load('picker', {
        callback: resolve,
        onerror: () => reject(new Error('Google Drive picker could not load.')),
        timeout: 20000,
        ontimeout: () => reject(new Error('Google Drive picker timed out.')),
      }),
    );
  }
}
// Called directly by a click, after SDK loading, to preserve popup permission.
export function authorizeGoogle(kind, config, browser = window) {
  return new Promise((resolve, reject) => {
    const oauth = browser.google.accounts.oauth2;
    const client = oauth.initTokenClient({
      client_id: config.clientId,
      scope: scopes[kind],
      include_granted_scopes: false,
      callback(response) {
        if (
          response.error ||
          !response.access_token ||
          !oauth.hasGrantedAllScopes(response, scopes[kind])
        ) {
          reject(new Error('Google permission was not granted. No links were added.'));
        } else resolve(response.access_token);
      },
      error_callback() {
        reject(new Error('Google sign-in was closed or blocked. Please try again.'));
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}
export function chooseDriveFiles(token, config, browser = window) {
  return new Promise((resolve, reject) => {
    const p = browser.google.picker;
    let picker;
    const finish = (items, error) => {
      picker?.dispose();
      if (error) reject(error);
      else resolve(items);
    };
    picker = new p.PickerBuilder()
      .addView(new p.DocsView(p.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false))
      .enableFeature(p.Feature.MULTISELECT_ENABLED)
      .setMaxItems(10)
      .setAppId(config.appId)
      .setDeveloperKey(config.apiKey)
      .setOAuthToken(token)
      .setOrigin(browser.location.origin)
      .setTitle('Choose files to link in Dayline')
      .setCallback((data) => {
        if (data.action === p.Action.CANCEL) finish([]);
        if (data.action === p.Action.PICKED) {
          try {
            finish(
              data.docs.map((file) => {
                if (!/^[\w-]+$/.test(file.id)) throw new Error('Invalid Drive file.');
                const url = new URL(
                  file.url || 'https://drive.google.com/file/d/' + file.id + '/view',
                );
                // Preserve resource keys for link-shared files; never alter permissions.
                if (file.resourceKey) url.searchParams.set('resourcekey', file.resourceKey);
                return { name: file.name || 'Google Drive file', url: url.href };
              }),
            );
          } catch {
            finish(null, new Error('Could not read the selected Drive files.'));
          }
        }
      })
      .build();
    picker.setVisible(true);
  });
}
export async function createMeetLink(token, request = fetch) {
  // No retries: repeating a POST could create duplicate meeting spaces.
  const response = await request('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google access expired. Please try again.');
    if (response.status === 403)
      throw new Error(
        'Google Meet access is unavailable. Check account permissions and the project’s Meet API setup.',
      );
    if (response.status === 429)
      throw new Error('Google’s request limit was reached. Try again later.');
    throw new Error('Could not create a Meet link. Please try again later.');
  }
  const space = await response.json();
  return [{ name: 'Google Meet', url: space.meetingUri }];
}
