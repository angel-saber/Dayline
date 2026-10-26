import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendGoogleLinks,
  validGoogleLinks,
  googleReady,
} from '../../dist/js/features/google/model.js';
import { openGoogleAction } from '../../dist/js/features/google/connection.js';
import {
  authorizeGoogle,
  chooseDriveFiles,
  createMeetLink,
} from '../../dist/js/features/google/providers/google.js';
import { validState } from '../../dist/js/shared/storage.js';
import { shareNoteText } from '../../dist/js/features/sharing/share-note.js';
const drive = {
  name: 'Project outline',
  url: 'https://docs.google.com/document/d/abc/edit?resourcekey=key',
};
const meet = { name: 'Google Meet', url: 'https://meet.google.com/abc-defg-hij' };
const config = { clientId: 'public-client', apiKey: 'restricted-key', appId: '123' };

test('Google links preserve notes, formatting, tasks, attachments, backup validation and clean sharing', () => {
  const entry = {
    id: 'one',
    minute: 600,
    done: false,
    title: 'Planning',
    text: 'Keep this',
    format: [{ start: 0, end: 4, bold: true }],
    tasks: [{ start: 0, done: false }],
    bullets: [],
    indents: [],
    attachments: [],
  };
  const original = structuredClone(entry);
  const result = appendGoogleLinks(entry, [drive, meet]);
  assert.deepEqual(entry, original);
  assert.equal(result.text, 'Keep this\nProject outline\nGoogle Meet');
  assert.deepEqual(result.tasks, entry.tasks);
  assert.deepEqual(result.format[0], entry.format[0]);
  assert.equal(result.format[1].href, drive.url);
  assert.equal(result.format[2].href, meet.url);
  const restored = validState(
    JSON.parse(JSON.stringify({ version: 1, days: { '2026-10-26': [result] } })),
  ).days['2026-10-26'][0];
  assert.deepEqual(restored.format, result.format);
  const shared = shareNoteText(restored, '2026-10-26');
  assert.ok(shared.includes(drive.url));
  assert.ok(shared.includes(meet.url));
});

test('Google links reject executable, credential-bearing and lookalike hosts', () => {
  for (const url of [
    'javascript:alert(1)',
    'http://drive.google.com/file',
    'https://drive.google.com.evil.test/file',
    'https://user:secret@docs.google.com/file',
    'https://meet.google.com/invalid',
  ])
    assert.throws(() => validGoogleLinks([{ name: 'x', url }]));
  assert.throws(() => validGoogleLinks(Array(11).fill(drive)));
  assert.equal(validGoogleLinks([{ name: '\n', url: drive.url }])[0].name, 'Google file');
  assert.equal(googleReady({}, 'drive'), false);
  assert.equal(googleReady({ clientId: 'a' }, 'meet'), true);
  assert.equal(googleReady({ clientId: 'a' }, 'drive'), false);
});

test('Google authorization requests only the selected service and rejects partial/denied scopes', async () => {
  let options, requested;
  const browser = {
    google: {
      accounts: {
        oauth2: {
          initTokenClient(value) {
            options = value;
            return {
              requestAccessToken(value) {
                requested = value;
              },
            };
          },
          hasGrantedAllScopes(response, scope) {
            return response.scope === scope;
          },
        },
      },
    },
  };
  for (const kind of ['drive', 'meet']) {
    const promise = authorizeGoogle(kind, config, browser);
    assert.equal(options.include_granted_scopes, false);
    assert.equal(
      options.scope,
      kind === 'drive'
        ? 'https://www.googleapis.com/auth/drive.file'
        : 'https://www.googleapis.com/auth/meetings.space.created',
    );
    assert.equal(requested.prompt, 'select_account');
    options.callback({ access_token: 'ephemeral', scope: options.scope });
    assert.equal(await promise, 'ephemeral');
  }
  const denied = authorizeGoogle('drive', config, browser);
  options.callback({ access_token: 'partial', scope: 'unrelated' });
  await assert.rejects(denied, /permission was not granted/);
  const blocked = authorizeGoogle('meet', config, browser);
  options.error_callback();
  await assert.rejects(blocked, /closed or blocked/);
});

test('Meet creates a single space without note data, invitations, retries or raw provider errors', async () => {
  let count = 0;
  const links = await createMeetLink('ephemeral', async (url, options) => {
    count++;
    assert.equal(url, 'https://meet.googleapis.com/v2/spaces');
    assert.equal(options.method, 'POST');
    assert.equal(options.body, '{}');
    assert.equal(options.headers.Authorization, 'Bearer ephemeral');
    return { ok: true, json: async () => ({ meetingUri: meet.url }) };
  });
  assert.equal(count, 1);
  assert.deepEqual(links, [meet]);
  for (const status of [401, 403, 429, 500]) {
    let attempts = 0;
    await assert.rejects(
      createMeetLink('ephemeral', async () => {
        attempts++;
        return { ok: false, status };
      }),
      /Google|Meet/,
    );
    assert.equal(attempts, 1);
  }
});

test('Picker returns chosen references and resource keys, disposes on select or cancel', async () => {
  let callback,
    disposed = 0;
  class Builder {
    addView() {
      return this;
    }
    enableFeature() {
      return this;
    }
    setMaxItems(n) {
      assert.equal(n, 10);
      return this;
    }
    setAppId() {
      return this;
    }
    setDeveloperKey() {
      return this;
    }
    setOAuthToken() {
      return this;
    }
    setOrigin() {
      return this;
    }
    setTitle() {
      return this;
    }
    setCallback(fn) {
      callback = fn;
      return this;
    }
    build() {
      return {
        setVisible() {},
        dispose() {
          disposed++;
        },
      };
    }
  }
  class DocsView {
    setIncludeFolders() {
      return this;
    }
    setSelectFolderEnabled() {
      return this;
    }
  }
  const browser = {
    location: { origin: 'https://dayline.test' },
    google: {
      picker: {
        PickerBuilder: Builder,
        DocsView,
        ViewId: { DOCS: 'docs' },
        Feature: { MULTISELECT_ENABLED: 'multi' },
        Action: { CANCEL: 'cancel', PICKED: 'picked' },
      },
    },
  };
  const selected = chooseDriveFiles('ephemeral', config, browser);
  callback({ action: 'picked', docs: [{ id: 'abc', name: drive.name, url: drive.url }] });
  assert.deepEqual(await selected, [drive]);
  const cancelled = chooseDriveFiles('ephemeral', config, browser);
  callback({ action: 'cancel' });
  assert.deepEqual(await cancelled, []);
  assert.equal(disposed, 2);
});

function mockBrowser() {
  const events = new Map();
  const popup = {
    closed: false,
    close() {
      this.closed = true;
    },
  };
  const browser = {
    location: { origin: 'https://dayline.test' },
    open(url) {
      this.url = url;
      return popup;
    },
    addEventListener(type, fn) {
      events.set(type, fn);
    },
    removeEventListener(type) {
      events.delete(type);
    },
  };
  return {
    browser,
    popup,
    events,
    send(data, overrides = {}) {
      events.get('message')?.({
        origin: browser.location.origin,
        source: popup,
        data: {
          type: 'dayline:google',
          state: new URLSearchParams(new URL(browser.url).hash.slice(1)).get('state'),
          ...data,
        },
        ...overrides,
      });
    },
  };
}
test('Popup accepts only same-origin, same-window, matching-request results and cleans up', async () => {
  const mock = mockBrowser();
  const promise = openGoogleAction('drive', { browser: mock.browser, config });
  mock.send({ links: [drive] }, { origin: 'https://evil.test' });
  mock.send({ links: [drive] }, { source: {} });
  mock.send({ links: [drive], state: 'wrong' });
  assert.equal(mock.events.has('message'), true);
  mock.send({ links: [drive] });
  assert.deepEqual(await promise, [drive]);
  assert.equal(mock.popup.closed, true);
  assert.equal(mock.events.size, 0);
  const aborted = mockBrowser(),
    controller = new AbortController();
  const pending = openGoogleAction('meet', {
    browser: aborted.browser,
    config,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(aborted.popup.closed, true);
  assert.equal(aborted.events.size, 0);
  const blocked = mockBrowser();
  blocked.browser.open = () => null;
  await assert.rejects(openGoogleAction('meet', { browser: blocked.browser, config }), /pop-ups/);
  await assert.rejects(
    openGoogleAction('drive', { browser: mock.browser, config: {} }),
    /owner setup/,
  );
});

test('Popup rejects unsafe results, handles explicit errors and detects dismissal', async () => {
  for (const data of [
    { links: [{ name: 'x', url: 'https://evil.test/' }] },
    { error: 'Permission denied.' },
  ]) {
    const mock = mockBrowser();
    const promise = openGoogleAction('drive', { browser: mock.browser, config });
    mock.send(data);
    await assert.rejects(promise, /invalid link|Permission denied/);
    assert.equal(mock.events.size, 0);
    assert.equal(mock.popup.closed, true);
  }
  const mock = mockBrowser();
  const promise = openGoogleAction('drive', { browser: mock.browser, config });
  mock.popup.closed = true;
  await assert.rejects(promise, /window closed/);
  assert.equal(mock.events.size, 0);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    openGoogleAction('drive', { browser: mock.browser, config, signal: cancelled.signal }),
    /cancelled/,
  );
});

test('account changes cancel the pending Google action before another account can receive links', async () => {
  const mock = mockBrowser();
  const pending = openGoogleAction('drive', { browser: mock.browser, config });
  mock.events.get('dayline:account')();
  await assert.rejects(pending, /cancelled/);
  assert.equal(mock.popup.closed, true);
  assert.equal(mock.events.size, 0);
});
