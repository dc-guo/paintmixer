import assert from 'node:assert/strict';
import test from 'node:test';
import { liquitexBasics } from '../data/liquitexBasics.js';
import { normalizeHex } from './color.js';
import { confidenceForDistance, matchPaints } from './paintMatching.js';

test('matchPaints returns closest paints first', () => {
  const target = { r: 111, g: 168, b: 206 }; // #6FA8CE — Light Blue Permanent
  const matches = matchPaints(target, liquitexBasics, 5);

  assert.equal(matches.length, 5);
  assert.equal(matches[0].paint.id, 'light-blue-permanent');
  assert.equal(matches[0].deltaE, 0);
  assert.equal(matches[0].confidence, 'high');

  for (let i = 1; i < matches.length; i += 1) {
    assert.ok(matches[i].deltaE >= matches[i - 1].deltaE, 'matches are sorted ascending');
  }
});

test('matchPaints respects the limit', () => {
  const matches = matchPaints({ r: 128, g: 128, b: 128 }, liquitexBasics, 3);
  assert.equal(matches.length, 3);
});

test('confidenceForDistance maps thresholds', () => {
  assert.equal(confidenceForDistance(0), 'high');
  assert.equal(confidenceForDistance(7.9), 'high');
  assert.equal(confidenceForDistance(8), 'medium');
  assert.equal(confidenceForDistance(18), 'medium');
  assert.equal(confidenceForDistance(18.1), 'low');
});

test('liquitexBasics seed data is well-formed', () => {
  const ids = new Set(liquitexBasics.map((paint) => paint.id));
  assert.equal(ids.size, liquitexBasics.length, 'paint ids are unique');
  assert.ok(liquitexBasics.length >= 30, 'seed set has a useful breadth');

  for (const paint of liquitexBasics) {
    assert.equal(normalizeHex(paint.hex), paint.hex, `${paint.id} has a normalized hex`);
    assert.equal(paint.brand, 'Liquitex BASICS');
  }
});
