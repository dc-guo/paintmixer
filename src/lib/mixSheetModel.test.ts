import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSheetModel, formatMixLine } from './mixSheetModel.js';
import type { SavedPalette } from '../types/palette';
import type { MixRecipe } from '../types/paint';

const recipe: MixRecipe = {
  targetHex: '#89C5F4',
  ingredients: [
    { paintId: 'titanium-white', paintName: 'Titanium White', parts: 4 },
    { paintId: 'phthalocyanine-blue', paintName: 'Phthalocyanine Blue', parts: 1 },
  ],
  estimatedHex: '#8AC4F2',
  deltaE: 1.2,
  confidence: 'high',
  notes: [],
};

const palette: SavedPalette = {
  id: 'p1',
  name: 'Harbor at dusk',
  createdAt: '2026-07-23T00:00:00.000Z',
  colors: [
    { id: 'c1', hex: '#89C5F4', source: 'auto', label: 'Sky', notes: 'wash first' },
    { id: 'c2', hex: '#222222', source: 'manual' },
  ],
  artwork: { thumbnailDataUrl: 'data:image/jpeg;base64,xyz', name: 'harbor.png' },
};

test('buildSheetModel carries name, artwork, labels, notes, and resolved mixes', () => {
  const model = buildSheetModel(palette, [
    { color: palette.colors[0], recipe },
    { color: palette.colors[1], recipe: null },
  ]);

  assert.equal(model.name, 'Harbor at dusk');
  assert.equal(model.artworkDataUrl, 'data:image/jpeg;base64,xyz');
  assert.equal(model.colors.length, 2);
  assert.deepEqual(model.colors[0], {
    hex: '#89C5F4',
    label: 'Sky',
    notes: 'wash first',
    mix: [
      { paintName: 'Titanium White', parts: 4 },
      { paintName: 'Phthalocyanine Blue', parts: 1 },
    ],
  });
  assert.deepEqual(model.colors[1], { hex: '#222222', mix: [] });
});

test('buildSheetModel sorts mix lines largest-part first', () => {
  const reversed: MixRecipe = {
    ...recipe,
    ingredients: [
      { paintId: 'mars-black', paintName: 'Mars Black', parts: 1 },
      { paintId: 'titanium-white', paintName: 'Titanium White', parts: 6 },
    ],
  };
  const model = buildSheetModel(palette, [{ color: palette.colors[0], recipe: reversed }]);
  assert.deepEqual(
    model.colors[0].mix.map((line) => line.parts),
    [6, 1],
  );
});

test('buildSheetModel maps a missing artwork to null', () => {
  const bare: SavedPalette = { ...palette, artwork: undefined };
  assert.equal(buildSheetModel(bare, []).artworkDataUrl, null);
});

test('formatMixLine joins parts and names with a middle dot', () => {
  assert.equal(
    formatMixLine([
      { paintName: 'Titanium White', parts: 4 },
      { paintName: 'Mars Black', parts: 1 },
    ]),
    '4 Titanium White · 1 Mars Black',
  );
  assert.equal(formatMixLine([]), '');
});
