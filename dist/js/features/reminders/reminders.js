import { reminderChime } from './reminder-chime.js?v=6880fc00acca';
import { dayKey, dueEntries, bucket } from '../../shared/schedule.js?v=6880fc00acca';
export class Reminders {
  constructor(getState, onDue, onError, onOpen = () => {}, onAudioState = () => {}) {
    this.getState = getState;
    this.onDue = onDue;
    this.onError = onError;
    this.onOpen = onOpen;
    this.onAudioState = onAudioState;
    this.last = Date.now();
    this.fired = new Set();
    this.timer = setInterval(() => this.tick(), 1000);
    // Visibility changes never pause reminders. Recheck promptly when a
    // throttled page resumes; the browser still controls whether it can run.
    this.resume = () => this.tick();
    globalThis.document?.addEventListener('visibilitychange', this.resume);
    globalThis.addEventListener?.('pageshow', this.resume);
  }
  get audioReady() {
    return this.unlocked === true && !this.audio?.error;
  }
  ensureAudio() {
    try {
      if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback';
    } catch {
      /* Optional browser capability. */
    }
    if (!this.audio) {
      const Audio = globalThis.Audio;
      if (!Audio) throw new Error('Sound is unavailable in this browser.');
      this.chimeSource = reminderChime();
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.addEventListener?.('error', () => {
        this.unlocked = false;
        this.onAudioState();
      });
    }
  }
  async playAudio(prime = false) {
    this.ensureAudio();
    if (this.playOperation) {
      if (!prime && this.priming) return this.playOperation.then(() => this.playAudio());
      return this.playOperation;
    }
    if (prime && this.audioReady) return;
    this.priming = prime;
    let timeout;
    try {
      // A single media element retains its user-granted playback permission.
      // Silent PCM primes it on a click; the real chime uses that same player.
      const source = prime ? (this.silentSource ??= reminderChime(true)) : this.chimeSource;
      if (this.audio.src !== source) this.audio.src = source;
      this.audio.currentTime = 0;
      const playback = this.audio.play(); // Must happen before any await in a click.
      this.playOperation = Promise.race([
        Promise.resolve(playback),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(
                  'Reminder audio did not start. Click Test sound in Settings and check this site’s autoplay permission.',
                ),
              ),
            2500,
          );
        }),
      ]);
      await this.playOperation;
      if (prime) {
        this.audio.pause();
        this.audio.src = this.chimeSource;
        this.audio.load?.();
      }
      this.unlocked = true;
    } catch (error) {
      this.unlocked = false;
      this.audio.pause();
      throw new Error(
        error.name === 'NotAllowedError'
          ? 'Your browser blocked the reminder sound. Click Test sound in Settings; in Safari, allow autoplay for Dayline.'
          : error.message,
      );
    } finally {
      clearTimeout(timeout);
      this.playOperation = null;
      this.priming = false;
      this.onAudioState();
    }
  }
  unlockAudio() {
    return this.playAudio(true);
  }
  chime() {
    return this.playAudio(false);
  }
  scheduleTest() {
    this.testAt = Date.now() + 10000;
  }
  notify(entry, target, token) {
    this.onDue(entry, target);
    if (globalThis.Notification?.permission === 'granted') {
      try {
        const notification = new Notification('Dayline · It’s time', {
          body: entry.title ? `${entry.title}\n${entry.text}` : entry.text,
          tag: token,
        });
        notification.onclick = () => {
          notification.close();
          globalThis.focus?.();
          if (target) this.onOpen(target);
        };
      } catch {
        /* In-app reminder remains available. */
      }
    }
  }
  tick() {
    const now = Date.now(),
      state = this.getState();
    // Avoid stale alarms when a sleeping device resumes hours later.
    const gap = now - this.last;
    const from = gap <= 300000 ? this.last : now - 60000;
    this.last = now;
    const testDue = this.testAt && now >= this.testAt;
    if (testDue) this.testAt = null;
    if (!state.settings.notifications) return;
    const alerts = [];
    const dates = [...new Set([dayKey(new Date(from)), dayKey(new Date(now))])];
    for (const key of dates)
      for (const entry of dueEntries(
        state.days[key] || [],
        key,
        state.settings.interval,
        from,
        now,
      )) {
        const token = `${key}:${entry.id}:${entry.minute}`;
        if (this.fired.has(token)) continue;
        this.fired.add(token);
        alerts.push({ entry, target: { date: key, id: entry.id, minute: entry.minute }, token });
      }
    if (testDue)
      alerts.push({
        entry: {
          title: 'Reminder sound test',
          text: 'This is the same playback path used for planned notes.',
        },
        target: null,
        token: 'dayline-reminder-test',
      });
    // Start the shared player before displaying the system notification.
    if (alerts.length && state.settings.sound)
      this.chime().catch((error) => this.onError(error.message));
    for (const { entry, target, token } of alerts) this.notify(entry, target, token);
  }
}

// Resolve again at click time: a note may have moved or intervals may have changed.
export function resolveReminder(days, target, interval) {
  for (const date of [target.date, ...Object.keys(days).filter((date) => date !== target.date)]) {
    const entry = days[date]?.find((entry) => !entry.weekly && entry.id === target.id);
    if (entry) return { date, id: entry.id, minute: bucket(entry.minute, interval), found: true };
  }
  return { ...target, minute: bucket(target.minute, interval), found: false };
}
