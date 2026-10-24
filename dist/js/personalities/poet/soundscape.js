// Locally synthesized surf, wordless vowel refrains and low pulses; no recordings.
export function oceanLayer(data, rate, tools) {
  const { add, noise, tau } = tools;
  let water = 0,
    foam = 0;
  add(0, data.length / rate, (t, duration) => {
    const n = noise();
    water = water * 0.985 + n * 0.015;
    foam = foam * 0.72 + n * 0.28;
    const swell = ((1 + Math.sin((tau * t) / 11.7 - 0.8)) / 2) ** 2;
    const shore = (1 + Math.sin((tau * t) / 5.3)) / 2;
    const edge = Math.min(1, t / 2, (duration - t) / 2);
    return (water * (0.08 + 0.22 * swell) + foam * 0.018 * swell * shore) * edge;
  });
}
export function vowelPhrase(tools, rate, midi, at, duration, volume, vowel = 'ah') {
  const { add, tau, noise } = tools,
    fundamental = 440 * 2 ** ((midi - 69) / 12);
  const formants = { ah: [700, 1150, 2500], oh: [450, 900, 2400], mm: [250, 1100, 2100] }[vowel];
  const harmonics = [];
  for (let h = 1; h <= 14 && fundamental * h < rate * 0.43; h++) {
    const frequency = fundamental * h;
    const resonance = formants.reduce(
      (sum, center, index) =>
        sum +
        Math.exp(-0.5 * ((frequency - center) / (index === 0 ? 150 : 240)) ** 2) *
          [1, 0.65, 0.3][index],
      0,
    );
    harmonics.push([h, (0.18 / h + resonance) / Math.sqrt(h)]);
  }
  const scale = harmonics.reduce((sum, part) => sum + part[1], 0) || 1;
  // A band-limited vowel cycle avoids evaluating every harmonic on every sample.
  const wave = new Float32Array(1024);
  for (let sample = 0; sample < wave.length; sample++) {
    for (const [harmonic, level] of harmonics)
      wave[sample] += (Math.sin((tau * sample * harmonic) / wave.length) * level) / scale;
  }
  add(at, duration, (t, length) => {
    const envelope =
      Math.sin(Math.PI * Math.min(1, t / length)) ** 0.7 *
      Math.min(1, t / 0.25) *
      Math.min(1, (length - t) / 0.4);
    const position = ((fundamental * t + 0.025 * Math.sin(tau * 5 * t)) % 1) * wave.length;
    const index = Math.floor(position),
      fraction = position - index;
    const voice = wave[index] * (1 - fraction) + wave[(index + 1) % wave.length] * fraction;
    return (voice + noise() * 0.012) * envelope * volume;
  });
}
export function darkPulse(tools, midi, at, duration, volume) {
  const { add, tau } = tools,
    frequency = 440 * 2 ** ((midi - 69) / 12);
  add(at, duration, (t, length) => {
    const phase = tau * frequency * t + 0.3 * Math.sin(tau * frequency * 0.5 * t);
    const raw = Math.sin(phase) + 0.35 * Math.sin(phase * 2) + 0.16 * Math.sin(phase * 5);
    const envelope = Math.min(1, t / 0.008) * Math.min(1, (length - t) / 0.06) * Math.exp(-t * 5);
    return Math.tanh(raw * 2.4) * envelope * volume;
  });
}
