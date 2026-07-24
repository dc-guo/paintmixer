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
