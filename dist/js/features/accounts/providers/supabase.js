// Supabase HTTP and session handling stay inside this provider adapter.
import { CloudError } from '../errors.js?v=4c96946d1cdc';
import {
  AUTH_METHODS,
  NOTES_METHODS,
  PREFERENCES_METHODS,
  bindMethods,
  publicSession,
} from '../service-contract.js?v=4c96946d1cdc';
export function validateConfig(config) {
  if (!config.url && !config.publishableKey) return null;
  const url = new URL(config.url);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Account configuration needs an HTTPS project origin.');
  }
  const key = config.publishableKey;
  if (typeof key !== 'string' || !key.startsWith('sb_publishable_')) {
    throw new Error('Use a Supabase publishable key, never a secret key.');
  }
  return { url: url.origin, publishableKey: key };
}

export class SupabaseClient {
  constructor(
    config,
    { storage = localStorage, fetcher = fetch, locks = globalThis.navigator?.locks } = {},
  ) {
    this.config = validateConfig(config);
    this.storage = storage;
    this.fetcher = fetcher;
    this.locks = locks;
    this.sessionKey = `dayline.session:${this.config?.url}`;
  }

  readSession() {
    const raw = this.storage.getItem(this.sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.user?.id || !session.access_token || !session.refresh_token) {
      throw new Error('Your saved sign-in could not be read. Please sign in again.');
    }
    return session;
  }

  storeSession(data) {
    if (!data.access_token || !data.refresh_token || !data.user?.id) {
      throw new Error('Sign-in did not return a complete session. Please try again.');
    }
    const session = {
      ...data,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in,
    };
    this.storage.setItem(this.sessionKey, JSON.stringify(session));
    return session;
  }

  async request(path, { method = 'GET', body, token, headers = {} } = {}) {
    if (!this.config) throw new Error('Account setup has not been completed yet.');
    let response;
    try {
      // Window.fetch requires a Window receiver in some browsers (notably
      // Safari). Calling it as this.fetcher makes CloudClient the receiver.
      response = await this.fetcher.call(globalThis, `${this.config.url}${path}`, {
        method,
        headers: {
          apikey: this.config.publishableKey,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new CloudError(
          'The account service took too long to respond. Please try again. Your notes are kept on this device.',
        );
      }
      throw new CloudError('Could not connect. Your unsynced notes are kept on this device.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        response.status === 429
          ? 'Please wait before trying again.'
          : response.status === 401
            ? 'Please sign in again to continue syncing.'
            : data?.msg ||
              data?.message ||
              data?.error_description ||
              'The account service could not complete this request.';
      const status =
        path.startsWith('/auth/v1/token') && response.status === 400 ? 401 : response.status;
      throw new CloudError(message, status);
    }
    return data;
  }

  sendCode(email, { createUser = false } = {}) {
    return this.request('/auth/v1/otp', {
      method: 'POST',
      body: { email, create_user: createUser === true },
    });
  }

  async signInPassword(email, password) {
    let data;
    try {
      data = await this.request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: { email, password },
      });
    } catch (error) {
      if (error.status === 401)
        throw new CloudError(
          'Could not sign in. Check your email and password, or contact the account administrator for help.',
          401,
        );
      throw error;
    }
    // Keep only the returned session, never the submitted password.
    return this.storeSession(data);
  }

  async sendLink(email, redirectTo) {
    const redirect = new URL(redirectTo);
    if (
      redirect.protocol !== 'https:' ||
      redirect.search ||
      redirect.hash ||
      redirect.username ||
      redirect.password
    ) {
      throw new Error('Sign-in needs a secure Dayline URL.');
    }
    const encode = (bytes) =>
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = encode(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
    );
    const key = `${this.sessionKey}:link`;
    this.storage.setItem(
      key,
      JSON.stringify({ verifier, email: email.toLowerCase(), created: Date.now() }),
    );
    try {
      return await this.request(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirect.href)}`, {
        method: 'POST',
        body: {
          email,
          create_user: false,
          code_challenge: challenge,
          code_challenge_method: 's256',
        },
      });
    } catch (error) {
      // Do not remove a newer request made in another tab.
      if (JSON.parse(this.storage.getItem(key) || 'null')?.verifier === verifier)
        this.storage.removeItem(key);
      throw error;
    }
  }

  async exchangeLink(code) {
    const exchange = async () => {
      const key = `${this.sessionKey}:link`;
      const pending = JSON.parse(this.storage.getItem(key) || 'null');
      if (!pending?.verifier || !pending.email || Date.now() - pending.created > 3600000) {
        this.storage.removeItem(key);
        throw new Error(
          'Request a new sign-in link on this device and open it in the same browser.',
        );
      }
      try {
        const data = await this.request('/auth/v1/token?grant_type=pkce', {
          method: 'POST',
          body: { auth_code: code, code_verifier: pending.verifier },
        });
        if (data?.user?.email?.toLowerCase() !== pending.email)
          throw new Error('The sign-in account did not match your request.');
        return this.storeSession(data);
      } finally {
        if (JSON.parse(this.storage.getItem(key) || 'null')?.verifier === pending.verifier)
          this.storage.removeItem(key);
      }
    };
    return this.locks ? this.locks.request(`${this.sessionKey}:signin`, exchange) : exchange();
  }

  async verifyCode(email, token) {
    const data = await this.request('/auth/v1/verify', {
      method: 'POST',
      body: { email, token, type: 'email' },
    });
    return this.storeSession(data);
  }

  async session() {
    const refresh = async () => {
      const current = this.readSession();
      if (!current) throw new CloudError('Please sign in to sync your notes.', 401);
      if (current.expires_at > Date.now() / 1000 + 60) return current;
      const data = await this.request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: current.refresh_token },
      });
      // Do not restore a session after another tab signed out.
      if (!this.readSession()) throw new CloudError('You have signed out.', 401);
      return this.storeSession(data);
    };
    if (this.locks) return this.locks.request(this.sessionKey, refresh);
    this.refreshing ||= refresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  async signedRequest(path, options = {}) {
    const session = await this.session();
    return this.request(path, { ...options, token: session.access_token });
  }

  async loadDays() {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await this.signedRequest(
        `/rest/v1/dayline_days?select=day,entries,revision&order=day.asc&limit=500&offset=${offset}`,
      );
      if (!Array.isArray(page)) throw new Error('The notes service returned an invalid response.');
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }

  saveDay(day, entries, revision) {
    return this.signedRequest('/rest/v1/rpc/save_dayline_day', {
      method: 'POST',
      body: { p_day: day, p_entries: entries, p_expected_revision: revision },
    });
  }

  async loadPreferences() {
    const rows = await this.signedRequest(
      '/rest/v1/dayline_preferences?select=preferences,revision',
    );
    if (!Array.isArray(rows) || rows.length > 1)
      throw new Error('The settings service returned an invalid response.');
    return rows[0] || null;
  }
  savePreferences(preferences, revision) {
    return this.signedRequest('/rest/v1/rpc/save_dayline_preferences', {
      method: 'POST',
      body: { p_preferences: preferences, p_expected_revision: revision },
    });
  }

  async signOut() {
    const session = this.readSession();
    // Revoke this device's refresh token; other signed-in devices stay signed in.
    if (session) {
      try {
        await this.signedRequest('/auth/v1/logout?scope=local', { method: 'POST' });
      } catch (error) {
        if (error.status !== 401 && error.status !== 403) throw error;
      }
    }
    this.storage.removeItem(this.sessionKey);
  }
}

export function createSupabaseServices(config, options) {
  const client = new SupabaseClient(config, options);
  const auth = bindMethods(client, AUTH_METHODS);
  for (const method of ['signInPassword', 'exchangeLink', 'verifyCode'])
    auth[method] = async (...args) => publicSession(await client[method](...args));
  auth.readSession = () => publicSession(client.readSession());
  return {
    auth: { ...auth, enabled: !!client.config, sessionKey: client.sessionKey },
    notes: bindMethods(client, NOTES_METHODS),
    preferences: bindMethods(client, PREFERENCES_METHODS),
  };
}
