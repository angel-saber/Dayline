import { scoreTools } from '../score-tools.js?v=ca08f99f62a3';
// Orbital Drift: suspended harmony, patient signals and a soft, shared pulse.
export function renderScore(data, rate) {
  if (!data.length || rate <= 0) return;
  const { tau, add, tone, normalize } = scoreTools(data, rate),
    beat = 60 / 64;
  const chords = [
    [45, 52, 59, 64],
    [41, 48, 55, 60],
    [48, 55, 62, 67],
    [43, 50, 57, 62],
  ];
  for (let section = 0; section < 4; section++) {
    const start = section * 16 * beat;
    for (const [index, note] of chords[section].entries())
      tone(note, start, 18 * beat, 0.055 / (1 + index * 0.2));
    const signals = [
      chords[section][2] + 12,
      chords[section][3] + 12,
      chords[section][1] + 24,
      chords[section][2] + 12,
    ];
    for (let step = 0; step < 4; step++) {
      const at = start + (step * 4 + 2) * beat;
      tone(signals[step], at, 3.7 * beat, 0.035, 'signal');
      tone(signals[step], at + 0.75 * beat, 3 * beat, 0.012, 'signal');
    }
    for (let pulse = 0; pulse < 8; pulse++)
      add(
        start + pulse * 2 * beat,
        0.65,
        (t) => Math.sin(tau * 50 * t) * Math.min(1, t / 0.035) * Math.exp(-t * 8) * 0.035,
      );
  }
  normalize();
}
