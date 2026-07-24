import type { RGB } from '../types/color';
import { linearToSrgb, srgbToLinear } from './deltaE.js';

/** Mean RGB of a size×size patch centered on (cx, cy), clamped to image bounds. */
export function averagePatch(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  size = 5,
): RGB {
  const half = Math.floor(size / 2);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = cy - half; y <= cy + half; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        continue;
      }
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
  }

  if (count === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

// Paper is not a perfect #FFFFFF; a near-white neutral avoids over-brightening.
const REFERENCE_WHITE: RGB = { r: 246, g: 246, b: 243 };
const PAPER_MIN_LUM = 0.25;
const PAPER_MAX_SAT = 0.25;
const GAIN_MIN = 0.25;
const GAIN_MAX = 4;

export type PaperResult = { ok: true; corrected: RGB } | { ok: false; reason: 'too-dark' | 'too-saturated' };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Von Kries-style per-channel correction: the white paper in the photo is a
 * known-neutral reference under the same light, so scaling the swatch by
 * reference-white ÷ paper (in linear RGB) removes the light's color cast.
 * Rejects a paper sample that is too dark or too colored to trust.
 */
export function correctForPaper(swatch: RGB, paper: RGB): PaperResult {
  const paperLin = { r: srgbToLinear(paper.r), g: srgbToLinear(paper.g), b: srgbToLinear(paper.b) };

  const lum = 0.2126 * paperLin.r + 0.7152 * paperLin.g + 0.0722 * paperLin.b;
  if (lum < PAPER_MIN_LUM) {
    return { ok: false, reason: 'too-dark' };
  }

  const maxLin = Math.max(paperLin.r, paperLin.g, paperLin.b);
  const minLin = Math.min(paperLin.r, paperLin.g, paperLin.b);
  if (maxLin > 0 && (maxLin - minLin) / maxLin > PAPER_MAX_SAT) {
    return { ok: false, reason: 'too-saturated' };
  }

  const refLin = {
    r: srgbToLinear(REFERENCE_WHITE.r),
    g: srgbToLinear(REFERENCE_WHITE.g),
    b: srgbToLinear(REFERENCE_WHITE.b),
  };

  const gain = {
    r: clamp(refLin.r / paperLin.r, GAIN_MIN, GAIN_MAX),
    g: clamp(refLin.g / paperLin.g, GAIN_MIN, GAIN_MAX),
    b: clamp(refLin.b / paperLin.b, GAIN_MIN, GAIN_MAX),
  };

  const swatchLin = { r: srgbToLinear(swatch.r), g: srgbToLinear(swatch.g), b: srgbToLinear(swatch.b) };

  return {
    ok: true,
    corrected: {
      r: linearToSrgb(clamp(swatchLin.r * gain.r, 0, 1)),
      g: linearToSrgb(clamp(swatchLin.g * gain.g, 0, 1)),
      b: linearToSrgb(clamp(swatchLin.b * gain.b, 0, 1)),
    },
  };
}

import { CONFIDENCE_LABEL, confidenceForDistance } from './paintMatching.js';
import { colorDistance, labDistance, rgbToLab } from './deltaE.js';
import type { MixRecipe } from '../types/paint';

export type Verdict = 'close' | 'fair' | 'far';

/** Corrected swatch vs target in the same words the paint matcher uses. */
export function swatchVerdict(corrected: RGB, target: RGB): Verdict {
  return CONFIDENCE_LABEL[confidenceForDistance(colorDistance(corrected, target))];
}

const L_NUDGE = 3;
const C_NUDGE = 3;

// CIELAB a/b axes: +a red, +b yellow, −a green, −b blue. Six plain hue words at
// their a/b-plane angles; the nudge names whichever is nearest the gap direction.
const HUE_WORDS: Array<{ word: string; angle: number }> = [
  { word: 'red', angle: 0 },
  { word: 'orange', angle: 45 },
  { word: 'yellow', angle: 90 },
  { word: 'green', angle: 180 },
  { word: 'blue', angle: 270 },
  { word: 'purple', angle: 315 },
];

function nearestHueWord(da: number, db: number): string {
  const angle = ((Math.atan2(db, da) * 180) / Math.PI + 360) % 360;
  let best = HUE_WORDS[0];
  let bestDist = 360;
  for (const candidate of HUE_WORDS) {
    const raw = Math.abs(angle - candidate.angle);
    const dist = Math.min(raw, 360 - raw);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best.word;
}

/**
 * One plain-language suggestion for moving the mix toward the target, or null
 * when there is no recipe to nudge. Lightness gap wins first; then hue
 * direction; otherwise an "already close" encouragement.
 */
export function nudgeLine(corrected: RGB, target: RGB, recipe: MixRecipe | null): string | null {
  if (!recipe) {
    return null;
  }

  const swatchLab = rgbToLab(corrected);
  const targetLab = rgbToLab(target);
  const dLight = swatchLab.l - targetLab.l; // > 0 → swatch is lighter
  const da = targetLab.a - swatchLab.a; // direction FROM swatch TO target
  const db = targetLab.b - swatchLab.b;
  const chromaGap = labDistance({ l: swatchLab.l, a: swatchLab.a, b: swatchLab.b }, { l: swatchLab.l, a: targetLab.a, b: targetLab.b });

  const hasWhite = recipe.ingredients.some((ingredient) => /white/i.test(ingredient.paintName));

  if (Math.abs(dLight) >= L_NUDGE && Math.abs(dLight) >= chromaGap) {
    if (dLight > 0) {
      return hasWhite
        ? 'Your swatch is lighter than the target — ease off the white.'
        : 'Your swatch is lighter than the target — add a touch of the darkest paint.';
    }
    return hasWhite
      ? 'Your swatch is darker than the target — add a little white.'
      : 'Your swatch is darker than the target — ease off the darkest paint.';
  }

  if (chromaGap >= C_NUDGE) {
    return `A touch more ${nearestHueWord(da, db)} would help.`;
  }

  return 'Right in the neighborhood — paint a larger swatch and check in daylight.';
}
