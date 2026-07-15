import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampPaletteSize,
  parsePaletteSize,
  sanitizeSavedPalettes,
  DEFAULT_PALETTE_SIZE,
  MIN_PALETTE_SIZE,
  MAX_PALETTE_SIZE,
} from './storage.js';

function palette(colors: unknown[]) {
  return { id: 'p1', name: 'Test palette', createdAt: '2026-01-01T00:00:00.000Z', colors };
}

const validRecipe = {
  targetHex: '#AA3355',
  ingredients: [{ paintId: 'mars-black', paintName: 'Mars Black', parts: 1 }],
  estimatedHex: '#AA3355',
  deltaE: 0.5,
  confidence: 'high',
  notes: [],
};

test('clampPaletteSize rounds then clamps into [MIN, MAX]', () => {
  assert.equal(clampPaletteSize(1), MIN_PALETTE_SIZE);
  assert.equal(clampPaletteSize(99), MAX_PALETTE_SIZE);
  assert.equal(clampPaletteSize(4.6), 5);
  assert.equal(clampPaletteSize(5), 5);
});

test('clampPaletteSize falls back to the default for non-finite input', () => {
  assert.equal(clampPaletteSize(Number.NaN), DEFAULT_PALETTE_SIZE);
  assert.equal(clampPaletteSize(Number.POSITIVE_INFINITY), DEFAULT_PALETTE_SIZE);
});

test('parsePaletteSize returns the default for missing or garbage values', () => {
  assert.equal(parsePaletteSize(null), DEFAULT_PALETTE_SIZE);
  assert.equal(parsePaletteSize('not-a-number'), DEFAULT_PALETTE_SIZE);
  assert.equal(parsePaletteSize('   '), DEFAULT_PALETTE_SIZE);
});

test('parsePaletteSize clamps in-range and out-of-range stored numbers', () => {
  assert.equal(parsePaletteSize('6'), 6);
  assert.equal(parsePaletteSize('12'), MAX_PALETTE_SIZE);
  assert.equal(parsePaletteSize('2'), MIN_PALETTE_SIZE);
});

test('sanitizeSavedPalettes keeps a fully valid color untouched', () => {
  const color = {
    id: 'c1',
    hex: '#AA3355',
    source: 'manual',
    label: 'Sky',
    position: { x: 0.2, y: 0.4 },
    preferredRecipe: validRecipe,
  };

  const [result] = sanitizeSavedPalettes([palette([color])]);
  assert.deepEqual(result.colors, [color]);
});

test('sanitizeSavedPalettes strips a malformed preferredRecipe but keeps the color', () => {
  const color = {
    id: 'c1',
    hex: '#AA3355',
    source: 'manual',
    preferredRecipe: {}, // missing ingredients and every other required field
  };

  const [result] = sanitizeSavedPalettes([palette([color])]);
  assert.equal(result.colors.length, 1);
  assert.equal(result.colors[0].id, 'c1');
  assert.equal('preferredRecipe' in result.colors[0], false);
});

test('sanitizeSavedPalettes strips a preferredRecipe with malformed ingredients', () => {
  const color = {
    id: 'c1',
    hex: '#AA3355',
    source: 'manual',
    preferredRecipe: { ...validRecipe, ingredients: [{ paintId: 'x' }] },
  };

  const [result] = sanitizeSavedPalettes([palette([color])]);
  assert.equal('preferredRecipe' in result.colors[0], false);
});

test('sanitizeSavedPalettes drops an invalid color but keeps the rest of the palette', () => {
  const good = { id: 'c1', hex: '#AA3355', source: 'manual' };
  const badSource = { id: 'c2', hex: '#112233', source: 'nonsense' };
  const noHex = { id: 'c3', source: 'auto' };

  const [result] = sanitizeSavedPalettes([palette([good, badSource, noHex])]);
  assert.deepEqual(
    result.colors.map((c) => c.id),
    ['c1'],
  );
});

test('sanitizeSavedPalettes drops a non-string label but keeps the color', () => {
  const color = { id: 'c1', hex: '#AA3355', source: 'manual', label: { nope: true } };
  const [result] = sanitizeSavedPalettes([palette([color])]);
  assert.equal('label' in result.colors[0], false);
  assert.equal(result.colors[0].id, 'c1');
});

test('sanitizeSavedPalettes drops a malformed position but keeps the color', () => {
  const color = { id: 'c1', hex: '#AA3355', source: 'manual', position: { x: 'nope' } };
  const [result] = sanitizeSavedPalettes([palette([color])]);
  assert.equal('position' in result.colors[0], false);
});

test('sanitizeSavedPalettes rejects malformed top-level input', () => {
  assert.deepEqual(sanitizeSavedPalettes(null), []);
  assert.deepEqual(sanitizeSavedPalettes('not-an-array'), []);
  assert.deepEqual(sanitizeSavedPalettes([{ id: 'p1' }]), []); // missing name/createdAt/colors
});
