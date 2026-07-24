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

import { nudgeLine, swatchVerdict } from './swatchCheck.js';
import type { MixRecipe } from '../types/paint';

function recipeWith(names: string[]): MixRecipe {
  return {
    targetHex: '#000000',
    ingredients: names.map((paintName, i) => ({ paintId: `p${i}`, paintName, parts: 1 })),
    estimatedHex: '#000000',
    deltaE: 0,
    confidence: 'high',
    notes: [],
  };
}

test('swatchVerdict maps corrected-vs-target distance to close/fair/far', () => {
  assert.equal(swatchVerdict({ r: 100, g: 120, b: 140 }, { r: 100, g: 120, b: 140 }), 'close');
  // A large, obvious difference is far.
  assert.equal(swatchVerdict({ r: 20, g: 20, b: 20 }, { r: 240, g: 240, b: 240 }), 'far');
});

test('nudgeLine returns null when there is no recipe', () => {
  assert.equal(nudgeLine({ r: 200, g: 200, b: 200 }, { r: 100, g: 100, b: 100 }, null), null);
});

test('nudgeLine: swatch lighter than target, recipe has white → ease off the white', () => {
  const line = nudgeLine({ r: 210, g: 210, b: 210 }, { r: 120, g: 120, b: 120 }, recipeWith(['Titanium White', 'Mars Black']));
  assert.equal(line, 'Your swatch is lighter than the target — ease off the white.');
});

test('nudgeLine: swatch lighter, recipe has no white → add the darkest paint', () => {
  const line = nudgeLine({ r: 210, g: 210, b: 210 }, { r: 120, g: 120, b: 120 }, recipeWith(['Primary Blue', 'Primary Yellow']));
  assert.equal(line, 'Your swatch is lighter than the target — add a touch of the darkest paint.');
});

test('nudgeLine: swatch darker than target, recipe has white → add a little white', () => {
  const line = nudgeLine({ r: 120, g: 120, b: 120 }, { r: 210, g: 210, b: 210 }, recipeWith(['Titanium White', 'Mars Black']));
  assert.equal(line, 'Your swatch is darker than the target — add a little white.');
});

test('nudgeLine: hue gap dominant → plain-words direction toward the target', () => {
  // Same lightness, but the target is bluer than the swatch.
  const line = nudgeLine({ r: 150, g: 150, b: 120 }, { r: 150, g: 150, b: 210 }, recipeWith(['Titanium White']));
  assert.equal(line, 'A touch more blue would help.');
});

test('nudgeLine: already close → encouragement, no change', () => {
  const line = nudgeLine({ r: 150, g: 150, b: 150 }, { r: 150, g: 150, b: 150 }, recipeWith(['Titanium White']));
  assert.equal(line, 'Right in the neighborhood — paint a larger swatch and check in daylight.');
});
