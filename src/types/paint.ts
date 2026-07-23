import type { RGB } from './color';

export type PaintOpacity =
  | 'opaque'
  | 'semi-opaque'
  | 'semi-transparent'
  | 'transparent'
  | 'unknown';

export type Paint = {
  id: string;
  name: string;
  brand: 'Liquitex BASICS';
  hex: string;
  rgb: RGB;
  opacity?: PaintOpacity;
  pigmentNotes?: string;
  /**
   * Rough relative tinting strength (1 = average). Strong tinters —
   * phthalos, blacks, and titanium white's heavy scattering — punch above
   * their parts; glazing colors punch below. Used only inside mix
   * estimation, never shown to the user.
   */
  tintingStrength?: number;
  /** Where the color value came from; every seed entry carries one. */
  sourceNote?: string;
};

export type PaintMatch = {
  paint: Paint;
  deltaE: number;
  confidence: 'high' | 'medium' | 'low';
};

export type MixRecipe = {
  targetHex: string;
  ingredients: Array<{
    paintId: string;
    paintName: string;
    parts: number;
  }>;
  estimatedHex: string;
  deltaE: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
};
