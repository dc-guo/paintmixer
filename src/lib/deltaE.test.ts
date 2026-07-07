import assert from 'node:assert/strict';
import test from 'node:test';
import { colorDistance, rgbToLab } from './deltaE.js';

test('colorDistance is zero for identical colors', () => {
  assert.equal(colorDistance({ r: 56, g: 109, b: 95 }, { r: 56, g: 109, b: 95 }), 0);
});

test('colorDistance between white and black is about 100', () => {
  const distance = colorDistance({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 });
  assert.ok(Math.abs(distance - 100) < 1, `expected ~100, got ${distance}`);
});

test('colorDistance is small for nearby colors and large for distant ones', () => {
  const red = { r: 210, g: 38, b: 48 };
  const nearRed = { r: 205, g: 45, b: 52 };
  const blue = { r: 0, g: 105, b: 177 };

  assert.ok(colorDistance(red, nearRed) < 5);
  assert.ok(colorDistance(red, blue) > 40);
});

test('rgbToLab puts white near L=100 and black near L=0', () => {
  assert.ok(Math.abs(rgbToLab({ r: 255, g: 255, b: 255 }).l - 100) < 0.5);
  assert.ok(rgbToLab({ r: 0, g: 0, b: 0 }).l < 0.5);
});
