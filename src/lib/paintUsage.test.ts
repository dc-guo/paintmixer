import assert from 'node:assert/strict';
import test from 'node:test';
import type { MixRecipe, Paint } from '../types/paint.js';
import { hexToRgb } from './color.js';
import { aggregatePaintUsage } from './paintUsage.js';

const paints: Paint[] = [
  {
    id: 'a',
    name: 'Paint A',
    brand: 'Liquitex BASICS',
    hex: '#111111',
    rgb: hexToRgb('#111111') ?? { r: 0, g: 0, b: 0 },
  },
  {
    id: 'b',
    name: 'Paint B',
    brand: 'Liquitex BASICS',
    hex: '#EEEEEE',
    rgb: hexToRgb('#EEEEEE') ?? { r: 0, g: 0, b: 0 },
  },
];

function recipe(ingredients: Array<[id: string, parts: number]>): MixRecipe {
  return {
    targetHex: '#808080',
    ingredients: ingredients.map(([paintId, parts]) => ({
      paintId,
      paintName: paintId,
      parts,
    })),
    estimatedHex: '#808080',
    deltaE: 0,
    confidence: 'high',
    notes: [],
  };
}

test('aggregatePaintUsage returns nothing for no recipes', () => {
  assert.deepEqual(aggregatePaintUsage([], paints), []);
});

test('aggregatePaintUsage normalizes each recipe and sorts by share', () => {
  const usage = aggregatePaintUsage(
    [recipe([['a', 3], ['b', 1]]), recipe([['a', 1]])],
    paints,
  );

  // Recipe 1: a=0.75, b=0.25; recipe 2: a=1. Shares: a=1.75/2, b=0.25/2.
  assert.equal(usage[0].paintId, 'a');
  assert.equal(usage[0].percentage, 88);
  assert.equal(usage[0].paintName, 'Paint A');
  assert.equal(usage[1].paintId, 'b');
  assert.equal(usage[1].percentage, 13);
});
