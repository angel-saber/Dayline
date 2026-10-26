import { oceanLayer, vowelPhrase, darkPulse } from './soundscape.js?v=99c68c40b4e2';
import { scoreTools } from '../score-tools.js?v=99c68c40b4e2';
// Undertow: original oceanic electronica with wordless synthesized vocal refrains.
export function renderScore(data, rate) {
  if (!data.length || rate <= 0) return;
  const tools = scoreTools(data, rate);
  const { add, tau, noise, normalize } = tools,
    beat = 60 / 122;
  oceanLayer(data, rate, tools);
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
  const roots = [40, 36, 43, 38, 40, 36, 43, 38];
  const chords = [
    [52, 59, 66, 67],
    [48, 55, 59, 64],
    [55, 62, 66, 69],
    [50, 57, 64, 66],
  ];
  const motifs = [
    [76, 71, 74, 78, 74, 71],
    [76, 79, 74, 71, 72, 76],
    [79, 78, 74, 71, 74, 78],
    [78, 76, 74, 69, 74, 76],
  ];
  const energy = [0.4, 0.55, 0.7, 0.85, 1, 0.92, 0.72, 0.46];
  function pad(midi, at, length, volume) {
    const f = hz(midi);
    add(at, length, (t, duration) => {
      const envelope = Math.min(1, t / 2.2) * Math.min(1, (duration - t) / 3);
      const breath = 0.82 + 0.18 * Math.sin((tau * t) / (8 * beat));
      const phase = tau * f * t;
      return (
        (Math.sin(phase) + 0.32 * Math.sin(phase * 1.003) + 0.12 * Math.sin(phase * 2)) *
        envelope *
        breath *
        volume
      );
    });
  }
  function pluck(midi, at, volume, length = 1.6) {
    const f = hz(midi);
    add(at, length, (t, duration) => {
      const phase = tau * f * t,
        envelope = Math.min(1, t / 0.018) * Math.min(1, (duration - t) / 0.18) * Math.exp(-t * 3.2);
      const brightness = 0.3 * Math.exp(-t * 5);
      return (
        (Math.sin(phase) +
          brightness * Math.sin(phase * 2) +
          brightness * 0.35 * Math.sin(phase * 3)) *
        envelope *
        volume
      );
    });
  }
  function bass(midi, at, length, volume) {
    const f = hz(midi);
    add(at, length, (t, duration) => {
      const envelope = Math.min(1, t / 0.025) * Math.min(1, (duration - t) / 0.08);
      return (Math.sin(tau * f * t) + 0.16 * Math.sin(tau * f * 2 * t)) * envelope * volume;
    });
  }
  function kick(at, volume) {
    add(
      at,
      0.32,
      (t) =>
        Math.sin(tau * (43 * t + (42 * (1 - Math.exp(-t * 32))) / 32)) *
        Math.min(1, t / 0.004) *
        Math.exp(-t * 18) *
        volume,
    );
  }
  function snare(at, volume) {
    add(
      at,
      0.16,
      (t) =>
        (noise() * 0.65 + Math.sin(tau * 185 * t) * 0.35) *
        Math.min(1, t / 0.003) *
        Math.exp(-t * 29) *
        volume,
    );
  }
  for (let section = 0; section < 8; section++) {
    const start = section * 32 * beat,
      level = energy[section],
      chord = chords[section % 4];
    chord.forEach((note, index) => pad(note, start + index * 0.12, 35 * beat, 0.028 * level));
    for (let bar = 0; bar < 8; bar++) {
      const at = start + bar * 4 * beat;
      // A restrained broken rhythm supplies forward motion without a club-style drop.
      if (section > 0 && section < 7) {
        for (const offset of [0, 1.75, 2.5]) kick(at + offset * beat, 0.13 * level);
        for (const offset of [1, 3]) snare(at + offset * beat, 0.045 * level);
        for (const offset of [0.5, 1.5, 2.25, 2.75, 3.5])
          add(at + offset * beat, 0.045, (t) => noise() * Math.exp(-t * 100) * 0.013 * level);
      } else if (bar % 2 === 0) kick(at, 0.035);
      for (const offset of [0.5, 1.5, 2.75])
        bass(roots[section], at + offset * beat, 0.7 * beat, 0.065 * level);
      if (section > 1 && section < 7) {
        for (let step = 0; step < 4; step++) {
          const note = chord[(bar + step) % 4] + 12;
          pluck(note, at + (step + 0.5) * beat, 0.018 * level, 0.9);
        }
      }
    }
    if (section > 0 && section < 7) {
      for (let pulse = 0; pulse < 16; pulse++) {
        darkPulse(
          tools,
          roots[section] - 12,
          start + (pulse * 2 + 0.75) * beat,
          0.8 * beat,
          0.045 * level,
        );
      }
      for (let refrain = 0; refrain < 2; refrain++) {
        for (const [index, offset] of [2, 7, 12].entries()) {
          const note = [64, 62, 59][index] + (section % 4 === 2 ? 3 : section % 4 === 3 ? -2 : 0);
          const at = start + (refrain * 16 + offset) * beat;
          vowelPhrase(
            tools,
            rate,
            note,
            at,
            (index === 1 ? 4 : 3) * beat,
            0.07 * level,
            ['ah', 'oh', 'mm'][index],
          );
          if (index === 1)
            vowelPhrase(tools, rate, note, at + 2 * beat, 3 * beat, 0.018 * level, 'oh');
        }
      }
    }
    for (let phrase = 0; phrase < 2; phrase++) {
      const offsets = [0, 2.5, 4, 7, 10.5, 13];
      motifs[section % 4].forEach((note, index) => {
        const at = start + (phrase * 16 + offsets[index]) * beat;
        pluck(note, at, 0.055 * level, 2.4);
        pluck(note, at + 0.75 * beat, 0.018 * level, 2);
        pluck(note, at + 1.5 * beat, 0.006 * level, 1.6);
      });
    }
    // A slow wordless harmonic bloom, held over the middle passage.
    if (section === 3 || section === 4) {
      pad(chord[2] + 12, start + 8 * beat, 26 * beat, 0.025 * level);
      pad(chord[3] + 12, start + 12 * beat, 22 * beat, 0.02 * level);
    }
  }
  normalize();
}
