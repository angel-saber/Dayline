import { cloudConfig } from './config.js?v=221bd4f8c2b4';
import { createAccountServices } from './services.js?v=221bd4f8c2b4';
import { takeSignInReturn } from './sign-in-return.js?v=221bd4f8c2b4';
import { SyncEngine, mergeGuestDays, clearSyncedDrafts } from './sync.js?v=221bd4f8c2b4';
import { load, save, validState } from '../../shared/storage.js?v=221bd4f8c2b4';
import {
  deviceNotes,
  countDeviceNotes,
  preserveDeviceNotes,
} from './device-notes.js?v=221bd4f8c2b4';
import { PreferencesSync, sharedPreferences } from './preferences-sync.js?v=221bd4f8c2b4';

const $ = (selector) => document.querySelector(selector);

export function setupAccounts({
  getState,
  setState,
  flushEditor,
  preserveDailyEditor = () => false,
  toast,
  onStatus,
  downloadDeviceBackup,
  accountConfig = cloudConfig,
  connect = createAccountServices,
}) {
  const linkLogin = accountConfig.authMethod === 'link';
  const signInReturn = takeSignInReturn(window.location, window.history);
  let services,
    auth,
    engine,
    preferencesSync,
    user = null,
    busy = false,
    resendAt = 0,
    viewIsLogin = false;
  const savedLayout = () => localStorage.getItem('dayline.appearance.v1') || 'zen';
  let generation = 0;
  let applyingPreferences = false;
  let passwordLogin = false;
  let tabId;
  try {
    tabId = sessionStorage.getItem('dayline.tab');
    if (!tabId) {
      tabId = crypto.randomUUID();
      sessionStorage.setItem('dayline.tab', tabId);
    }
    services = connect(accountConfig);
    auth = services.auth;
  } catch (error) {
    $('#auth-message').textContent = error.message;
  }

  function showLogin(show = true) {
    if (viewIsLogin !== show) flushEditor();
    viewIsLogin = show;
    $('#auth-view').hidden = !show;
    $('#planner').hidden = show;
    $('#planner-nav').hidden = show;
    $('#date-footer').hidden = show || $('#daily-view').hidden;
    $('#reopen-welcome').hidden = show;
    if (show) $('#auth-email').focus();
    else $('#auth-password').value = '';
    window.dispatchEvent(new Event('dayline:entry-view'));
  }

  function accountView() {
    $('#account-email').textContent = user?.email || 'Using this device';
    $('#account-explanation').textContent = user
      ? 'Your notes and settings sync with this account. Notification permission and audio activation must be enabled separately on each device.'
      : auth?.enabled
        ? 'Sign in to keep your notes and settings with you across devices.'
        : 'Use Dayline without an account. Account access is not available yet.';
    $('#sign-in-button').hidden = !!user;
    $('#reopen-welcome').hidden = viewIsLogin;
    $('#sign-out-button').hidden = !user;
    $('#sync-now').hidden = !user;
    $('#sync-settings-from-device').hidden = !user;
    let hasGuest = false,
      count = 0,
      deviceError = false;
    try {
      const saved = deviceNotes();
      hasGuest = countDeviceNotes(saved) > 0;
      count = Object.entries(saved.days).reduce(
        (total, [date, notes]) =>
          total +
          notes.filter((note) => !getState().days[date]?.some((other) => other.id === note.id))
            .length,
        0,
      );
    } catch {
      deviceError = true;
    }
    $('#import-device-notes').hidden = !user || !hasGuest;
    $('#device-notes-notice').hidden = !user || (!count && !deviceError);
    $('#device-notes-message').textContent = deviceError
      ? 'Dayline could not read this browser’s device notes. They have not been replaced by your account. Download a device recovery copy before clearing browser data.'
      : `You’re viewing your account notes. ${count} ${count === 1 ? 'note is' : 'notes are'} still saved separately in this browser. Add them to your account to see them here.`;
    $('#review-device-notes').hidden = !hasGuest;
    $('#backup-description').textContent = user
      ? 'Download a copy of your account notes. Notes waiting to sync are included. Restoring a backup replaces this account’s notes across devices.'
      : 'Saved automatically in this browser, on this device. Sign in to sync, or download a backup before switching devices.';
  }

  async function enterAccount(session) {
    flushEditor();
    if (!user) {
      try {
        preserveDeviceNotes();
      } catch {
        toast(
          'A separate device checkpoint could not be created. Existing browser data was left untouched.',
        );
      }
    }
    const current = ++generation;
    engine?.stop();
    preferencesSync?.stop();
    preferencesSync = null;
    engine = null;
    user = session.user;
    const preferences = { ...getState().settings };
    try {
      engine = new SyncEngine({
        cloud: services.notes,
        userId: user.id,
        cacheId: tabId,
        onDays(days) {
          if (current !== generation) return;
          setState({ version: 1, days, settings: getState().settings });
          accountView();
        },
        onStatus(status, error) {
          if (current !== generation) return;
          onStatus(status, error);
          if (error?.status === 401) {
            $('#sign-in-button').hidden = false;
            $('#sign-in-button').textContent = 'Sign in again';
          }
        },
        onConflict() {
          toast('This note changed in two places. Both versions were kept so you can choose.');
        },
      });
      // Read only this account's draft cache; never auto-import guest notes.
      setState({ version: 1, days: engine.days, settings: preferences }, { readFailed: false });
      try {
        preferencesSync = new PreferencesSync({
          cloud: services.preferences,
          userId: user.id,
          cacheId: tabId,
          initial: sharedPreferences(preferences, savedLayout()),
          onValues(values) {
            if (current !== generation) return;
            const { layout, ...settings } = values;
            localStorage.setItem('dayline.preferences', JSON.stringify(settings));
            if (JSON.stringify(getState().settings) !== JSON.stringify(settings)) {
              applyingPreferences = true;
              try {
                if (!preserveDailyEditor()) flushEditor();
                setState({ ...getState(), settings });
              } finally {
                applyingPreferences = false;
              }
            }
            if (savedLayout() !== layout)
              window.dispatchEvent(
                new CustomEvent('dayline:apply-account-layout', { detail: layout }),
              );
          },
          onStatus(status, error) {
            if (current !== generation) return;
            $('#preferences-sync-status').textContent = error
              ? `Settings not synced: ${error.message}`
              : {
                  synced: 'Settings synced across devices.',
                  pending: 'Settings saved here · waiting to sync.',
                  unconfigured:
                    'To start, use this device’s settings below on the device with your preferred setup.',
                }[status] || 'Syncing settings…';
          },
        });
        preferencesSync.start();
      } catch (error) {
        preferencesSync = null;
        $('#preferences-sync-status').textContent = `Settings not synced: ${error.message}`;
      }
      engine.start();
      accountView();
      showLogin(false);
      window.dispatchEvent(new Event('dayline:account'));
      await Promise.all([engine.sync(), preferencesSync?.sync()]);
      if (current !== generation) return;
    } catch (error) {
      if (current === generation) {
        toast(error.message);
        onStatus('error', error);
      }
    }
  }

  function persist(state) {
    if (!user) {
      save(state);
      return;
    }
    if (!engine) throw new Error('Account notes have not loaded yet.');
    // Preferences are device-local; do not replace the guest notes on sign-in.
    // Keep preferences apart from guest data, including a corrupt guest backup.
    localStorage.setItem('dayline.preferences', JSON.stringify(state.settings));
    engine.stage(state.days);
    if (!applyingPreferences)
      preferencesSync?.stage(sharedPreferences(state.settings, savedLayout()));
  }

  async function withBusy(action) {
    if (busy) return;
    busy = true;
    $('#auth-submit').disabled = true;
    $('#send-code').disabled = true;
    $('#auth-method').disabled = true;
    try {
      await action();
    } catch (error) {
      $('#auth-message').textContent = error.message;
    } finally {
      busy = false;
      $('#auth-submit').disabled = !auth?.enabled;
      $('#send-code').disabled = !auth?.enabled;
      $('#auth-method').disabled = !auth?.enabled;
    }
  }

  async function requestLink(email) {
    if (Date.now() < resendAt)
      throw new Error('Please wait a minute before requesting another sign-in link.');
    await auth.sendLink(email, `${window.location.origin}${window.location.pathname}`);
    resendAt = Date.now() + 60000;
    $('#auth-message').textContent =
      'Check your inbox for your sign-in link. Open it in this browser on this device. Use the newest link; check spam if needed.';
  }

  $('#auth-form').addEventListener('submit', (event) => {
    event.preventDefault();
    withBusy(async () => {
      const email = $('#auth-email').value.trim();
      const token = $('#auth-code').value.trim();
      if (!auth?.enabled)
        throw new Error('Account setup is not active yet. You can still continue on this device.');
      if (passwordLogin) {
        let session;
        try {
          session = await auth.signInPassword(email, $('#auth-password').value);
        } finally {
          $('#auth-password').value = '';
        }
        $('#auth-message').textContent = '';
        await enterAccount(session);
        return;
      }
      if (linkLogin) {
        await requestLink(email);
        return;
      }
      if (!token) {
        if (Date.now() < resendAt)
          throw new Error('Please wait a minute before requesting another code.');
        await auth.sendCode(email, {
          createUser: accountConfig.allowSignup === true && $('#create-account').checked,
        });
        resendAt = Date.now() + 60000;
        $('#code-field').hidden = false;
        $('#auth-code').required = true;
        $('#auth-submit').textContent = 'Sign in';
        $('#send-code').hidden = false;
        $('#auth-message').textContent =
          'Check your email for your code. Enter it below to continue.';
        $('#auth-code').focus();
      } else {
        const session = await auth.verifyCode(email, token);
        $('#auth-code').value = '';
        $('#auth-message').textContent = '';
        await enterAccount(session);
      }
    });
  });
  $('#send-code').onclick = () =>
    withBusy(async () => {
      if (linkLogin) {
        await requestLink($('#auth-email').value.trim());
        return;
      }
      if (Date.now() < resendAt)
        throw new Error('Please wait a minute before requesting another code.');
      await auth.sendCode($('#auth-email').value.trim(), {
        createUser: accountConfig.allowSignup === true && $('#create-account').checked,
      });
      resendAt = Date.now() + 60000;
      $('#auth-message').textContent =
        'A new code is on its way. Use the newest code in your inbox.';
    });
  $('#auth-email').oninput = () => {
    $('#code-field').hidden = true;
    $('#auth-code').required = false;
    $('#auth-code').value = '';
    $('#auth-submit').textContent = passwordLogin
      ? 'Sign in'
      : linkLogin
        ? 'Email me a sign-in link'
        : 'Email me a sign-in code';
    $('#send-code').hidden = true;
  };
  $('#auth-method').onclick = () => {
    if (busy) return;
    passwordLogin = !passwordLogin;
    $('#password-field').hidden = !passwordLogin;
    $('#auth-password').required = passwordLogin;
    $('#auth-password').disabled = !passwordLogin;
    $('#auth-password').value = '';
    $('#auth-code').value = '';
    $('#auth-code').required = false;
    $('#code-field').hidden = true;
    $('#send-code').hidden = true;
    $('#auth-submit').textContent = passwordLogin
      ? 'Sign in'
      : linkLogin
        ? 'Email me a sign-in link'
        : 'Email me a sign-in code';
    $('#auth-method').textContent = passwordLogin
      ? 'Use email sign-in instead'
      : 'Use a password instead';
    $('#auth-method').setAttribute('aria-expanded', String(passwordLogin));
    $('#password-help').hidden = !passwordLogin;
    $('#create-account').closest('label').hidden =
      passwordLogin || accountConfig.allowSignup !== true;
    $('#auth-message').textContent = '';
    if (passwordLogin) $('#auth-password').focus();
  };
  $('#continue-local').onclick = () => {
    try {
      localStorage.setItem('dayline.guest.v1', 'yes');
    } catch {}
    showLogin(false);
    accountView();
  };
  $('#sign-in-button').onclick = () => showLogin(true);
  $('#sync-now').onclick = () => {
    flushEditor();
    Promise.all([engine?.sync(), preferencesSync?.sync()]).catch((error) => toast(error.message));
  };
  $('#sync-settings-from-device').onclick = async () => {
    if (!preferencesSync) return;
    try {
      flushEditor();
      preferencesSync.stage(sharedPreferences(getState().settings, savedLayout()), true);
      await preferencesSync.sync();
      toast('These settings are now shared with your other signed-in devices.');
    } catch (error) {
      toast(error.message);
    }
  };
  window.addEventListener('dayline:layout-saved', () => {
    if (!preferencesSync) return;
    try {
      preferencesSync.stage(sharedPreferences(getState().settings, savedLayout()));
    } catch (error) {
      toast(error.message);
    }
  });
  $('#import-device-notes').onclick = () => $('#migration-dialog').showModal();
  $('#review-device-notes').onclick = () => $('#migration-dialog').showModal();
  $('#export-device-notes').onclick = async () => {
    try {
      await downloadDeviceBackup();
    } catch (error) {
      toast(`Could not export device notes: ${error.message}`);
    }
  };
  $('#migration-dialog').addEventListener('close', () => {
    if ($('#migration-dialog').returnValue !== 'import' || !engine) return;
    try {
      flushEditor();
      const state = getState();
      const days = mergeGuestDays(state.days, deviceNotes().days);
      engine.stage(days);
      setState({ ...state, days });
      accountView();
      $('#device-notes-notice').hidden = true;
      toast('Device notes added to your account. The original device notes are kept too.');
    } catch (error) {
      toast(error.message);
    }
  });
  $('#sign-out-button').onclick = async () => {
    if (busy) return;
    busy = true;
    $('#sign-out-button').disabled = true;
    try {
      flushEditor();
      await Promise.all([engine?.sync(), preferencesSync?.sync()]);
      if (engine?.pending || preferencesSync?.pending)
        throw new Error('Wait for your notes and settings to finish syncing before signing out.');
      await auth.signOut();
      leaveAccount();
      toast('Signed out. Your account notes are kept in the cloud.');
    } catch (error) {
      toast(error.message);
    } finally {
      busy = false;
      $('#sign-out-button').disabled = false;
    }
  };

  function leaveAccount() {
    ++generation;
    engine?.stop();
    preferencesSync?.stop();
    preferencesSync = null;
    if (engine) clearSyncedDrafts(localStorage, engine.userPrefix);
    engine = null;
    user = null;
    try {
      setState(load(), { readFailed: false });
    } catch {
      setState({ version: 1, days: {}, settings: getState().settings }, { readFailed: true });
    }
    accountView();
    showLogin(true);
    onStatus('local');
    window.dispatchEvent(new Event('dayline:account'));
  }

  window.addEventListener('online', () => engine?.sync().catch(() => {}));
  window.addEventListener('focus', () => engine?.sync().catch(() => {}));
  window.addEventListener('online', () => preferencesSync?.sync().catch(() => {}));
  window.addEventListener('focus', () => preferencesSync?.sync().catch(() => {}));
  window.addEventListener('storage', (event) => {
    if (event.key === auth?.sessionKey) {
      try {
        const session = auth.readSession();
        if (!session && user) leaveAccount();
        else if (session && session.user.id !== user?.id) enterAccount(session);
      } catch (error) {
        toast(error.message);
      }
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (engine?.pending || preferencesSync?.pending) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('pagehide', () => {
    engine?.stop();
    preferencesSync?.stop();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && engine) {
      engine.stopped = false;
      engine.start();
      engine.sync().catch(() => {});
      if (preferencesSync) {
        preferencesSync.stopped = false;
        preferencesSync.start();
        preferencesSync.sync().catch(() => {});
      }
    }
  });

  try {
    const saved = localStorage.getItem('dayline.preferences');
    if (saved) {
      const preferences = validState({
        version: 1,
        days: {},
        settings: JSON.parse(saved),
      }).settings;
      setState({ ...getState(), settings: preferences });
    }
  } catch {
    /* Invalid optional preferences do not affect the notes. */
  }
  let returningGuest = false;
  try {
    returningGuest =
      localStorage.getItem('dayline.guest.v1') === 'yes' ||
      localStorage.getItem('dayline.v1') !== null;
  } catch {}
  showLogin(!returningGuest);
  accountView();
  $('#create-account').closest('label').hidden = accountConfig.allowSignup !== true;
  if (linkLogin) $('#auth-submit').textContent = 'Email me a sign-in link';
  $('#auth-submit').disabled = !auth?.enabled;
  $('#create-account').disabled = !auth?.enabled;
  $('#auth-method').disabled = !auth?.enabled;
  try {
    const session = auth?.enabled && auth.readSession();
    if (signInReturn) {
      showLogin(true);
      withBusy(async () => {
        if (signInReturn.error) throw new Error(signInReturn.error);
        $('#auth-message').textContent = 'Signing you in…';
        await enterAccount(await auth.exchangeLink(signInReturn.code));
        $('#auth-message').textContent = '';
      });
    } else if (session) enterAccount(session);
    else if (!auth?.enabled)
      $('#auth-message').textContent =
        'Account sign-in and sign-up are not available yet. Continue without an account to use Dayline on this device.';
  } catch (error) {
    $('#auth-message').textContent = error.message;
  }
  return {
    persist,
    isSignedIn: () => !!user,
    isLoginVisible: () => viewIsLogin,
    syncStatus: () => (!user ? 'local' : engine?.pending ? 'pending' : 'synced'),
    refreshView: accountView,
    retry: () => engine?.sync(),
  };
}
