import assert from 'node:assert/strict';
import test from 'node:test';
import { clonePalette, moveColorInList, normalizeLabel } from './paletteEdits.js';
import type { SavedPalette, SampledColor } from '../types/palette';
import type { MixRecipe } from '../types/paint';

function colors(...ids: string[]): SampledColor[] {
  return ids.map((id) => ({ id, hex: '#000000', source: 'auto' }));
}

function ids(list: SampledColor[]) {
  return list.map((color) => color.id);
}

test('moveColorInList moves a color forward and backward', () => {
  assert.deepEqual(ids(moveColorInList(colors('a', 'b', 'c'), 'b', 1)), ['a', 'c', 'b']);
  assert.deepEqual(ids(moveColorInList(colors('a', 'b', 'c'), 'b', -1)), ['b', 'a', 'c']);
});

test('moveColorInList clamps at the ends and ignores unknown ids', () => {
  assert.deepEqual(ids(moveColorInList(colors('a', 'b', 'c'), 'a', -1)), ['a', 'b', 'c']);
  assert.deepEqual(ids(moveColorInList(colors('a', 'b', 'c'), 'c', 1)), ['a', 'b', 'c']);
  assert.deepEqual(ids(moveColorInList(colors('a', 'b', 'c'), 'zz', 1)), ['a', 'b', 'c']);
});

const sampleRecipe: MixRecipe = {
  targetHex: '#FF0000',
  ingredients: [{ paintId: 'primary-red', paintName: 'Primary Red', parts: 1 }],
  estimatedHex: '#FF0000',
  deltaE: 0,
  confidence: 'high',
  notes: [],
};

test('clonePalette produces an independent copy with fresh ids and a Copy-of name', () => {
  const original: SavedPalette = {
    id: 'p1',
    name: 'Sunset',
    createdAt: '2026-01-01T00:00:00.000Z',
    colors: [
      { id: 'c1', hex: '#FF0000', source: 'auto', label: 'Sky' },
      {
        id: 'c2',
        hex: '#0000FF',
        source: 'manual',
        position: { x: 0.25, y: 0.75 },
        preferredRecipe: sampleRecipe,
      },
    ],
    artwork: { thumbnailDataUrl: 'data:x', name: 'pic.png' },
  };
  let n = 0;
  const makeId = () => `new-${n++}`;

  const copy = clonePalette(original, makeId, '2026-02-02T00:00:00.000Z');

  assert.notEqual(copy.id, original.id);
  assert.equal(copy.name, 'Copy of Sunset');
  assert.equal(copy.createdAt, '2026-02-02T00:00:00.000Z');
  assert.deepEqual(copy.colors.map((c) => c.id), ['new-1', 'new-2']);
  assert.deepEqual(copy.colors.map((c) => c.hex), ['#FF0000', '#0000FF']);
  assert.equal(copy.colors[0].label, 'Sky');
  // preferredRecipe and position must survive the clone.
  assert.deepEqual(copy.colors[1].position, { x: 0.25, y: 0.75 });
  assert.deepEqual(copy.colors[1].preferredRecipe, sampleRecipe);
  // Artwork is carried over but as an independent copy, not the same reference.
  assert.deepEqual(copy.artwork, original.artwork);
  assert.notEqual(copy.artwork, original.artwork);
  // Independent: mutating the copy's colors array does not touch the original.
  copy.colors.push({ id: 'x', hex: '#111111', source: 'manual' });
  assert.equal(original.colors.length, 2);
});

test('clonePalette leaves artwork undefined for a hex-only palette', () => {
  const original: SavedPalette = {
    id: 'p1',
    name: 'Hex only',
    createdAt: '2026-01-01T00:00:00.000Z',
    colors: [{ id: 'c1', hex: '#FF0000', source: 'manual' }],
  };
  let n = 0;
  const makeId = () => `new-${n++}`;

  const copy = clonePalette(original, makeId, '2026-02-02T00:00:00.000Z');

  assert.equal(copy.artwork, undefined);
});

test('normalizeLabel trims and maps a blank label to undefined', () => {
  assert.equal(normalizeLabel(' '), undefined);
  assert.equal(normalizeLabel(' Sky '), 'Sky');
});
