import test from 'node:test';
import assert from 'node:assert/strict';
import { FocusAudio } from '../../dist/js/features/focus/audio.js';
import { MockContext } from './mock-audio-context.js';
const settings = {
  binaural: true,
  ambient: true,
  metronome: true,
  beat: 6,
  bpm: 80,
  tonesVolume: 20,
  ambientVolume: 20,
  metronomeVolume: 50,
};
test('audio generates separate stereo tones and a steady looping metronome, then stops cleanly', async () => {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = MockContext;
  try {
    const audio = new FocusAudio();
    await audio.play(settings);
    assert.equal(audio.playing, true);
    assert.equal(audio.sources.length, 4);
    assert.equal(audio.sources[0].frequency.value, 180);
    assert.equal(audio.sources[1].frequency.value, 186);
    const metronome = audio.sources.at(-1);
    assert.equal(metronome.loop, true);
    assert.equal(metronome.buffer.length, 8000 * 3);
    const previous = [...audio.sources];
    await audio.play({ ...settings, bpm: 120 });
    assert.ok(previous.every((s) => s.stopped));
    assert.equal(audio.sources.at(-1).buffer.length, 8000 * 2);
    const final = [...audio.sources];
    audio.stop();
    assert.equal(audio.playing, false);
    assert.ok(final.every((s) => s.stopped));
  } finally {
    globalThis.AudioContext = original;
  }
});
test('finishing schedules a fade to silence and stops every source', async () => {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = MockContext;
  try {
    const audio = new FocusAudio();
    await audio.play(settings);
    const sources = [...audio.sources],
      gain = audio.master.gain;
    await audio.fadeOut();
    assert.equal(gain.ramp.value, 0);
    assert.equal(gain.ramp.time, 1.75);
    assert.equal(audio.playing, false);
    assert.ok(sources.every((s) => s.stopped));
  } finally {
    globalThis.AudioContext = original;
  }
});

test('layout soundtracks are distinct, cached, and switch without leaving old sources playing', async () => {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = MockContext;
  try {
    const audio = new FocusAudio(),
      mix = { ...settings, binaural: false, metronome: false };
    await audio.play({ ...mix, layout: 'builder' });
    const electronic = audio.sources[0],
      samples = electronic.buffer.getChannelData(0);
    assert.ok(samples.some((v) => v !== 0));
    assert.ok(samples.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.801));
    await audio.play({ ...mix, layout: 'builder', ambientVolume: 40 });
    assert.equal(audio.sources[0].buffer, electronic.buffer);
    assert.equal(electronic.stopped, true);
    const previous = audio.sources[0];
    await audio.play({ ...mix, layout: 'founder' });
    const classical = audio.sources[0];
    assert.equal(previous.stopped, true);
    assert.notEqual(classical.buffer, electronic.buffer);
    assert.ok(classical.buffer.getChannelData(0).some((v) => v !== 0));
    assert.ok(
      classical.buffer.getChannelData(0).every((v) => Number.isFinite(v) && Math.abs(v) <= 0.801),
    );
    assert.notEqual(classical.buffer.length, electronic.buffer.length);
    audio.stop();
    assert.equal(classical.stopped, true);
  } finally {
    globalThis.AudioContext = original;
  }
});

test('warm ambience is an independent layer in every layout, with or without music', async () => {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = MockContext;
  try {
    const audio = new FocusAudio();
    for (const layout of ['zen', 'builder', 'founder']) {
      const mix = {
        ...settings,
        layout,
        binaural: false,
        metronome: false,
        warmAmbient: true,
        warmVolume: 25,
      };
      await audio.play(mix);
      assert.equal(audio.sources.length, 2);
      const music = audio.sources[0].buffer,
        warm = audio.sources[1].buffer;
      assert.notEqual(music, warm);
      assert.equal(warm.length, 8000 * 4);
      assert.ok(music.length > warm.length);
      await audio.play({ ...mix, ambient: false });
      assert.equal(audio.sources.length, 1);
      assert.equal(audio.sources[0].buffer, warm);
      await audio.play({ ...mix, warmAmbient: false });
      assert.equal(audio.sources.length, 1);
      assert.equal(audio.sources[0].buffer, music);
    }
    audio.stop();
    assert.equal(audio.sources.length, 0);
  } finally {
    globalThis.AudioContext = original;
  }
});

test('requests music playback before creating audio so speaker output is not classified as ambient', async () => {
  const original = globalThis.AudioContext,
    descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const session = { type: 'auto' };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { audioSession: session },
  });
  globalThis.AudioContext = class extends MockContext {
    constructor() {
      assert.equal(session.type, 'playback');
      super();
    }
  };
  try {
    const audio = new FocusAudio();
    await audio.play({ ...settings, ambient: false });
    assert.equal(audio.playing, true);
    audio.stop();
  } finally {
    globalThis.AudioContext = original;
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});
test('audio still plays when the optional playback session API rejects the setting', async () => {
  const original = globalThis.AudioContext,
    descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      audioSession: {
        set type(value) {
          throw new Error('Unsupported');
        },
      },
    },
  });
  globalThis.AudioContext = MockContext;
  try {
    const audio = new FocusAudio();
    await audio.play({ ...settings, ambient: false });
    assert.equal(audio.playing, true);
    audio.stop();
  } finally {
    globalThis.AudioContext = original;
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});
