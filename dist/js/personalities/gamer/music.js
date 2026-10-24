import { scoreTools } from '../score-tools.js?v=3964ffef2821';
// Next Level: an original, warm adventure-electronic loop. No borrowed themes.
export function renderScore(data, rate) {
  if (!data.length || rate <= 0) return;
  const { tau, noise, add, tone, normalize } = scoreTools(data, rate),
    beat = 60 / 112;
  const chords = [
    [50, 57, 62, 66],
    [47, 54, 59, 62],
    [43, 50, 55, 59],
    [45, 52, 57, 61],
  ];
  const roots = [38, 35, 31, 33];
  const melodies = [
    [74, 78, 81, 78, 76, 74],
    [74, 73, 71, 66, 69, 71],
    [71, 74, 78, 76, 74, 71],
    [73, 76, 81, 78, 76, 73],
  ];
  const energy = [0.6, 0.7, 0.82, 0.94, 1, 0.92, 0.8, 0.65];
  function pluck(midi, at, volume) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    add(at, 1.5, (t, duration) => {
      const phase = tau * hz * t,
        envelope = Math.min(1, t / 0.014) * Math.min(1, (duration - t) / 0.2) * Math.exp(-t * 3.5);
      let sound = Math.sin(phase);
      if (hz * 3 < rate * 0.45) sound += 0.11 * Math.sin(phase * 3) * Math.exp(-t * 5);
      if (hz * 5 < rate * 0.45) sound += 0.03 * Math.sin(phase * 5) * Math.exp(-t * 8);
      return sound * envelope * volume;
    });
  }
  for (let section = 0; section < 8; section++) {
    const start = section * 16 * beat,
      level = energy[section],
      chord = chords[section % 4],
      root = roots[section % 4];
    chord.forEach((note, index) => tone(note, start + index * 0.08, 18 * beat, 0.028 * level));
    for (let step = 0; step < 16; step++) {
      const at = start + step * beat;
      const bass = root + ([3, 7, 11, 15].includes(step) ? 12 : 0);
      const frequency = 440 * 2 ** ((bass - 69) / 12);
      add(at + 0.5 * beat, 0.6 * beat, (t, length) => {
        const phase = tau * frequency * t,
          envelope = Math.min(1, t / 0.018) * Math.min(1, (length - t) / 0.08);
        return (
          (Math.sin(phase) + 0.22 * Math.sin(phase * 2) + 0.08 * Math.sin(phase * 3)) *
          envelope *
          0.07 *
          level
        );
      });
      if (step % 2 === 0)
        add(
          at,
          0.18,
          (t) =>
            Math.sin(tau * (48 * t + (35 * (1 - Math.exp(-t * 30))) / 30)) *
            Math.min(1, t / 0.005) *
            Math.exp(-t * 24) *
            0.11 *
            level,
        );
      if (step % 4 === 1 || step % 4 === 3)
        add(at, 0.1, (t) => noise() * Math.min(1, t / 0.003) * Math.exp(-t * 45) * 0.032 * level);
      add(at + 0.5 * beat, 0.035, (t) => noise() * Math.exp(-t * 110) * 0.009 * level);
      if (section > 0 && section < 7) pluck(chord[step % 4] + 12, at + 0.75 * beat, 0.013 * level);
    }
    const offsets = [0, 1.5, 3, 6, 9, 12];
    melodies[section % 4].forEach((note, index) => {
      const at = start + offsets[index] * beat;
      pluck(note, at, 0.055 * level);
      pluck(note, at + 0.5 * beat, 0.013 * level);
    });
    if (section === 4 || section === 5)
      tone(chord[2] + 12, start + 4 * beat, 13 * beat, 0.024 * level);
  }
  normalize();
}
