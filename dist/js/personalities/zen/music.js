// Original bowl-and-bell soundscape: synthesized timbres, not ritual recordings.
export function renderScore(data, rate) {
  const tau = 2 * Math.PI;
  function bowl(midi, at, length, volume, bell = false) {
    const hz = 440 * 2 ** ((midi - 69) / 12),
      start = Math.round(at * rate);
    const partials = bell
      ? [
          [1, 1],
          [2.76, 0.22],
          [5.4, 0.07],
        ]
      : [
          [1, 1],
          [2.71, 0.28],
          [5.18, 0.09],
          [1.006, 0.38],
        ];
    for (let i = 0; i < length * rate; i++) {
      const t = i / rate,
        attack = Math.min(1, t / (bell ? 0.035 : 0.28)),
        release = Math.min(1, (length - t) / 1.8);
      let value = 0;
      for (let p = 0; p < partials.length; p++) {
        const [ratio, level] = partials[p];
        if (hz * ratio < rate * 0.42)
          value +=
            Math.sin(tau * hz * ratio * t) *
            level *
            Math.exp(-t * (bell ? 0.65 : 0.19) * (1 + p * 0.45));
      }
      data[(start + i) % data.length] += value * volume * attack * Math.max(0, release);
    }
  }
  // A spacious 64-second phrase with gently overlapping low bowls.
  for (const [midi, at] of [
    [48, 0],
    [55, 12],
    [50, 24],
    [57, 36],
    [55, 48],
  ])
    bowl(midi, at, 20, 0.18);
  for (const [midi, at] of [
    [72, 7],
    [79, 29],
    [74, 51],
  ])
    bowl(midi, at, 9, 0.045, true);
  const dry = data.slice();
  for (const [seconds, gain] of [
    [0.19, 0.13],
    [0.37, 0.1],
    [0.61, 0.075],
    [0.97, 0.045],
  ]) {
    const delay = Math.round(seconds * rate);
    for (let i = 0; i < data.length; i++) data[(i + delay) % data.length] += dry[i] * gain;
  }
  let peak = 0;
  for (const value of data) peak = Math.max(peak, Math.abs(value));
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= 0.8 / peak;
}
