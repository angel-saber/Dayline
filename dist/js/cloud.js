// Supabase handles identity, email codes, and token validation. This adapter
// keeps its HTTP API isolated from the planner and the sync algorithm.
export class CloudError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export function validateConfig(config) {
  if (!config.url && !config.publishableKey) return null;
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Account configuration needs an HTTPS project origin.');
  }
  const key = config.publishableKey;
  if (typeof key !== 'string' || !key.startsWith('sb_publishable_')) {
    throw new Error('Use a Supabase publishable key, never a secret key.');
  }
  return { url: url.origin, publishableKey: key };
}

export class CloudClient {
  constructor(config, { storage = localStorage, fetcher = fetch, locks = globalThis.navigator?.locks } = {}) {
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
    const session = { ...data, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in };
    this.storage.setItem(this.sessionKey, JSON.stringify(session));
    return session;
  }

  async request(path, { method = 'GET', body, token, headers = {} } = {}) {
    if (!this.config) throw new Error('Account setup has not been completed yet.');
    let response;
    try {
      response = await this.fetcher(`${this.config.url}${path}`, {
        method,
        headers: { apikey: this.config.publishableKey, 'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new CloudError('Could not connect. Your unsynced notes are kept on this device.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = response.status === 429 ? 'Please wait before trying again.' :
        response.status === 401 ? 'Please sign in again to continue syncing.' :
        data?.msg || data?.message || data?.error_description || 'The account service could not complete this request.';
      const status = path.startsWith('/auth/v1/token') && response.status === 400 ? 401 : response.status;
      throw new CloudError(message, status);
    }
    return data;
  }

  sendCode(email) {
    return this.request('/auth/v1/otp', { method: 'POST', body: { email, create_user: true } });
  }

  async verifyCode(email, token) {
    const data = await this.request('/auth/v1/verify', { method: 'POST', body: { email, token, type: 'email' } });
    return this.storeSession(data);
  }

  async session() {
    const refresh = async () => {
      const current = this.readSession();
      if (!current) throw new CloudError('Please sign in to sync your notes.', 401);
      if (current.expires_at > Date.now() / 1000 + 60) return current;
      const data = await this.request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: current.refresh_token },
      });
      // Do not restore a session after another tab signed out.
      if (!this.readSession()) throw new CloudError('You have signed out.', 401);
      return this.storeSession(data);
    };
    if (this.locks) return this.locks.request(this.sessionKey, refresh);
    this.refreshing ||= refresh().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  async signedRequest(path, options = {}) {
    const session = await this.session();
    return this.request(path, { ...options, token: session.access_token });
  }

  async loadDays() {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await this.signedRequest(`/rest/v1/dayline_days?select=day,entries,revision&order=day.asc&limit=500&offset=${offset}`);
      if (!Array.isArray(page)) throw new Error('The notes service returned an invalid response.');
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }

  saveDay(day, entries, revision) {
    return this.signedRequest('/rest/v1/rpc/save_dayline_day', {
      method: 'POST', body: { p_day: day, p_entries: entries, p_expected_revision: revision },
    });
  }

  async signOut() {
    const session = this.readSession();
    // Revoke this device's refresh token; other signed-in devices stay signed in.
    if (session) {
      try { await this.signedRequest('/auth/v1/logout?scope=local', { method: 'POST' }); }
      catch (error) { if (error.status !== 401 && error.status !== 403) throw error; }
    }
    this.storage.removeItem(this.sessionKey);
  }
}
