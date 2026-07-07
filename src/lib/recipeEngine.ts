import type { RGB } from '../types/color';
import type { MixRecipe, Paint } from '../types/paint';
import { getSaturation, rgbToHex } from './color.js';
import { labDistance, linearToSrgb, rgbToLab, srgbToLinear } from './deltaE.js';
import { ksToLinear, linearToKS } from './mixing.js';
import { confidenceForDistance } from './paintMatching.js';

/** Shared with the summary layer so single-paint phrasing stays in sync. */
export const NOTE_STRAIGHT_FROM_TUBE = 'Straight from the tube.';

export type MixIngredient = {
  paint: Paint;
  parts: number;
};

type Ingredient = MixIngredient;

type Candidate = {
  ingredients: Ingredient[];
  estimated: RGB;
  deltaE: number;
  score: number;
};

// Discrete ratios keep recipes practical to measure out (plan §9D). The
// 8:1 and 12:1 ends exist for tints and shades — pastels and near-blacks
// need far more base than a 6:1 cap allows.
const PAIR_RATIOS: Array<[number, number]> = [
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [6, 1],
  [8, 1],
  [12, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 6],
  [1, 8],
  [1, 12],
  [3, 2],
  [2, 3],
];
const THIRD_PARTS = [1, 2];
const TOP_PAIRS_TO_EXTEND = 12;
// Each extra ingredient must earn its keep by improving deltaE at least this much.
const COMPLEXITY_PENALTY = 1.2;
// Lab chroma below this reads as neutral (white/gray/black). True neutrals
// sit under ~2; pale-but-clearly-tinted targets like a pastel pink sit
// around 8-10, so the line is drawn low.
const ACHROMATIC_CHROMA = 5;
// A colorful target must never be answered with an all-neutral recipe:
// "plain white" for a pink is a lie even when it is the nearest color.
const HUELESS_PENALTY = 25;
// Paints at least this light (Lab L) count as "white" for mixing advice.
const WHITE_LIGHTNESS = 87;

function isWhitePaint(paint: Paint) {
  return rgbToLab(paint.rgb).l >= WHITE_LIGHTNESS;
}

type ChannelKS = {
  r: number;
  g: number;
  b: number;
};

function paintKS(paint: Paint): ChannelKS {
  return {
    r: linearToKS(srgbToLinear(paint.rgb.r)),
    g: linearToKS(srgbToLinear(paint.rgb.g)),
    b: linearToKS(srgbToLinear(paint.rgb.b)),
  };
}

function mixFromKS(entries: Array<{ ks: ChannelKS; weight: number }>): RGB {
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (const { ks, weight } of entries) {
    total += weight;
    r += ks.r * weight;
    g += ks.g * weight;
    b += ks.b * weight;
  }

  if (total === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: linearToSrgb(ksToLinear(r / total)),
    g: linearToSrgb(ksToLinear(g / total)),
    b: linearToSrgb(ksToLinear(b / total)),
  };
}

/**
 * Estimate the color of a paint mixture: single-constant Kubelka–Munk mixing
 * weighted by parts × tinting strength. A single-paint "mix" is the paint
 * itself. An approximation — the UI labels every result as such.
 */
export function estimateMix(ingredients: Ingredient[]): RGB {
  if (ingredients.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  if (ingredients.length === 1) {
    return ingredients[0].paint.rgb;
  }

  return mixFromKS(
    ingredients.map(({ paint, parts }) => ({
      ks: paintKS(paint),
      weight: parts * (paint.tintingStrength ?? 1),
    })),
  );
}

function buildNotes(target: RGB, candidate: Candidate): string[] {
  const notes: string[] = [];

  if (candidate.ingredients.length === 1) {
    notes.push(NOTE_STRAIGHT_FROM_TUBE);
  } else {
    const maxParts = Math.max(...candidate.ingredients.map(({ parts }) => parts));
    const white = candidate.ingredients.find(({ paint }) => isWhitePaint(paint));

    // Only meaningful when a white is folded INTO a larger base; when white
    // dominates, the technique is the reverse (fold the pigment into it).
    if (white && white.parts < maxParts) {
      notes.push('Fold in the white gradually.');
    }
  }

  const lightnessGap = rgbToLab(target).l - rgbToLab(candidate.estimated).l;

  if (lightnessGap > 3) {
    notes.push('The target is lighter than this mix will likely reach.');
  } else if (lightnessGap < -3) {
    notes.push('The target is darker than this mix will likely reach.');
  } else if (getSaturation(target) - getSaturation(candidate.estimated) > 0.15) {
    notes.push('The target is more saturated than this mix will likely reach.');
  }

  const totalParts = candidate.ingredients.reduce((sum, { parts }) => sum + parts, 0);
  // Semi-transparent paints count at half weight: a mix of nothing but
  // semi-transparents still behaves like a glaze.
  const glazeParts = candidate.ingredients.reduce((sum, { paint, parts }) => {
    if (paint.opacity === 'transparent') {
      return sum + parts;
    }

    if (paint.opacity === 'semi-transparent') {
      return sum + parts / 2;
    }

    return sum;
  }, 0);
  const fullyTransparent = candidate.ingredients.find(
    ({ paint }) => paint.opacity === 'transparent',
  );

  if (glazeParts / totalParts >= 0.5) {
    notes.push('Mostly transparent paints — expect a glaze that shifts over what is underneath.');
  } else if (fullyTransparent) {
    notes.push(`${fullyTransparent.paint.name} is transparent — expect shifts when layering.`);
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

/**
 * Build a full recipe record for a user-chosen set of ingredients — used by
 * the live ratio editor, where the parts come from the user, not the search.
 */
export function buildRecipe(target: RGB, ingredients: Ingredient[]): MixRecipe {
  const estimated = estimateMix(ingredients);
  const deltaE = labDistance(rgbToLab(target), rgbToLab(estimated));
  return toRecipe(target, { ingredients, estimated, deltaE, score: deltaE });
}

export function suggestMixes(target: RGB, ownedPaints: Paint[], maxResults = 3): MixRecipe[] {
  if (ownedPaints.length === 0) {
    return [];
  }

  // Hot loop: thousands of candidates are scored per call, so convert the
  // fixed target to Lab once and compute each paint's K/S + tinting weight
  // factor once up front.
  const targetLab = rgbToLab(target);
  const targetChroma = Math.hypot(targetLab.a, targetLab.b);
  const ksById = new Map(
    ownedPaints.map((paint) => {
      const lab = rgbToLab(paint.rgb);
      return [
        paint.id,
        {
          ks: paintKS(paint),
          tint: paint.tintingStrength ?? 1,
          achromatic: Math.hypot(lab.a, lab.b) < ACHROMATIC_CHROMA,
        },
      ];
    }),
  );

  const makeCandidate = (ingredients: Ingredient[]): Candidate => {
    const estimated =
      ingredients.length === 1
        ? ingredients[0].paint.rgb
        : mixFromKS(
            ingredients.flatMap(({ paint, parts }) => {
              const cached = ksById.get(paint.id);
              return cached ? [{ ks: cached.ks, weight: parts * cached.tint }] : [];
            }),
          );
    const deltaE = labDistance(targetLab, rgbToLab(estimated));
    const hueless =
      targetChroma > ACHROMATIC_CHROMA &&
      ingredients.every(({ paint }) => ksById.get(paint.id)?.achromatic ?? false);

    return {
      ingredients,
      estimated,
      deltaE,
      score:
        deltaE +
        COMPLEXITY_PENALTY * (ingredients.length - 1) +
        (hueless ? HUELESS_PENALTY : 0),
    };
  };

  const candidates: Candidate[] = [];

  for (const paint of ownedPaints) {
    candidates.push(makeCandidate([{ paint, parts: 1 }]));
  }

  const pairCandidates: Candidate[] = [];

  for (let i = 0; i < ownedPaints.length; i += 1) {
    for (let j = i + 1; j < ownedPaints.length; j += 1) {
      const paintA = ownedPaints[i];
      const paintB = ownedPaints[j];

      for (const [partsA, partsB] of PAIR_RATIOS) {
        pairCandidates.push(
          makeCandidate([
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
        candidates.push(makeCandidate([...pair.ingredients, { paint, parts }]));
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
