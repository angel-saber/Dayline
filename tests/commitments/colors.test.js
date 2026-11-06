import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITIES } from '../../dist/js/personalities/index.js';
import { commitmentColors } from '../../dist/js/features/commitments/colors.js';
function luminance(hex) {
  const values = hex
    .slice(1)
    .match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test('every personality owns a coordinated repeating palette with readable pending/completed text', () => {
  const sequences = [];
  for (const [mode, profile] of Object.entries(PERSONALITIES)) {
    assert.equal(profile.commitmentPalette.cards.length, 6);
    sequences.push(JSON.stringify(profile.commitmentPalette));
    for (let i = 0; i < 6; i++) {
      const color = commitmentColors(i, mode);
      assert.deepEqual(color, commitmentColors(i + 6, mode));
      assert.ok(contrast(color.background, color.ink) >= 4.5, mode + ' text contrast');
      assert.ok(
        contrast(color.completedBackground, color.completedInk) >= 4.5,
        mode + ' completed contrast',
      );
    }
  }
  assert.equal(new Set(sequences).size, 6);
  assert.deepEqual(commitmentColors(0, 'unknown'), commitmentColors(0, 'zen'));
});
