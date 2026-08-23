import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateMixUsage, buildSheetModel, formatMixLine } from './mixSheetModel.js';
import type { SheetColor } from './mixSheetModel.js';
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

test('aggregateMixUsage sums normalized paint shares to 100%, sorted desc', () => {
  const colors: SheetColor[] = [
    // color A: 3 white : 1 blue  -> white 0.75, blue 0.25
    {
      hex: '#89C5F4',
      mix: [
        { paintName: 'Titanium White', parts: 3 },
        { paintName: 'Phthalocyanine Blue', parts: 1 },
      ],
    },
    // color B: 1 white : 1 black -> white 0.5, black 0.5
    {
      hex: '#7A7A7A',
      mix: [
        { paintName: 'Titanium White', parts: 1 },
        { paintName: 'Mars Black', parts: 1 },
      ],
    },
  ];
  const usage = aggregateMixUsage(colors);
  // white share = 0.75 + 0.5 = 1.25; blue 0.25; black 0.5; grand total 2.0
  // -> white 63% (round 62.5), black 25%, blue 13% (round 12.5); rounding may sum to 101.
  assert.deepEqual(usage, [
    { paintName: 'Titanium White', percentage: 63 },
    { paintName: 'Mars Black', percentage: 25 },
    { paintName: 'Phthalocyanine Blue', percentage: 13 },
  ]);
});

test('aggregateMixUsage ignores colors with no mix and returns [] when empty', () => {
  assert.deepEqual(aggregateMixUsage([{ hex: '#000000', mix: [] }]), []);
  assert.deepEqual(aggregateMixUsage([]), []);
});
