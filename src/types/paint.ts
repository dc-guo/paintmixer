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
};

export type PaintMatch = {
  paint: Paint;
  deltaE: number;
  confidence: 'high' | 'medium' | 'low';
};
