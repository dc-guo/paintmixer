import type { RGB } from '../types/color';
import type { Paint, PaintMatch } from '../types/paint';
import { colorDistance } from './deltaE.js';

// POC confidence thresholds (plan §9C) — intentionally easy to tune.
const HIGH_MAX = 8;
const MEDIUM_MAX = 18;

export function confidenceForDistance(distance: number): PaintMatch['confidence'] {
  if (distance < HIGH_MAX) {
    return 'high';
  }

  if (distance <= MEDIUM_MAX) {
    return 'medium';
  }

  return 'low';
}

export function matchPaints(target: RGB, paints: Paint[], limit = 5): PaintMatch[] {
  return paints
    .map((paint) => {
      const distance = colorDistance(target, paint.rgb);
      return {
        paint,
        deltaE: Math.round(distance * 10) / 10,
        confidence: confidenceForDistance(distance),
      };
    })
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, limit);
}
