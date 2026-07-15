import assert from 'node:assert/strict';
import test from 'node:test';
import { liquitexBasics } from '../data/liquitexBasics.js';
import { getSaturation, hexToRgb, rgbToHex } from './color.js';
import { labDistance, linearToSrgb, rgbToLab, srgbToLinear } from './deltaE.js';
import { ksToLinear, linearToKS } from './mixing.js';
import { buildRecipe, estimateMix, suggestMixes } from './recipeEngine.js';
import type { Paint } from '../types/paint.js';
import type { RGB } from '../types/color.js';

function paint(id: string): Paint {
  const found = liquitexBasics.find((entry) => entry.id === id);
  assert.ok(found, `dataset has ${id}`);
  return found;
}

/** Plain parts-weighted average in linear RGB (the old estimator), for contrast. */
function linearAverage(entries: Array<{ paint: Paint; parts: number }>): RGB {
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (const { paint: p, parts } of entries) {
    total += parts;
    r += srgbToLinear(p.rgb.r) * parts;
    g += srgbToLinear(p.rgb.g) * parts;
    b += srgbToLinear(p.rgb.b) * parts;
  }

  return { r: linearToSrgb(r / total), g: linearToSrgb(g / total), b: linearToSrgb(b / total) };
}

test('K/S conversion round-trips within the clamps', () => {
  for (const linear of [0.07, 0.1, 0.3, 0.5, 0.7, 0.9, 0.98]) {
    const roundTripped = ksToLinear(linearToKS(linear));
    assert.ok(Math.abs(roundTripped - linear) < 1e-9, `round-trip at ${linear}`);
  }
});

test('estimateMix returns a single paint unchanged', () => {
  const white = paint('titanium-white');
  assert.deepEqual(estimateMix([{ paint: white, parts: 3 }]), white.rgb);
});

test('blue + yellow mixes green, not gray', () => {
  const ingredients = [
    { paint: paint('primary-blue'), parts: 1 },
    { paint: paint('primary-yellow'), parts: 1 },
  ];
  const km = estimateMix(ingredients);
  const linear = linearAverage(ingredients);

  const greenness = (rgb: RGB) => rgb.g - (rgb.r + rgb.b) / 2;
  assert.ok(
    greenness(km) > greenness(linear) + 20,
    `K-M mix (${JSON.stringify(km)}) should be far greener than the linear average (${JSON.stringify(linear)})`,
  );
  assert.ok(getSaturation(km) > 0.15, 'the mix keeps real chroma instead of going gray');
});

test('complementary mixes desaturate', () => {
  const red = paint('pyrrole-red');
  const green = paint('green-deep-permanent');
  const mix = estimateMix([
    { paint: red, parts: 1 },
    { paint: green, parts: 1 },
  ]);

  assert.ok(getSaturation(mix) < getSaturation(red.rgb));
  assert.ok(getSaturation(mix) < getSaturation(green.rgb));
});

test('adding white raises lightness', () => {
  const green = paint('phthalocyanine-green');
  const mix = estimateMix([
    { paint: green, parts: 1 },
    { paint: paint('titanium-white'), parts: 1 },
  ]);

  assert.ok(rgbToLab(mix).l > rgbToLab(green.rgb).l + 2);
});

test('black dominates white far beyond its parts', () => {
  const ingredients = [
    { paint: paint('titanium-white'), parts: 6 },
    { paint: paint('mars-black'), parts: 1 },
  ];
  const km = estimateMix(ingredients);
  const linear = linearAverage(ingredients);

  assert.ok(
    rgbToLab(km).l < rgbToLab(linear).l - 10,
    '1 part black in 6 parts white lands notably darker than the parts-weighted average',
  );
});

test('an all-semi-transparent mix also warns about glazing', () => {
  // Primary Red and Primary Blue are both rated semi-transparent; a mix of
  // nothing but semi-transparents behaves like a glaze too.
  const red = paint('primary-red');
  const blue = paint('primary-blue');
  const target = estimateMix([
    { paint: red, parts: 3 },
    { paint: blue, parts: 1 },
  ]);
  const recipes = suggestMixes(target, [red, blue], 1);

  assert.ok(recipes.length > 0);
  assert.ok(
    recipes[0].notes.some((note) => note.includes('glaze')),
    `expected a glaze note, got: ${recipes[0].notes.join(' / ')}`,
  );
});

test('mostly-transparent mixes get a glaze note', () => {
  const dioxazine = paint('dioxazine-purple');
  const magenta = paint('quinacridone-magenta');
  const target = estimateMix([
    { paint: dioxazine, parts: 1 },
    { paint: magenta, parts: 1 },
  ]);
  const recipes = suggestMixes(target, [dioxazine, magenta], 1);

  assert.ok(recipes.length > 0);
  assert.equal(recipes[0].ingredients.length, 2, 'best recipe uses both transparents');
  assert.ok(
    recipes[0].notes.some((note) => note.includes('glaze')),
    `expected a glaze note, got: ${recipes[0].notes.join(' / ')}`,
  );
});

test('a 1:1 transparent + opaque tint is not called a whole-mix glaze', () => {
  // Half opaque titanium white — the most opaque paint in the range — covers
  // solidly, so a 1:1 transparent-pigment + white tint is not "mostly
  // transparent". Regression for the old inclusive `>= 0.5` threshold.
  const ingredients = [
    { paint: paint('dioxazine-purple'), parts: 1 },
    { paint: paint('titanium-white'), parts: 1 },
  ];
  const recipe = buildRecipe(estimateMix(ingredients), ingredients);

  assert.ok(
    !recipe.notes.some((note) => note.includes('Mostly transparent')),
    `1 dioxazine + 1 white should not get the whole-mix glaze note, got: ${recipe.notes.join(' / ')}`,
  );
  assert.ok(
    recipe.notes.some((note) => note.includes('transparent — expect shifts when layering')),
    `expected the per-paint transparency note instead, got: ${recipe.notes.join(' / ')}`,
  );
});

test('dark mixes estimate as dark as their ingredients (no mid-gray floor)', () => {
  // Regression for MIN_REFLECTANCE=0.06, which capped every multi-paint
  // estimate at ~#454545 (L 29.3) — lighter than real blacks — and froze the
  // ratio steppers. The lowered floor lets dark mixes stay dark and move.
  const mars = paint('mars-black');
  const ivory = paint('ivory-black');

  const even = estimateMix([
    { paint: mars, parts: 1 },
    { paint: ivory, parts: 1 },
  ]);
  assert.ok(
    rgbToLab(even).l <= 20,
    `a black + black mix must stay genuinely dark, got L ${rgbToLab(even).l.toFixed(1)}`,
  );

  const moreMars = estimateMix([
    { paint: mars, parts: 12 },
    { paint: ivory, parts: 1 },
  ]);
  const moreIvory = estimateMix([
    { paint: mars, parts: 1 },
    { paint: ivory, parts: 12 },
  ]);
  assert.notEqual(
    rgbToHex(moreMars),
    rgbToHex(moreIvory),
    '12:1 and 1:12 must produce different estimates so the steppers do something',
  );
});

test('a reachable near-black target is not falsely warned as too dark', () => {
  // 12:1 black:white trivially reaches #222222; the old floor estimated it as
  // #474747 and stamped a backwards "target is darker than this mix" note.
  const target = hexToRgb('#222222');
  assert.ok(target);
  const recipe = buildRecipe(target, [
    { paint: paint('mars-black'), parts: 12 },
    { paint: paint('titanium-white'), parts: 1 },
  ]);

  assert.ok(recipe.deltaE < 10, `near-black should be reachable, got deltaE ${recipe.deltaE}`);
  assert.ok(
    !recipe.notes.includes('The target is darker than this mix will likely reach.'),
    `should not warn that a reachable near-black is out of reach, got: ${recipe.notes.join(' / ')}`,
  );
});

test('tinting strength pulls a mix toward the stronger tinter', () => {
  // Cloning one paint and varying only its tintingStrength isolates the
  // `parts * tintingStrength` weighting: at equal parts the stronger tinter
  // must sit measurably closer (Lab) to its own color. Deleting the
  // multiplication makes the two clones identical and collapses this margin.
  const base = paint('primary-red');
  const white = paint('titanium-white');
  const weakMix = estimateMix([
    { paint: { ...base, tintingStrength: 1 }, parts: 1 },
    { paint: white, parts: 1 },
  ]);
  const strongMix = estimateMix([
    { paint: { ...base, tintingStrength: 2 }, parts: 1 },
    { paint: white, parts: 1 },
  ]);

  const distWeak = labDistance(rgbToLab(weakMix), rgbToLab(base.rgb));
  const distStrong = labDistance(rgbToLab(strongMix), rgbToLab(base.rgb));

  assert.ok(
    distStrong < distWeak - 1,
    `strength 2 should land measurably closer to the red than strength 1 (strong ${distStrong.toFixed(2)} vs weak ${distWeak.toFixed(2)})`,
  );
});

test('all-zero tinting strengths fall back to an equal-weight mix, not black', () => {
  // A bad data entry (tintingStrength 0 on every ingredient) zeroes the total
  // weight; the guard averages the ingredients equally instead of collapsing
  // the estimate to #000000.
  const red = paint('primary-red');
  const blue = paint('primary-blue');
  const zeroed = estimateMix([
    { paint: { ...red, tintingStrength: 0 }, parts: 1 },
    { paint: { ...blue, tintingStrength: 0 }, parts: 1 },
  ]);
  const equalWeight = estimateMix([
    { paint: { ...red, tintingStrength: 1 }, parts: 1 },
    { paint: { ...blue, tintingStrength: 1 }, parts: 1 },
  ]);

  assert.ok(
    zeroed.r !== 0 || zeroed.g !== 0 || zeroed.b !== 0,
    'a zero-strength mix must not collapse to pure black',
  );
  assert.ok(
    Number.isFinite(zeroed.r) && Number.isFinite(zeroed.g) && Number.isFinite(zeroed.b),
    'a zero-strength mix must stay a finite color',
  );
  assert.deepEqual(zeroed, equalWeight, 'zero strengths are treated as equal weights');
});
