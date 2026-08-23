import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampPaletteSize,
  parsePaletteSize,
  sanitizeSavedPalettes,
  sanitizePaintSetsState,
  DEFAULT_PALETTE_SIZE,
  MIN_PALETTE_SIZE,
  MAX_PALETTE_SIZE,
} from './storage.js';
import { MY_PAINTS_SET_ID, STARTER_SET_ID } from './paintSets.js';

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

test('sanitizePaintSetsState keeps valid sets, drops junk, re-resolves workingSetId', () => {
  const state = sanitizePaintSetsState({
    sets: [
      { id: 'a', name: 'Good', paintIds: ['titanium-white', 7, 'mars-black'] },
      { id: 8, name: 'bad id', paintIds: [] },
      { id: 'b', name: 'Preset-ish', paintIds: [], isPreset: 'yes' },
    ],
    workingSetId: 'gone',
  });
  assert.ok(state);
  if (state) {
    assert.deepEqual(state.sets.map((set) => set.id), ['a', 'b']);
    assert.deepEqual(state.sets[0].paintIds, ['titanium-white', 'mars-black']); // non-strings dropped
    assert.equal(state.sets[1].isPreset, undefined); // non-boolean-true stripped
    assert.equal(state.workingSetId, 'a'); // dangling -> no my-paints -> first
  }
});

test('sanitizePaintSetsState returns null when nothing valid survives', () => {
  assert.equal(sanitizePaintSetsState({ sets: [], workingSetId: 'x' }), null);
  assert.equal(sanitizePaintSetsState({ sets: 'nope' }), null);
  assert.equal(sanitizePaintSetsState(null), null);
  assert.equal(sanitizePaintSetsState([1, 2, 3]), null);
});

test('sanitizePaintSetsState keeps isPreset only when literally true', () => {
  const state = sanitizePaintSetsState({
    sets: [{ id: STARTER_SET_ID, name: 'Starter', paintIds: [], isPreset: true }],
    workingSetId: STARTER_SET_ID,
  });
  assert.ok(state);
  if (state) {
    assert.equal(state.sets[0].isPreset, true);
  }
});

test('sanitizeSavedPalettes passes a string paintSetId through and drops other types', () => {
  const palettes = sanitizeSavedPalettes([
    { id: 'p1', name: 'A', createdAt: 'now', colors: [], paintSetId: MY_PAINTS_SET_ID },
    { id: 'p2', name: 'B', createdAt: 'now', colors: [], paintSetId: 42 },
    { id: 'p3', name: 'C', createdAt: 'now', colors: [] },
  ]);
  assert.equal(palettes[0].paintSetId, MY_PAINTS_SET_ID);
  assert.equal(palettes[1].paintSetId, undefined);
  assert.equal(palettes[2].paintSetId, undefined);
});
