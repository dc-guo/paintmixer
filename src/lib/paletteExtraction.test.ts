import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPaletteFromPixels } from './paletteExtraction.js';

function pixels(...colors: Array<[r: number, g: number, b: number, count: number, alpha?: number]>) {
  const data: number[] = [];

  for (const [r, g, b, count, alpha = 255] of colors) {
    for (let i = 0; i < count; i += 1) {
      data.push(r, g, b, alpha);
    }
  }

  return data;
}

test('extractPaletteFromPixels ranks dominant colors first', () => {
  const palette = extractPaletteFromPixels(
    pixels([255, 0, 0, 100], [0, 0, 255, 50], [0, 128, 0, 10]),
    3,
  );

  assert.equal(palette.length, 3);
  assert.equal(palette[0], '#FF0000');
  assert.ok(palette.includes('#0000FF'));
  assert.ok(palette.includes('#008000'));
});

test('extractPaletteFromPixels ignores mostly transparent pixels', () => {
  const palette = extractPaletteFromPixels(
    pixels([255, 0, 0, 10], [0, 0, 255, 100, 0]),
    3,
  );

  assert.deepEqual(palette, ['#FF0000']);
});

test('extractPaletteFromPixels never returns duplicate colors', () => {
  const palette = extractPaletteFromPixels(pixels([120, 120, 120, 200]), 6);

  assert.deepEqual(palette, ['#787878']);
});

test('extractPaletteFromPixels prefers visually distinct colors over near-duplicates', () => {
  const palette = extractPaletteFromPixels(
    // Two perceptually close dominant reds plus a rarer blue: the blue should win a slot.
    pixels([255, 0, 0, 100], [220, 30, 30, 90], [0, 0, 255, 20]),
    2,
  );

  assert.equal(palette[0], '#FF0000');
  assert.equal(palette[1], '#0000FF');
});

test('extractPaletteFromPixels respects the requested color count', () => {
  const palette = extractPaletteFromPixels(
    pixels(
      [255, 0, 0, 50],
      [0, 255, 0, 40],
      [0, 0, 255, 30],
      [255, 255, 0, 20],
      [255, 0, 255, 10],
    ),
    3,
  );

  assert.equal(palette.length, 3);
});
