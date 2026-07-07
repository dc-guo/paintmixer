import type { RGB } from '../types/color';
import type { MixRecipe, Paint } from '../types/paint';
import { getSaturation, rgbToHex } from './color.js';
import { colorDistance, linearToSrgb, srgbToLinear } from './deltaE.js';
import { confidenceForDistance } from './paintMatching.js';

type Ingredient = {
  paint: Paint;
  parts: number;
};

type Candidate = {
  ingredients: Ingredient[];
  estimated: RGB;
  deltaE: number;
  score: number;
};

// Discrete ratios keep recipes practical to measure out (plan §9D).
const PAIR_RATIOS: Array<[number, number]> = [
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [6, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 6],
  [3, 2],
  [2, 3],
];
const THIRD_PARTS = [1, 2];
const TOP_PAIRS_TO_EXTEND = 12;
// Each extra ingredient must earn its keep by improving deltaE at least this much.
const COMPLEXITY_PENALTY = 1.2;

/**
 * Weighted average in linear RGB — a rough stand-in for real pigment mixing,
 * which is subtractive. Good enough to rank starter mixes; the UI frames
 * every result as an approximation.
 */
export function estimateMixColor(ingredients: Ingredient[]): RGB {
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (const { paint, parts } of ingredients) {
    total += parts;
    r += srgbToLinear(paint.rgb.r) * parts;
    g += srgbToLinear(paint.rgb.g) * parts;
    b += srgbToLinear(paint.rgb.b) * parts;
  }

  if (total === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: linearToSrgb(r / total),
    g: linearToSrgb(g / total),
    b: linearToSrgb(b / total),
  };
}

function makeCandidate(target: RGB, ingredients: Ingredient[]): Candidate {
  const estimated = estimateMixColor(ingredients);
  const deltaE = colorDistance(target, estimated);

  return {
    ingredients,
    estimated,
    deltaE,
    score: deltaE + COMPLEXITY_PENALTY * (ingredients.length - 1),
  };
}

function buildNotes(target: RGB, candidate: Candidate): string[] {
  const notes: string[] = [];

  if (candidate.ingredients.length === 1) {
    notes.push('Straight from the tube.');
  }

  if (candidate.ingredients.some(({ paint }) => paint.id === 'titanium-white')) {
    notes.push('Fold in the white gradually.');
  }

  if (getSaturation(target) - getSaturation(candidate.estimated) > 0.15) {
    notes.push('The target is more saturated than this mix will likely reach.');
  }

  const transparent = candidate.ingredients.find(({ paint }) => paint.opacity === 'transparent');

  if (transparent) {
    notes.push(`${transparent.paint.name} is transparent — expect shifts when layering.`);
  }

  return notes.slice(0, 2);
}

function toRecipe(target: RGB, candidate: Candidate): MixRecipe {
  return {
    targetHex: rgbToHex(target),
    ingredients: candidate.ingredients.map(({ paint, parts }) => ({
      paintId: paint.id,
      paintName: paint.name,
      parts,
    })),
    estimatedHex: rgbToHex(candidate.estimated),
    deltaE: Math.round(candidate.deltaE * 10) / 10,
    confidence: confidenceForDistance(candidate.deltaE),
    notes: buildNotes(target, candidate),
  };
}

export function suggestMixes(target: RGB, ownedPaints: Paint[], maxResults = 3): MixRecipe[] {
  if (ownedPaints.length === 0) {
    return [];
  }

  const candidates: Candidate[] = [];

  for (const paint of ownedPaints) {
    candidates.push(makeCandidate(target, [{ paint, parts: 1 }]));
  }

  const pairCandidates: Candidate[] = [];

  for (let i = 0; i < ownedPaints.length; i += 1) {
    for (let j = i + 1; j < ownedPaints.length; j += 1) {
      const paintA = ownedPaints[i];
      const paintB = ownedPaints[j];

      for (const [partsA, partsB] of PAIR_RATIOS) {
        pairCandidates.push(
          makeCandidate(target, [
            { paint: paintA, parts: partsA },
            { paint: paintB, parts: partsB },
          ]),
        );
      }
    }
  }

  pairCandidates.sort((a, b) => a.score - b.score);
  candidates.push(...pairCandidates);

  // Extend only the most promising pairs with a third paint; exhaustive
  // triples are combinatorially wasteful for a starter-mix suggestion.
  for (const pair of pairCandidates.slice(0, TOP_PAIRS_TO_EXTEND)) {
    for (const paint of ownedPaints) {
      if (pair.ingredients.some((ingredient) => ingredient.paint.id === paint.id)) {
        continue;
      }

      for (const parts of THIRD_PARTS) {
        candidates.push(makeCandidate(target, [...pair.ingredients, { paint, parts }]));
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  // Return the best recipe per distinct paint set so the alternatives are
  // genuinely different mixes, not ratio variants of the same paints.
  const seenPaintSets = new Set<string>();
  const results: MixRecipe[] = [];

  for (const candidate of candidates) {
    const setKey = candidate.ingredients
      .map((ingredient) => ingredient.paint.id)
      .sort()
      .join('|');

    if (seenPaintSets.has(setKey)) {
      continue;
    }

    seenPaintSets.add(setKey);
    results.push(toRecipe(target, candidate));

    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
}
