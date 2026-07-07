import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCmyk,
  getPrintViability,
  hexToRgb,
  isLightColor,
  normalizeHex,
  rgbToCmyk,
  rgbToHex,
} from './color.js';

test('isLightColor separates light and dark backgrounds', () => {
  assert.equal(isLightColor({ r: 219, g: 216, b: 214 }), true);
  assert.equal(isLightColor({ r: 78, g: 98, b: 106 }), false);
});

test('normalizeHex accepts three and six digit hex values', () => {
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  assert.equal(normalizeHex('1f7a4d'), '#1F7A4D');
});

test('normalizeHex rejects invalid hex values', () => {
  assert.equal(normalizeHex('paint'), null);
  assert.equal(normalizeHex('#12'), null);
  assert.equal(normalizeHex('#12345g'), null);
});

test('hexToRgb and rgbToHex convert colors predictably', () => {
  assert.deepEqual(hexToRgb('#386D5F'), { r: 56, g: 109, b: 95 });
  assert.equal(rgbToHex({ r: 56, g: 109, b: 95 }), '#386D5F');
});

test('rgbToCmyk returns rounded percentage channels', () => {
  assert.deepEqual(rgbToCmyk({ r: 255, g: 255, b: 255 }), { c: 0, m: 0, y: 0, k: 0 });
  assert.deepEqual(rgbToCmyk({ r: 0, g: 0, b: 0 }), { c: 0, m: 0, y: 0, k: 100 });
  assert.deepEqual(rgbToCmyk({ r: 56, g: 109, b: 95 }), { c: 49, m: 0, y: 13, k: 57 });
});

test('formatCmyk creates a readable approximation label', () => {
  assert.equal(formatCmyk({ c: 49, m: 0, y: 13, k: 57 }), 'C 49% / M 0% / Y 13% / K 57%');
});

test('getPrintViability keeps language approximate and flags saturated colors', () => {
  assert.equal(getPrintViability({ r: 56, g: 109, b: 95 }).status, 'Likely printable/paintable');
  assert.equal(
    getPrintViability({ r: 0, g: 255, b: 80 }).status,
    'Difficult to reproduce in print/paint',
  );
});
