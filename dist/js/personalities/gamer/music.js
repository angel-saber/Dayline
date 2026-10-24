import { scoreTools } from '../score-tools.js?v=280f4d8eaa90';
// Ascension Protocol: deliberate momentum, layered harmony and restrained motifs.
export function renderScore(data, rate) {
  if (!data.length || rate <= 0) return;
  const { tau, noise, add, tone, normalize } = scoreTools(data, rate),
    beat = 60 / 88;
  const roots = [45, 41, 48, 43],
    intervals = [
      [0, 7, 14],
      [0, 7, 12],
      [0, 7, 14],
      [0, 7, 16],
    ];
  for (let section = 0; section < 4; section++) {
    const start = section * 16 * beat,
      root = roots[section];
    for (const offset of intervals[section]) tone(root + 12 + offset, start, 17 * beat, 0.045);
    for (let step = 0; step < 16; step++) {
      const at = start + step * beat;
      tone(root + (step % 8 === 6 ? 7 : 0), at, 0.65 * beat, 0.08, 'bass');
      if (step % 2 === 0)
        add(
          at,
          0.15,
          (t) =>
            Math.sin(tau * (52 * t + (30 * (1 - Math.exp(-t * 28))) / 28)) *
            Math.min(1, t / 0.006) *
            Math.exp(-t * 26) *
            0.12,
        );
      if (step % 4 === 2)
        add(at, 0.09, (t) => noise() * Math.exp(-t * 48) * Math.min(1, t / 0.003) * 0.035);
      add(at + 0.5 * beat, 0.035, (t) => noise() * Math.exp(-t * 95) * 0.012);
      if (step % 2 === 1) {
        const note = root + 24 + intervals[section][Math.floor(step / 2) % 3];
        tone(note, at, 1.2 * beat, 0.035, 'crystal');
        tone(note + 12, at + 0.5 * beat, 0.7 * beat, 0.009, 'crystal');
      }
    }
    if (section === 3)
      for (let step = 0; step < 4; step++)
        tone(
          root + 24 + [7, 12, 14, 19][step],
          start + (8 + step * 2) * beat,
          3 * beat,
          0.025,
          'crystal',
        );
  }
  normalize();
}
