import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPaletteFromPixels } from './paletteExtraction.js';
import { hexToRgb } from './color.js';

function pixels(...colors: Array<[r: number, g: number, b: number, count: number, alpha?: number]>) {
  const data: number[] = [];

  for (const [r, g, b, count, alpha = 255] of colors) {
    for (let i = 0; i < count; i += 1) {
      data.push(r, g, b, alpha);
    }
  }

  return data;
}

function hexes(palette: Array<{ hex: string }>) {
  return palette.map((color) => color.hex);
}

test('extractPaletteFromPixels ranks dominant colors first', () => {
  const data = pixels([255, 0, 0, 100], [0, 0, 255, 50], [0, 128, 0, 10]);
  const palette = extractPaletteFromPixels(data, data.length / 4, 3);

  assert.equal(palette.length, 3);
  assert.equal(palette[0].hex, '#FF0000');
  assert.ok(hexes(palette).includes('#0000FF'));
  assert.ok(hexes(palette).includes('#008000'));
});

test('extractPaletteFromPixels ignores mostly transparent pixels', () => {
  const data = pixels([255, 0, 0, 10], [0, 0, 255, 100, 0]);
  const palette = extractPaletteFromPixels(data, data.length / 4, 3);

  assert.deepEqual(hexes(palette), ['#FF0000']);
});

test('extractPaletteFromPixels never returns duplicate colors', () => {
  const data = pixels([120, 120, 120, 200]);
  const palette = extractPaletteFromPixels(data, data.length / 4, 6);

  assert.deepEqual(hexes(palette), ['#787878']);
});

test('extractPaletteFromPixels merges near-duplicate colors but keeps distinct ones', () => {
  // Two perceptually close reds dominate; a rarer blue. With only two slots the
  // reds collapse into one *averaged* red (not the raw #FF0000 the old greedy
  // picker returned), and the blue keeps the second slot.
  const data = pixels([255, 0, 0, 100], [220, 30, 30, 90], [0, 0, 255, 20]);
  const palette = extractPaletteFromPixels(data, data.length / 4, 2);

  assert.equal(palette.length, 2);
  const first = hexToRgb(palette[0].hex);
  assert.ok(first !== null);
  // Still clearly red, but averaged: red channel pulled below the raw 255.
  assert.ok(first.r > 200 && first.r < 250, 'dominant cluster is an averaged red');
  assert.ok(first.g < 60 && first.b < 60, 'dominant cluster reads as red');
  assert.equal(palette[1].hex, '#0000FF');
});

test('extractPaletteFromPixels is deterministic for identical input', () => {
  const data = pixels(
    [255, 0, 0, 50],
    [0, 255, 0, 40],
    [0, 0, 255, 30],
    [255, 255, 0, 20],
    [128, 64, 32, 15],
    [10, 200, 180, 8],
  );
  const first = extractPaletteFromPixels(data, data.length / 4, 5);
  const second = extractPaletteFromPixels(data, data.length / 4, 5);

  assert.deepEqual(first, second);
});

test('extractPaletteFromPixels respects the requested color count', () => {
  const data = pixels(
    [255, 0, 0, 50],
    [0, 255, 0, 40],
    [0, 0, 255, 30],
    [255, 255, 0, 20],
    [255, 0, 255, 10],
  );
  const palette = extractPaletteFromPixels(data, data.length / 4, 3);

  assert.equal(palette.length, 3);
});

test('extractPaletteFromPixels returns no colors for a non-positive count', () => {
  const data = pixels([255, 0, 0, 10]);
  assert.deepEqual(extractPaletteFromPixels(data, data.length / 4, 0), []);
});

test('extractPaletteFromPixels reports a representative location for each color', () => {
  // 2x2 image: red, blue / red, red — blue occupies the top-right pixel and
  // the red region's centroid rounds to the bottom-left pixel.
  const data = [255, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255];
  const palette = extractPaletteFromPixels(data, 2, 2);
  const blue = palette.find((color) => color.hex === '#0000FF');
  const red = palette.find((color) => color.hex === '#FF0000');

  assert.deepEqual(blue && { x: blue.x, y: blue.y }, { x: 0.75, y: 0.25 });
  assert.deepEqual(red && { x: red.x, y: red.y }, { x: 0.25, y: 0.75 });
});

test('extractPaletteFromPixels places band colors near the band center', () => {
  // 4x4 image: top two rows red, bottom two rows blue.
  const data = pixels([255, 0, 0, 8], [0, 0, 255, 8]);
  const palette = extractPaletteFromPixels(data, 4, 2);
  const red = palette.find((color) => color.hex === '#FF0000');
  const blue = palette.find((color) => color.hex === '#0000FF');

  assert.ok(red && red.y < 0.5, 'red marker sits in the top half');
  assert.ok(blue && blue.y > 0.5, 'blue marker sits in the bottom half');
  assert.ok(red && red.x > 0.25 && red.x < 0.75, 'red marker is horizontally centered');
});

test('extractPaletteFromPixels falls back to an in-cluster pixel when the centroid lands elsewhere', () => {
  // 3x3: red occupies opposite corners, blue fills the rest. The red cluster's
  // member-pixel centroid rounds to the middle pixel (which is blue), so the red
  // marker must fall back to the red region's first pixel (top-left corner),
  // not sit on the blue center.
  const R = [255, 0, 0, 255];
  const B = [0, 0, 255, 255];
  const data = [
    ...R, ...B, ...B,
    ...B, ...B, ...B,
    ...B, ...B, ...R,
  ];
  const palette = extractPaletteFromPixels(data, 3, 2);
  const red = palette.find((color) => color.hex === '#FF0000');

  assert.ok(red, 'red cluster is present');
  // Top-left red pixel (col 0, row 0) → (0.5/3, 0.5/3), NOT the blue center (0.5, 0.5).
  assert.deepEqual(red && { x: red.x, y: red.y }, { x: 0.5 / 3, y: 0.5 / 3 });
});
