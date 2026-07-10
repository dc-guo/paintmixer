import assert from 'node:assert/strict';
import test from 'node:test';
import { clonePalette, moveColorInList } from './paletteEdits.js';
import type { SavedPalette, SampledColor } from '../types/palette';

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

test('clonePalette produces an independent copy with fresh ids and a Copy-of name', () => {
  const original: SavedPalette = {
    id: 'p1',
    name: 'Sunset',
    createdAt: '2026-01-01T00:00:00.000Z',
    colors: [
      { id: 'c1', hex: '#FF0000', source: 'auto', label: 'Sky' },
      { id: 'c2', hex: '#0000FF', source: 'manual' },
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
  // Independent: mutating the copy's colors array does not touch the original.
  copy.colors.push({ id: 'x', hex: '#111111', source: 'manual' });
  assert.equal(original.colors.length, 2);
});
