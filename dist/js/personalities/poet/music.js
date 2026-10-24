import { scoreTools } from '../score-tools.js?v=fe286a6e269a';
// Velvet Reverie: an original minor-to-major chamber miniature, without recordings.
export function renderScore(data, rate) {
  if (!data.length || rate <= 0) return;
  const { add, tau, normalize } = scoreTools(data, rate),
    beat = 60 / 66;
  function piano(midi, at, length, volume) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    add(at, length, (t, duration) => {
      const envelope =
        Math.min(1, t / 0.012) * Math.min(1, (duration - t) / 0.6) * Math.exp(-t * 1.05);
      let value = 0;
      for (const [partial, level] of [
        [1, 1],
        [2, 0.28],
        [3, 0.11],
        [4, 0.05],
      ])
        if (hz * partial < rate * 0.45)
          value += Math.sin(tau * hz * partial * t) * level * Math.exp(-t * (partial - 1) * 0.32);
      return value * volume * envelope;
    });
  }
  function strings(midi, at, length, volume) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    add(at, length, (t, duration) => {
      const envelope = Math.min(1, t / 1.8) * Math.min(1, (duration - t) / 3);
      const phase = tau * hz * t + 0.12 * Math.sin(tau * 4.6 * t);
      return (
        (Math.sin(phase) + 0.25 * Math.sin(phase * 1.002) + 0.13 * Math.sin(phase * 2)) *
        volume *
        envelope
      );
    });
  }
  const chords = [
    [50, 57, 64, 65],
    [46, 53, 57, 62],
    [41, 48, 57, 64],
    [48, 55, 62, 64],
    [43, 50, 58, 65],
    [46, 53, 57, 62],
    [50, 57, 64, 65],
    [41, 48, 57, 64],
  ];
  const melodies = [
    [77, 76, 72, 69],
    [74, 72, 69, 65],
    [76, 77, 81, 79],
    [76, 74, 72, 67],
    [77, 81, 79, 77],
    [74, 77, 81, 79],
    [77, 76, 72, 69],
    [72, 76, 77, 76],
  ];
  const arc = [0.55, 0.65, 0.8, 0.9, 1, 0.85, 0.7, 0.55];
  for (let section = 0; section < 8; section++) {
    const start = section * 16 * beat,
      chord = chords[section],
      level = arc[section];
    strings(chord[0] - 12, start, 19 * beat, 0.032 * level);
    chord
      .slice(1)
      .forEach((note, index) => strings(note, start + 0.2 * index, 19 * beat, 0.022 * level));
    for (let step = 0; step < 8; step++) {
      const note = chord[[0, 1, 2, 1, 0, 1, 3, 2][step]],
        at = start + step * 2 * beat;
      piano(note, at, 4.5 * beat, 0.05 * level);
    }
    for (let step = 0; step < 4; step++) {
      const at = start + (2 + step * 4) * beat,
        note = melodies[section][step];
      piano(note, at, 5 * beat, 0.065 * level);
      piano(note, at + 0.75 * beat, 4 * beat, 0.012 * level);
    }
  }
  normalize();
}
