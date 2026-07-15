import assert from 'node:assert/strict';
import test from 'node:test';
import type { Paint, PaintOpacity } from '../types/paint.js';
import { hexToRgb } from './color.js';
import { buildRecipe, suggestMixes } from './recipeEngine.js';

function paint(id: string, name: string, hex: string, opacity?: PaintOpacity): Paint {
  return {
    id,
    name,
    brand: 'Liquitex BASICS',
    hex,
    rgb: hexToRgb(hex) ?? { r: 0, g: 0, b: 0 },
    opacity,
  };
}

const white = paint('titanium-white', 'Titanium White', '#F4F4F0', 'opaque');
const black = paint('mars-black', 'Mars Black', '#222222', 'opaque');
const red = paint('primary-red', 'Primary Red', '#D22630', 'semi-transparent');
const blue = paint('primary-blue', 'Primary Blue', '#0069B1', 'semi-transparent');
const yellow = paint('primary-yellow', 'Primary Yellow', '#FFD200', 'semi-opaque');
// A genuinely pale pigment, mirroring the dataset's Rose Pink. Strong primaries
// dominate a mix even at 12:1 white, so a hue-preserving pale tint has to come
// from a pale pigment — as it does in the real palette. Used by the pale-tint
// test so it exercises real behavior rather than an unreachable target.
const pink = paint('rose-pink', 'Rose Pink', '#ED96AC', 'opaque');

function paintWithNotes(
  id: string,
  name: string,
  hex: string,
  opacity: PaintOpacity,
  pigmentNotes: string,
): Paint {
  return { ...paint(id, name, hex, opacity), pigmentNotes };
}

const iridescentWhite = paintWithNotes(
  'iridescent-white',
  'Iridescent White',
  '#EEEEE8',
  'semi-opaque',
  'iridescent — sheen not representable on screen',
);

test('suggestMixes returns nothing without owned paints', () => {
  assert.deepEqual(suggestMixes({ r: 128, g: 128, b: 128 }, []), []);
});

test('suggestMixes prefers a single paint when it matches exactly', () => {
  const recipes = suggestMixes(white.rgb, [white, black, red], 3);

  assert.equal(recipes[0].ingredients.length, 1);
  assert.equal(recipes[0].ingredients[0].paintId, 'titanium-white');
  assert.equal(recipes[0].deltaE, 0);
  assert.equal(recipes[0].confidence, 'high');
  assert.ok(recipes[0].notes.includes('Straight from the tube.'));
  assert.ok(
    !recipes[0].notes.includes('Fold in the white gradually.'),
    'no fold-in-white advice when white is the entire recipe',
  );
});

test('suggestMixes explains when the target is out of reach of the paints', () => {
  // Pure screen white is lighter than Titanium White paint (#F4F4F0).
  const target = hexToRgb('#FFFFFF');
  assert.ok(target);
  const recipes = suggestMixes(target, [white, black], 1);

  assert.equal(recipes[0].ingredients[0].paintId, 'titanium-white');
  assert.ok(
    recipes[0].notes.includes('The target is lighter than this mix will likely reach.'),
    `expected a lightness note, got: ${recipes[0].notes.join(' / ')}`,
  );
});

test('suggestMixes mixes white and black toward a reachable gray', () => {
  // Kubelka-Munk mixing lets black dominate (as real paint does), so light
  // grays are out of reach at 6:1 — a darker gray is the realistic ask.
  const target = hexToRgb('#5E5E5E');
  assert.ok(target);
  const recipes = suggestMixes(target, [white, black], 3);
  const best = recipes[0];
  const ids = best.ingredients.map((ingredient) => ingredient.paintId);

  assert.ok(ids.includes('titanium-white'), 'gray mix uses white');
  assert.ok(ids.includes('mars-black'), 'gray mix uses black');
  assert.ok(best.deltaE < 10, `expected a workable gray, got deltaE ${best.deltaE}`);
});

test('suggestMixes keeps recipes simple and measurable', () => {
  const target = hexToRgb('#7A6A4F');
  assert.ok(target);
  const recipes = suggestMixes(target, [white, black, red, blue, yellow], 3);

  assert.ok(recipes.length > 0);

  for (const recipe of recipes) {
    assert.ok(recipe.ingredients.length <= 3, 'at most three ingredients');

    for (const ingredient of recipe.ingredients) {
      assert.ok(ingredient.parts >= 1 && ingredient.parts <= 12, 'parts stay within 1–12');
    }
  }
});

test('buildRecipe recomputes estimate, confidence, and notes for adjusted parts', () => {
  const target = hexToRgb('#5E5E5E');
  assert.ok(target);
  const even = buildRecipe(target, [
    { paint: white, parts: 1 },
    { paint: black, parts: 1 },
  ]);
  const whiter = buildRecipe(target, [
    { paint: white, parts: 12 },
    { paint: black, parts: 1 },
  ]);

  assert.equal(even.targetHex, '#5E5E5E');
  assert.notEqual(even.estimatedHex, whiter.estimatedHex, 'ratio change moves the estimate');

  const evenRgb = hexToRgb(even.estimatedHex);
  const whiterRgb = hexToRgb(whiter.estimatedHex);
  assert.ok(evenRgb && whiterRgb);
  assert.ok(whiterRgb.r > evenRgb.r, 'more white lightens the estimate');

  // Concrete pins (measured against the current K-M model): the ratio change
  // must recompute BOTH confidence and notes. At 1:1 the mix is far too dark
  // for #5E5E5E (out of reach, low); at 12:1 it lands close (high). Each ratio
  // carries the matching lightness note. These are specific enough to fail if
  // buildRecipe stops recomputing confidence or notes.
  assert.equal(even.confidence, 'low');
  assert.equal(whiter.confidence, 'high');
  assert.ok(
    even.notes.includes('The target is lighter than this mix will likely reach.'),
    `expected the "lighter than" note on the 1:1 mix, got: ${even.notes.join(' / ')}`,
  );
  assert.ok(
    whiter.notes.includes('The target is darker than this mix will likely reach.'),
    `expected the "darker than" note on the 12:1 mix, got: ${whiter.notes.join(' / ')}`,
  );
});

test('pale tints are never answered with plain white', () => {
  // A pink target must carry its hue even when the exact lightness is out
  // of reach — recommending white alone would be a lie. The winner here is a
  // hue-preserving 12:1 white:rose-pink tint, not plain titanium white.
  const target = hexToRgb('#F0D8D8');
  assert.ok(target);
  const recipes = suggestMixes(target, [white, black, red, blue, yellow, pink], 3);
  const best = recipes[0];

  assert.ok(
    best.ingredients.some(
      (ingredient) => !['titanium-white', 'mars-black'].includes(ingredient.paintId),
    ),
    `recipe should include a chromatic paint, got: ${best.ingredients
      .map((ingredient) => ingredient.paintId)
      .join(', ')}`,
  );
});

test('a recipe including an iridescent/metallic/fluorescent paint carries the sheen caveat', () => {
  const target = hexToRgb('#F0D8D8');
  assert.ok(target);
  const recipe = buildRecipe(target, [
    { paint: iridescentWhite, parts: 12 },
    { paint: pink, parts: 1 },
  ]);

  assert.ok(
    recipe.notes.includes(
      'Iridescent, metallic, or fluorescent paint — the sheen or glow will not match a flat color.',
    ),
    `expected the sheen caveat, got: ${recipe.notes.join(' / ')}`,
  );
});

test('a recipe with no iridescent/metallic/fluorescent paint has no sheen caveat', () => {
  const target = hexToRgb('#F0D8D8');
  assert.ok(target);
  const recipe = buildRecipe(target, [
    { paint: white, parts: 12 },
    { paint: pink, parts: 1 },
  ]);

  assert.ok(
    !recipe.notes.some((note) => note.includes('sheen or glow')),
    `expected no sheen caveat, got: ${recipe.notes.join(' / ')}`,
  );
});

test('suggestMixes returns distinct paint sets, best first', () => {
  const target = hexToRgb('#8A4A33');
  assert.ok(target);
  const recipes = suggestMixes(target, [white, black, red, blue, yellow], 3);
  const setKeys = recipes.map((recipe) =>
    recipe.ingredients
      .map((ingredient) => ingredient.paintId)
      .sort()
      .join('|'),
  );

  assert.equal(new Set(setKeys).size, setKeys.length, 'no duplicate paint sets');

  for (let i = 1; i < recipes.length; i += 1) {
    assert.ok(
      recipes[i].deltaE + 1.2 * recipes[i].ingredients.length >=
        recipes[0].deltaE + 1.2 * recipes[0].ingredients.length - 0.01,
      'first recipe has the best score',
    );
  }
});
