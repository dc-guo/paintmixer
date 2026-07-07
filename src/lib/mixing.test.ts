import assert from 'node:assert/strict';
import test from 'node:test';
import { liquitexBasics } from '../data/liquitexBasics.js';
import { getSaturation } from './color.js';
import { linearToSrgb, rgbToLab, srgbToLinear } from './deltaE.js';
import { ksToLinear, linearToKS } from './mixing.js';
import { estimateMix, suggestMixes } from './recipeEngine.js';
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
  for (const linear of [0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.98]) {
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
