import { musicProfile, musicLength, renderMusic } from './music.js?v=3bc29ba06496';
// All sounds are generated locally; no remote tracks, accounts or audio downloads.
export class FocusAudio {
  constructor() {
    this.sources = [];
    this.playing = false;
    this.generation = 0;
  }
  async play(settings) {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) throw new Error('Focus audio is unavailable in this browser.');
    // Declare music playback before creating/resuming Web Audio. Safari otherwise
    // treats it as ambient audio and can mute built-in speakers in Silent Mode.
    try {
      if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback';
    } catch {
      /* Older browsers can expose an unsupported session API. */
    }
    const generation = ++this.generation;
    this.context ??= new Context();
    await this.context.resume();
    if (generation !== this.generation) return;
    this.stopSources();
    const ctx = this.context;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    const gain = (volume) => {
      const g = ctx.createGain();
      g.gain.value = volume;
      g.connect(this.master);
      return g;
    };
    if (settings.binaural) {
      [-1, 1].forEach((pan, i) => {
        const tone = ctx.createOscillator(),
          panner = ctx.createStereoPanner();
        tone.frequency.value = 180 + i * settings.beat;
        panner.pan.value = pan;
        tone.connect(panner);
        panner.connect(gain((settings.tonesVolume / 100) * 0.12));
        tone.start();
        this.sources.push(tone);
      });
    }
    if (settings.ambient) {
      const profile = musicProfile(settings.layout);
      this.musicBuffers ??= new Map();
      let buffer = this.musicBuffers.get(profile.layout);
      if (!buffer) {
        const rate = Math.min(ctx.sampleRate, profile.renderSampleRate ?? ctx.sampleRate);
        buffer = ctx.createBuffer(1, musicLength(rate, profile.layout), rate);
        const data = buffer.getChannelData(0);
        renderMusic(data, rate, profile.layout);
        this.musicBuffers.set(profile.layout, buffer);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain((settings.ambientVolume / 100) * 0.3));
      source.start();
      this.sources.push(source);
    }
    if (settings.warmAmbient) {
      if (!this.warmBuffer) {
        this.warmBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const data = this.warmBuffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02;
          data[i] = brown * 3;
        }
      }
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter();
      source.buffer = this.warmBuffer;
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 950;
      source.connect(filter);
      filter.connect(gain(((settings.warmVolume ?? 35) / 100) * 0.35));
      source.start();
      this.sources.push(source);
    }
    if (settings.metronome) {
      // A looping audio buffer stays steady even when JS timers are throttled.
      const beatSeconds = 60 / settings.bpm,
        buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * beatSeconds * 4), ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let beat = 0; beat < 4; beat++) {
        const offset = Math.round(beat * beatSeconds * ctx.sampleRate);
        for (let i = 0; i < ctx.sampleRate * 0.045 && offset + i < data.length; i++) {
          const t = i / ctx.sampleRate;
          data[offset + i] =
            Math.sin(2 * Math.PI * (beat === 0 ? 1100 : 820) * t) * Math.exp(-t * 95);
        }
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain((settings.metronomeVolume / 100) * 0.45));
      source.start();
      this.sources.push(source);
    }
    this.playing = true;
  }
  stopSources() {
    for (const source of this.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.sources = [];
    this.master?.disconnect();
    this.playing = false;
  }
  async fadeOut() {
    if (!this.playing) return;
    const generation = ++this.generation,
      ctx = this.context;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.75);
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (generation === this.generation) this.stopSources();
  }
  stop() {
    this.generation++;
    this.stopSources();
  }
}
