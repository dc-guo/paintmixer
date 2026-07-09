import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampPaletteSize,
  parsePaletteSize,
  DEFAULT_PALETTE_SIZE,
  MIN_PALETTE_SIZE,
  MAX_PALETTE_SIZE,
} from './storage.js';

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
