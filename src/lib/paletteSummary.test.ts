import assert from 'node:assert/strict';
import test from 'node:test';
import type { MixRecipe } from '../types/paint.js';
import type { SavedPalette } from '../types/palette.js';
import { buildPaletteSummary } from './paletteSummary.js';

const palette: SavedPalette = {
  id: 'p1',
  name: 'Frozen Air',
  createdAt: '2026-07-07T12:00:00.000Z',
  colors: [
    { id: 'c1', hex: '#9ED3FB', source: 'auto' },
    { id: 'c2', hex: '#FFDC48', source: 'auto' },
  ],
  artwork: { thumbnailDataUrl: 'data:image/jpeg;base64,x', name: 'winter.png' },
};

function recipe(
  ingredients: Array<[name: string, parts: number]>,
  notes: string[] = [],
): MixRecipe {
  return {
    targetHex: '#9ED3FB',
    ingredients: ingredients.map(([paintName, parts]) => ({
      paintId: paintName.toLowerCase().replace(/ /g, '-'),
      paintName,
      parts,
    })),
    estimatedHex: '#9ED3FB',
    deltaE: 3,
    confidence: 'high',
    notes,
  };
}

test('buildPaletteSummary lists colors with their mixes in plain English', () => {
  const summary = buildPaletteSummary(
    palette,
    [
      {
        color: palette.colors[0],
        recipe: recipe(
          [
            ['Titanium White', 2],
            ['Cerulean Blue Hue', 3],
          ],
          ['Fold in the white gradually.'],
        ),
      },
      {
        color: palette.colors[1],
        recipe: recipe([['Cadmium Yellow Light Hue', 1]], ['Straight from the tube.']),
      },
    ],
    [
      { paintId: 'a', paintName: 'Cerulean Blue Hue', hex: '#2D77BC', percentage: 40 },
      { paintId: 'b', paintName: 'Titanium White', hex: '#F4F4F0', percentage: 35 },
    ],
  );

  assert.ok(summary.includes('Frozen Air — PaintBridge palette'));
  assert.ok(summary.includes('from winter.png'));
  assert.ok(
    summary.includes(
      '1. #9ED3FB — 3 parts Cerulean Blue Hue + 2 parts Titanium White. Fold in the white gradually.',
    ),
  );
  assert.ok(summary.includes('2. #FFDC48 — Cadmium Yellow Light Hue straight from the tube.'));
  assert.ok(summary.includes('- Cerulean Blue Hue — about 40% of the total mix volume'));
  assert.ok(summary.includes('- Titanium White — about 35%'));
  assert.ok(summary.includes('Approximations, not formulas.'));
  assert.ok(!summary.includes('ΔE'), 'no jargon in the summary');
  assert.ok(!summary.includes('CMYK'), 'no jargon in the summary');
});

test('buildPaletteSummary handles palettes without mixes', () => {
  const summary = buildPaletteSummary(
    { ...palette, artwork: undefined },
    palette.colors.map((color) => ({ color, recipe: null })),
    [],
  );

  assert.ok(summary.includes('1. #9ED3FB'));
  assert.ok(summary.includes('2. #FFDC48'));
  assert.ok(summary.includes('Mark the paints you own in PaintBridge to get starter mixes.'));
  assert.ok(!summary.includes('from winter.png'));
});

test('buildPaletteSummary shows a color label before its hex', () => {
  const color = { id: 'c1', hex: '#89C5F4', source: 'manual' as const, label: 'Sky' };
  const palette = {
    id: 'p1',
    name: 'Test',
    colors: [color],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const summary = buildPaletteSummary(palette, [{ color, recipe: null }], []);
  assert.ok(summary.includes('1. Sky — #89C5F4'), summary);
});
