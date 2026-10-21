import { validState } from './storage.js?v=line-tasks-1';

const copy = value => structuredClone(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function conflictId(entry) {
  // Stable identities make recovery/retries idempotent. These hashes identify
  // note versions; they are not used for passwords or authorization.
  let a = 2166136261, b = 3339675911;
  for (const character of JSON.stringify(entry)) {
    a = Math.imul(a ^ character.charCodeAt(0), 16777619);
    b = Math.imul(b ^ character.charCodeAt(0), 2246822519);
  }
  return `conflict-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export function validateDay(day, entries) {
  return validState({ version: 1, days: { [day]: entries } }).days[day];
}

// A three-way merge keeps independent edits and preserves both versions when
// the same note changes on two devices. A deletion never erases a new edit.
export function mergeEntries(base, local, remote, newId = conflictId) {
  const index = list => new Map(list.map(entry => [entry.id, entry]));
  const b = index(base), l = index(local), r = index(remote);
  const result = [];
  let conflicts = 0;
  for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const before = b.get(id), here = l.get(id), there = r.get(id);
    if (equal(here, before)) { if (there) result.push(copy(there)); }
    else if (equal(there, before) || equal(here, there)) { if (here) result.push(copy(here)); }
    else {
      conflicts++;
      if (there) result.push(copy(there));
      if (here) result.push({ ...copy(here), id: there ? newId(here) : here.id });
    }
  }
  const unique = [...new Map(result.map(entry => [entry.id, entry])).values()];
  return { entries: unique.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id)), conflicts };
}

export function mergeGuestDays(accountDays, guestDays, newId = () => crypto.randomUUID()) {
  const days = copy(accountDays);
  for (const [day, notes] of Object.entries(guestDays)) {
    const existing = days[day] || [];
    const ids = new Set(existing.map(entry => entry.id));
    for (const entry of notes) {
      if (existing.some(other => equal({ ...other, id: entry.id }, entry))) continue;
      const id = ids.has(entry.id) ? newId() : entry.id;
      existing.push({ ...copy(entry), id }); ids.add(id);
    }
    days[day] = existing.sort((a, b) => a.minute - b.minute);
  }
  return days;
}

export function clearSyncedDrafts(storage, prefix) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix) && !key.endsWith(':lease')) keys.push(key);
  }
  for (const key of keys) {
    try {
      const records = JSON.parse(storage.getItem(key));
      if (!records || typeof records !== 'object' || Array.isArray(records)) continue;
      const clean = Object.values(records).every(row => Array.isArray(row?.entries) && Array.isArray(row?.base) && equal(row.entries, row.base));
      // Signing out in one tab must not erase another tab's unsent work.
      if (clean) { storage.removeItem(key); storage.removeItem(`${key}:lease`); }
    } catch { /* Preserve unreadable caches for recovery rather than deleting. */ }
  }
}

export class SyncEngine {
  constructor({ cloud, userId, storage = localStorage, cacheId = 'default', onDays, onStatus, onConflict }) {
    Object.assign(this, { cloud, storage, onDays, onStatus, onConflict });
    // A tab gets its own durable draft cache so two open tabs cannot overwrite
    // one another's offline edits. Account identity is always part of the key.
    this.key = `dayline.drafts:${userId}:${cacheId}`;
    this.userPrefix = `dayline.drafts:${userId}:`;
    this.records = {};
    this.stopped = false;
    const raw = storage.getItem(this.key);
    if (raw) this.records = this.validateRecords(JSON.parse(raw));
  }

  validateRecords(records) {
    const result = {};
    if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('The account draft cache could not be read.');
    for (const [day, row] of Object.entries(records)) {
      if (!Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error('Invalid cached revision.');
      result[day] = { entries: validateDay(day, row.entries), base: validateDay(day, row.base), revision: row.revision };
    }
    return result;
  }

  get days() { return Object.fromEntries(Object.entries(this.records).map(([day, row]) => [day, copy(row.entries)])); }
  get pending() { return Object.values(this.records).some(row => !equal(row.entries, row.base)); }

  persist() {
    this.storage.setItem(this.key, JSON.stringify(this.records));
  }

  publish() {
    if (this.stopped) return;
    this.persist();
    this.onDays(this.days);
  }

  stage(days) {
    if (this.stopped) return;
    for (const day of new Set([...Object.keys(days), ...Object.keys(this.records)])) {
      const row = this.records[day] ||= { entries: [], base: [], revision: 0 };
      row.entries = copy(validateDay(day, days[day] || []));
    }
    this.persist();
    this.onStatus('pending');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync().catch(() => {}), 600);
  }

  integrate(day, remoteEntries, revision) {
    const remote = validateDay(day, remoteEntries);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid cloud revision.');
    const row = this.records[day] ||= { entries: [], base: [], revision: 0 };
    if (revision < row.revision) return;
    const merged = mergeEntries(row.base, row.entries, remote);
    row.entries = merged.entries; row.base = copy(remote); row.revision = revision;
    if (merged.conflicts) this.onConflict(merged.conflicts);
  }

  // Recover a prior tab's unsent notes after the browser was closed. Recovered
  // drafts are copied; the original cache remains until a successful sync.
  recoverDrafts() {
    this.recoveredKeys = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key?.startsWith(this.userPrefix) || key === this.key) continue;
      // Live tabs own a short lease; only abandoned caches are recovered.
      const lease = Number(this.storage.getItem(`${key}:lease`));
      if (key.endsWith(':lease') || lease > Date.now() - 45000) continue;
      const rows = this.validateRecords(JSON.parse(this.storage.getItem(key)));
      for (const [day, row] of Object.entries(rows)) {
        if (equal(row.entries, row.base)) continue;
        const here = this.records[day] ||= { entries: [], base: [], revision: 0 };
        const merged = mergeEntries(row.base, row.entries, here.entries);
        here.entries = merged.entries;
        if (merged.conflicts) this.onConflict(merged.conflicts);
      }
      this.recoveredKeys.push(key);
    }
  }

  async sync() {
    if (this.stopped) return;
    if (this.running) { this.again = true; return this.running; }
    this.running = this.run().finally(() => { this.running = null; });
    return this.running;
  }

  async run() {
    try {
      do {
        this.again = false; this.onStatus('syncing');
        const remote = await this.cloud.loadDays();
        if (this.stopped) return;
        for (const row of remote) this.integrate(row.day, row.entries, row.revision);
        this.recoverDrafts();
        this.publish();
        for (const [day, row] of Object.entries(this.records)) {
          for (let attempt = 0; !equal(row.entries, row.base) && attempt < 5; attempt++) {
            const sent = copy(row.entries);
            const result = await this.cloud.saveDay(day, sent, row.revision);
            if (this.stopped) return;
            if (result.conflict) this.integrate(day, result.entries, result.revision);
            else {
              if (!Number.isSafeInteger(result.revision) || result.revision <= row.revision) throw new Error('Invalid save response.');
              row.base = sent; row.revision = result.revision;
              // row.entries may have changed while this request was in flight.
            }
            this.publish();
          }
        }
      } while (this.again && !this.stopped);
      if (this.pending) throw new Error('Notes changed on another device. Retry sync to finish saving.');
      for (const key of this.recoveredKeys || []) { this.storage.removeItem(key); this.storage.removeItem(`${key}:lease`); }
      this.recoveredKeys = [];
      this.onStatus('synced');
    } catch (error) {
      if (!this.stopped) { this.persist(); this.onStatus('error', error); }
      throw error;
    }
  }

  start() {
    this.storage.setItem(`${this.key}:lease`, String(Date.now()));
    this.heartbeat = setInterval(() => this.storage.setItem(`${this.key}:lease`, String(Date.now())), 15000);
    this.poll = setInterval(() => this.sync().catch(() => {}), 15000);
  }

  stop() {
    this.stopped = true; clearTimeout(this.timer); clearInterval(this.poll); clearInterval(this.heartbeat);
    this.storage.removeItem(`${this.key}:lease`);
  }
}
