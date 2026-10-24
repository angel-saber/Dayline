// One continuous cyberpunk cue with a shared grid and evolving intensity.
export function renderScore(data, rate) {
  const beat = 60 / 116,
    tau = 2 * Math.PI,
    size = 2048;
  let seed = 90210;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  const smooth = (value) => {
    const x = Math.max(0, Math.min(1, value));
    return x * x * (3 - 2 * x);
  };
  const saw = new Float32Array(size);
  for (let i = 0; i < size; i++)
    for (let h = 1; h <= 8; h++) saw[i] += Math.sin((tau * i * h) / size) / h;
  const sample = (phase) => {
    const at = (((phase % 1) + 1) % 1) * size,
      i = Math.floor(at);
    return saw[i] + (saw[(i + 1) % size] - saw[i]) * (at - i);
  };
  function sound(at, length, fn) {
    const start = Math.round(at * rate),
      count = Math.ceil(length * rate);
    for (let i = 0; i < count; i++) {
      const t = i / rate,
        edge = smooth(t / 0.004) * smooth((length - t) / 0.016);
      data[(start + i) % data.length] += fn(t) * edge;
    }
  }
  function bass(midi, at, volume) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    sound(at, beat * 0.45, (t) => {
      const transient = Math.exp(-t * 11),
        sub = Math.sin(tau * hz * t) * 0.6;
      const body = Math.tanh(sample(hz * t) * 1.8) * (0.4 + 0.3 * transient);
      return (sub + body) * volume * Math.exp(-t * 4.5) * smooth(t / 0.012);
    });
  }
  function sequence(midi, at, volume) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    sound(at, beat * 0.32, (t) => {
      // Short, low-mid synth gates repeat as texture, without a solo melody.
      const envelope = Math.exp(-t * 22);
      return (sample(hz * t) * 0.7 + sample(hz * 1.003 * t + 0.2) * 0.3) * volume * envelope;
    });
  }
  function kick(at, volume) {
    sound(
      at,
      0.34,
      (t) =>
        (Math.sin(tau * (42 * t + 85 * 0.018 * (1 - Math.exp(-t / 0.018)))) * Math.exp(-t * 15) +
          noise() * Math.exp(-t * 210) * 0.04) *
        volume,
    );
  }
  function snare(at, volume) {
    let last = 0;
    sound(at, 0.16, (t) => {
      const n = noise(),
        high = n - last;
      last = n;
      return (
        (high * Math.exp(-t * 32) * 0.6 + Math.sin(tau * 190 * t) * Math.exp(-t * 38) * 0.4) *
        volume
      );
    });
  }
  function tick(at, volume) {
    let last = 0;
    sound(at, 0.04, (t) => {
      const n = noise(),
        high = n - last;
      last = n;
      return high * Math.exp(-t * 130) * volume;
    });
  }
  function drone(midi, at, volume) {
    const hz = 440 * 2 ** ((midi - 69) / 12),
      length = 17 * beat;
    sound(
      at,
      length,
      (t) =>
        (sample(hz * t) + sample(hz * 1.0015 * t + 0.3)) *
        0.5 *
        volume *
        smooth(t / 1.7) *
        smooth((length - t) / 2),
    );
  }
  for (let bar = 0; bar < 32; bar++) {
    const at = bar * 4 * beat,
      root = [28, 28, 24, 26][Math.floor(bar / 8)];
    // A broad rise and fall keeps the loop moving without an abrupt drop or spotlight cue.
    const intensity = 0.45 + 0.55 * Math.sin((Math.PI * (bar + 0.5)) / 32) ** 2;
    for (let step = 0; step < 8; step++)
      bass(
        root + (step === 6 && bar % 4 === 3 ? 12 : 0),
        at + (step * beat) / 2,
        (step % 2 === 0 ? 0.15 : 0.105) * intensity,
      );
    for (let b = 0; b < 4; b++) kick(at + b * beat, 0.22 + 0.07 * intensity);
    snare(at + 2 * beat, 0.065 + 0.035 * intensity);
    const pattern = [12, 19, 12, 24, 12, 19, 15, 19];
    for (let step = 0; step < 8; step++) {
      sequence(root + pattern[step], at + (step * beat) / 2, 0.025 + 0.025 * intensity);
      tick(at + ((step + 0.5) * beat) / 2, 0.011 + 0.009 * intensity);
    }
    // Tiny gated static bursts recur inside the rhythm instead of becoming a separate hook.
    for (const step of bar % 2 ? [5, 11, 14] : [3, 10]) {
      sound(at + (step * beat) / 4, beat * 0.17, (t) => {
        const gate = Math.sin(tau * 75 * t) > 0 ? 1 : 0;
        return noise() * gate * Math.exp(-t * 65) * (0.018 + 0.012 * intensity);
      });
    }
    if (bar % 4 === 0) {
      drone(root + 24, at, 0.013 + 0.008 * intensity);
      drone(root + 31, at, 0.009 + 0.005 * intensity);
    }
    if (bar >= 8 && bar < 24) sequence(root + 24, at + 3.75 * beat, 0.022 * intensity);
  }
  // Dark electronic atmosphere slowly opens above the pulse and subsides before looping.
  sound(0, 128 * beat, (t) => {
    const u = t / (128 * beat),
      swell = Math.sin(Math.PI * u) ** 2;
    return (Math.sin(tau * 164.81 * t) + 0.3 * Math.sin(tau * 246.94 * t)) * swell * 0.016;
  });
  const dry = data.slice();
  for (const [seconds, gain] of [
    [beat * 0.75, 0.075],
    [beat * 1.5, 0.045],
  ]) {
    const delay = Math.round(seconds * rate);
    for (let i = 0; i < data.length; i++) data[(i + delay) % data.length] += dry[i] * gain;
  }
  let peak = 0;
  for (const value of data) peak = Math.max(peak, Math.abs(value));
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= 0.8 / peak;
}
