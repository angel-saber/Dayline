import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { PERSONALITY_IDS } from '../../dist/js/personalities/index.js';
import { setupFocusAudio } from '../../dist/js/features/focus-audio/controller.js';
import { restoreAudioSettings } from '../../dist/js/features/focus-audio/settings.js';
const defaults = {
  binaural: false,
  ambient: true,
  warmAmbient: false,
  metronome: false,
  beat: 10,
  bpm: 80,
  tonesVolume: 30,
  ambientVolume: 35,
  warmVolume: 35,
  metronomeVolume: 50,
};

test('standalone preferences validate values, retain explicit overrides and use each personality default', () => {
  for (const mode of PERSONALITY_IDS) {
    assert.equal(restoreAudioSettings(null, defaults, mode).soundtrack, mode);
    const restored = restoreAudioSettings(
      {
        soundtrackPersonality: mode,
        soundtrack: 'founder',
        beat: 999,
        bpm: -5,
        ambientVolume: Infinity,
        ambient: 'yes',
      },
      defaults,
      mode,
    );
    assert.equal(restored.soundtrack, 'founder');
    assert.equal(restored.beat, 15);
    assert.equal(restored.bpm, 30);
    assert.equal(restored.ambientVolume, 35);
    assert.equal(restored.ambient, true);
    assert.equal(
      restoreAudioSettings({ soundtrackPersonality: 'old-mode', soundtrack: 'zen' }, defaults, mode)
        .soundtrack,
      mode,
    );
  }
});

test('the player runs without a session, preserves legacy drafts and keeps playing when minimized', async () => {
  const names = ['window', 'document', 'localStorage'];
  const previous = new Map(
    names.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const { window } = parseHTML(
    '<html data-layout="gamer"><body><button id="launch-focus-audio">Launch Focus Audio</button></body></html>',
  );
  const legacy = JSON.stringify({
    version: 1,
    notes: 'Keep this draft',
    audio: { ...defaults, bpm: 117, soundtrack: 'zen', soundtrackPersonality: 'zen' },
  });
  const data = new Map([
    ['dayline.focus.v1', legacy],
    ['dayline.v1', 'untouched notes'],
  ]);
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const engine = {
    playing: false,
    calls: [],
    async play(value) {
      this.calls.push({ ...value });
      if (this.pending) await this.pending;
      this.playing = true;
    },
    async fadeOut() {
      this.playing = false;
    },
    stop() {
      this.playing = false;
    },
  };
  try {
    for (const [key, value] of Object.entries({
      window,
      document: window.document,
      localStorage: storage,
    }))
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    window.HTMLElement.prototype.showModal = function () {
      this.open = true;
    };
    window.HTMLElement.prototype.close = function () {
      this.open = false;
    };
    Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
      configurable: true,
      get() {
        return this.querySelector('option[selected]')?.value;
      },
      set(value) {
        for (const option of this.querySelectorAll('option'))
          option.toggleAttribute('selected', option.value === String(value));
      },
    });
    const player = setupFocusAudio({ audio: engine, storage });
    const find = (text) =>
      [...document.querySelectorAll('.focus-audio-window button')].find(
        (button) => button.textContent === text,
      );
    document.querySelector('#launch-focus-audio').click();
    assert.equal(document.querySelector('.focus-audio-window').open, true);
    assert.equal(document.querySelector('[aria-label="Metronome tempo (BPM)"]').value, '117');
    let resumePlayback;
    engine.pending = new Promise((resolve) => {
      resumePlayback = resolve;
    });
    find('Play audio').click();
    document.documentElement.dataset.layout = 'poet';
    window.dispatchEvent(new window.Event('dayline:appearance'));
    assert.equal(document.querySelector('.focus-soundtrack-select').value, 'gamer');
    assert.equal(engine.calls.length, 1);
    assert.equal(document.querySelector('.focus-audio-playback').disabled, true);
    resumePlayback();
    await new Promise((resolve) => setImmediate(resolve));
    engine.pending = null;
    document.documentElement.dataset.layout = 'builder';
    window.dispatchEvent(new window.Event('dayline:appearance'));
    assert.equal(engine.calls.length, 1);
    assert.equal(document.querySelector('.focus-soundtrack-select').value, 'gamer');
    assert.equal(JSON.parse(data.get('dayline.focus-audio.v1')).soundtrackPersonality, 'builder');

    assert.equal(player.playing, true);
    assert.equal(engine.calls[0].layout, 'gamer');
    const soundtrack = document.querySelector('.focus-soundtrack-select');
    soundtrack.value = 'zen';
    soundtrack.dispatchEvent(new window.Event('change'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(engine.calls.at(-1).layout, 'zen');
    soundtrack.value = 'gamer';
    soundtrack.dispatchEvent(new window.Event('change'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(engine.calls.at(-1).layout, 'gamer');

    find('Use gentle').click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(engine.calls.at(-1).bpm, 60);
    assert.equal(engine.calls.at(-1).beat, 6);
    find('Minimize audio').click();
    assert.equal(document.querySelector('.focus-audio-window').open, false);
    assert.equal(engine.playing, true);
    const playingCalls = engine.calls.length;
    document.documentElement.dataset.layout = 'founder';
    window.dispatchEvent(new window.Event('dayline:appearance'));
    assert.equal(engine.calls.length, playingCalls);
    assert.equal(engine.playing, true);
    assert.equal(JSON.parse(data.get('dayline.focus-audio.v1')).soundtrack, 'gamer');
    assert.equal(
      restoreAudioSettings(JSON.parse(data.get('dayline.focus-audio.v1')), defaults, 'founder')
        .soundtrack,
      'gamer',
    );
    assert.equal(
      document.querySelector('#launch-focus-audio').textContent,
      'Focus Audio · Playing',
    );
    window.dispatchEvent(
      new window.CustomEvent('dayline:focus-state', { detail: { phase: 'closed' } }),
    );
    assert.equal(engine.playing, true);
    player.open();
    find('Pause audio').click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(engine.playing, false);
    document.documentElement.dataset.layout = 'astronaut';
    window.dispatchEvent(new window.Event('dayline:appearance'));
    assert.equal(document.querySelector('.focus-soundtrack-select').value, 'astronaut');
    assert.equal(engine.calls.length, playingCalls);
    assert.equal(data.get('dayline.focus.v1'), legacy);
    assert.equal(data.get('dayline.v1'), 'untouched notes');
    assert.equal(JSON.parse(data.get('dayline.focus-audio.v1')).bpm, 60);
    player.minimize();
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
