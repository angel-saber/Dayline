import { PERSONALITY_IDS } from '../../personalities/ids.js?v=d1fd759ff193';
import { validState } from '../../shared/storage.js?v=d1fd759ff193';
import { availableHours } from '../settings/available-hours.js?v=d1fd759ff193';
import { validTagSettings } from '../notes/note-types.js?v=d1fd759ff193';

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (value) => structuredClone(value);
export function sharedPreferences(settings, layout = 'zen') {
  if (!PERSONALITY_IDS.includes(layout)) throw new Error('Invalid personality preference.');
  const valid = validState({ version: 1, days: {}, settings }).settings;
  return {
    ...valid,
    availableHours: availableHours(valid),
    tags: validTagSettings(valid.tags),
    layout,
  };
}
export function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid account settings.');
  return sharedPreferences(value, value.layout);
}

// Settings have their own revision and queue: changing them cannot replace notes.
// Merge only explicitly changed fields over the latest account preferences.
export class PreferencesSync {
  constructor({
    cloud,
    userId,
    cacheId = 'default',
    initial,
    storage = localStorage,
    onValues = () => {},
    onStatus = () => {},
  }) {
    Object.assign(this, { cloud, storage, onValues, onStatus, userId, cacheId });
    this.key = `dayline.settings:${userId}:${cacheId}`;
    this.base = null;
    this.values = validatePreferences(initial);
    this.patch = {};
    this.revision = 0;
    this.stopped = false;
    const raw = storage.getItem(this.key);
    if (raw) {
      const saved = JSON.parse(raw);
      this.base = saved.base && validatePreferences(saved.base);
      this.values = validatePreferences(saved.values);
      this.revision = saved.revision;
      this.patch = saved.patch || {};
      if (
        !Number.isSafeInteger(this.revision) ||
        this.revision < 0 ||
        !this.patch ||
        typeof this.patch !== 'object' ||
        Array.isArray(this.patch) ||
        Object.keys(this.patch).some((k) => !Object.hasOwn(this.values, k))
      )
        throw new Error('Saved account settings could not be read.');
      this.patch = Object.fromEntries(Object.keys(this.patch).map((k) => [k, this.values[k]]));
    }
  }
  get pending() {
    return Object.keys(this.patch).length > 0;
  }
  persist() {
    this.storage.setItem(
      this.key,
      JSON.stringify({
        base: this.base,
        values: this.values,
        patch: this.patch,
        revision: this.revision,
      }),
    );
  }
  stage(value, force = false) {
    if (this.stopped) return;
    const next = validatePreferences(value);
    for (const key of Object.keys(next))
      if (force || !equal(next[key], this.values[key])) this.patch[key] = clone(next[key]);
    this.values = next;
    this.persist();
    if (this.pending) {
      this.onStatus('pending');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.sync().catch(() => {}), 600);
    }
  }
  publish() {
    if (this.stopped) return;
    this.persist();
    this.onValues(clone(this.values));
  }
  integrate(row) {
    if (!Number.isSafeInteger(row.revision) || row.revision < 0)
      throw new Error('Invalid account settings revision.');
    if (row.revision < this.revision) return;
    this.base = validatePreferences(row.preferences);
    this.revision = row.revision;
    this.values = validatePreferences({ ...this.base, ...this.patch });
  }
  recover() {
    this.recovered = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key?.startsWith(`dayline.settings:${this.userId}:`) || key === this.key) continue;
      const tab = key.slice(`dayline.settings:${this.userId}:`.length);
      if (
        Number(this.storage.getItem(`dayline.drafts:${this.userId}:${tab}:lease`)) >
        Date.now() - 45000
      )
        continue;
      const raw = this.storage.getItem(key),
        saved = JSON.parse(raw);
      if (!saved.patch || !Object.keys(saved.patch).length) continue;
      const values = validatePreferences(saved.values);
      for (const field of Object.keys(saved.patch))
        if (Object.hasOwn(values, field) && !Object.hasOwn(this.patch, field))
          this.patch[field] = values[field];
      this.recovered.push({ key, raw });
    }
  }
  async sync() {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  async run() {
    try {
      do {
        this.again = false;
        this.recover();
        const row = await this.cloud.loadPreferences();
        if (this.stopped) return;
        if (row) this.integrate(row);
        this.publish();
        for (let attempt = 0; this.pending && attempt < 5; attempt++) {
          const patch = clone(this.patch),
            sent = validatePreferences({ ...(this.base || this.values), ...patch });
          const result = await this.cloud.savePreferences(sent, this.revision);
          if (this.stopped) return;
          if (result.conflict) this.integrate(result);
          else {
            if (!Number.isSafeInteger(result.revision) || result.revision <= this.revision)
              throw new Error('Invalid settings save response.');
            this.base = sent;
            this.revision = result.revision;
            for (const key of Object.keys(patch))
              if (equal(this.patch[key], patch[key])) delete this.patch[key];
            this.values = validatePreferences({ ...this.base, ...this.patch });
          }
          this.publish();
        }
        if (this.pending)
          throw new Error('Settings changed on another device. Try Sync now again.');
        for (const { key, raw } of this.recovered)
          if (this.storage.getItem(key) === raw) this.storage.removeItem(key);
      } while (this.again && !this.stopped);
      if (!this.stopped) this.onStatus(this.base ? 'synced' : 'unconfigured');
    } catch (error) {
      if (!this.stopped) {
        this.persist();
        this.onStatus('error', error);
      }
      throw error;
    }
  }
  start() {
    this.poll = setInterval(() => this.sync().catch(() => {}), 15000);
  }
  stop() {
    this.stopped = true;
    clearInterval(this.poll);
    clearTimeout(this.timer);
  }
}
