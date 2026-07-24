import assert from 'node:assert/strict';
import test from 'node:test';
import { averagePatch, correctForPaper } from './swatchCheck.js';

// A 3x3 RGBA image: center pixel white, others black.
function grid3x3(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(3 * 3 * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * 3 + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  };
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      set(x, y, 0, 0, 0);
    }
  }
  set(1, 1, 255, 255, 255);
  return px;
}

test('averagePatch averages a patch, clamped to image bounds', () => {
  const px = grid3x3();
  // 3x3 patch over the whole image: one white pixel among nine → 255/9 ≈ 28.
  assert.deepEqual(averagePatch(px, 3, 3, 1, 1, 3), { r: 28, g: 28, b: 28 });
  // 1x1 patch on the white center.
  assert.deepEqual(averagePatch(px, 3, 3, 1, 1, 1), { r: 255, g: 255, b: 255 });
  // Patch centered at a corner still clamps (does not read out of bounds).
  const corner = averagePatch(px, 3, 3, 0, 0, 3);
  assert.ok(corner.r >= 0 && corner.r <= 255);
});

test('correctForPaper neutralizes a warm cast using the paper reference', () => {
  // A warm light makes neutral paper read warm (high R, low B) and tints the
  // swatch the same way. Correcting against the paper should pull the swatch
  // back toward its true neutral-gray self. The paper stays under the
  // too-saturated guard (linear (max-min)/max < 0.25) so it is accepted.
  const paper = { r: 245, g: 240, b: 225 }; // gently warm-tinted "white" paper
  const swatch = { r: 150, g: 140, b: 110 }; // a mid-gray under the same warm light
  const result = correctForPaper(swatch, paper);
  assert.ok(result.ok);
  if (result.ok) {
    // Removing a warm cast lifts blue and lifts it more than red.
    assert.ok(result.corrected.b > swatch.b, 'blue should be lifted');
    assert.ok(
      result.corrected.b - swatch.b > result.corrected.r - swatch.r,
      'blue should be lifted more than red',
    );
    const spread = Math.max(result.corrected.r, result.corrected.g, result.corrected.b) -
      Math.min(result.corrected.r, result.corrected.g, result.corrected.b);
    assert.ok(spread < 50, `corrected gray should read closer to neutral, spread was ${spread}`);
  }
});

test('correctForPaper is near-identity when the paper already reads neutral white', () => {
  const paper = { r: 246, g: 246, b: 243 }; // == reference white
  const swatch = { r: 120, g: 90, b: 60 };
  const result = correctForPaper(swatch, paper);
  assert.ok(result.ok);
  if (result.ok) {
    assert.ok(Math.abs(result.corrected.r - swatch.r) <= 3);
    assert.ok(Math.abs(result.corrected.g - swatch.g) <= 3);
    assert.ok(Math.abs(result.corrected.b - swatch.b) <= 3);
  }
});

test('correctForPaper rejects paper that is too dark', () => {
  const result = correctForPaper({ r: 100, g: 100, b: 100 }, { r: 60, g: 60, b: 60 });
  assert.deepEqual(result, { ok: false, reason: 'too-dark' });
});

test('correctForPaper rejects paper that is too saturated (a colored wall)', () => {
  const result = correctForPaper({ r: 100, g: 100, b: 100 }, { r: 220, g: 120, b: 90 });
  assert.deepEqual(result, { ok: false, reason: 'too-saturated' });
});
