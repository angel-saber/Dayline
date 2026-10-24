// Small local synthesis helpers for the new original scores. No recordings.
export function scoreTools(data, rate) {
  const tau = Math.PI * 2;
  let seed = 1618033;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  function add(at, duration, sample) {
    const start = Math.round(at * rate),
      count = Math.ceil(duration * rate);
    for (let i = 0; i < count; i++) data[(start + i) % data.length] += sample(i / rate, duration);
  }
  function tone(midi, at, duration, volume, kind = 'pad') {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    add(at, duration, (t, length) => {
      const attack = Math.min(1, t / (kind === 'pad' ? 0.8 : 0.025)),
        release = Math.min(1, (length - t) / (kind === 'pad' ? 1.8 : 0.12));
      const envelope = attack * release * (kind === 'pad' ? 1 : Math.exp(-t * 3));
      const fundamental = Math.sin(tau * hz * t),
        harmonic = Math.sin(tau * hz * 2 * t) * 0.12;
      return (fundamental + harmonic) * volume * envelope;
    });
  }
  function normalize() {
    let peak = 0;
    for (const value of data) peak = Math.max(peak, Math.abs(value));
    if (peak) for (let i = 0; i < data.length; i++) data[i] *= 0.78 / peak;
  }
  return { tau, noise, add, tone, normalize };
}
