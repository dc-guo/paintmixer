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
