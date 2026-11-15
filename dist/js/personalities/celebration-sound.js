// Short resolving cues, phrased as a finish for each personality.
const cues = {
  zen: {
    wave: 'sine',
    notes: [
      [523.25, 0, 0.35],
      [392, 0.19, 0.48],
    ],
  },
  builder: {
    wave: 'triangle',
    notes: [
      [392, 0, 0.12],
      [523.25, 0.1, 0.16],
      [659.25, 0.22, 0.24],
    ],
  },
  founder: {
    wave: 'triangle',
    notes: [
      [293.66, 0, 0.2],
      [369.99, 0.13, 0.26],
      [293.66, 0.28, 0.4],
      [440, 0.28, 0.38],
    ],
  },
  poet: {
    wave: 'sine',
    notes: [
      [440, 0, 0.22],
      [523.25, 0.14, 0.29],
      [392, 0.31, 0.4],
    ],
  },
  astronaut: {
    wave: 'sine',
    notes: [
      [392, 0, 0.35],
      [587.33, 0.13, 0.39],
      [783.99, 0.3, 0.43],
    ],
  },
  gamer: {
    wave: 'square',
    notes: [
      [523.25, 0, 0.095],
      [659.25, 0.08, 0.1],
      [783.99, 0.16, 0.13],
      [1046.5, 0.28, 0.22],
    ],
  },
};

export function createCelebrationSound() {
  let context;
  return {
    async play(layout) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw Error('Celebration sound is unavailable in this browser.');
      context ??= new Context();
      const audio = context;
      // Start resuming during the user's completion or Preview click.
      if (audio.state !== 'running') await audio.resume();
      if (audio !== context) return;
      const { wave, notes } = cues[layout] || cues.zen;
      const start = audio.currentTime + 0.01;
      for (const [frequency, delay, duration] of notes) {
        const tone = audio.createOscillator();
        const gain = audio.createGain();
        const at = start + delay;
        tone.type = wave;
        tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(wave === 'square' ? 0.045 : 0.09, at + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        tone.connect(gain);
        gain.connect(audio.destination);
        tone.onended = () => {
          tone.disconnect();
          gain.disconnect();
        };
        tone.start(at);
        tone.stop(at + duration);
      }
    },
    destroy() {
      context?.close().catch(() => {});
      context = null;
    },
  };
}
