import { hexToRgb } from '../lib/color.js';
import type { Paint, PaintOpacity } from '../types/paint';

// Curated seed set of Liquitex BASICS acrylic colors.
// Hex values are hand-approximated sRGB readings of swatch references —
// NOT manufacturer color data. Physical paint will differ; the app frames
// every use of these values as an approximation (plan guardrails 1 & 5).
type SeedPaint = {
  id: string;
  name: string;
  hex: string;
  opacity?: PaintOpacity;
};

const SEED: SeedPaint[] = [
  { id: 'titanium-white', name: 'Titanium White', hex: '#F4F4F0', opacity: 'opaque' },
  { id: 'unbleached-titanium', name: 'Unbleached Titanium', hex: '#E6DCC3', opacity: 'opaque' },
  { id: 'parchment', name: 'Parchment', hex: '#EFE8D5', opacity: 'semi-opaque' },
  { id: 'naples-yellow-hue', name: 'Naples Yellow Hue', hex: '#F0C987', opacity: 'opaque' },
  { id: 'primary-yellow', name: 'Primary Yellow', hex: '#FFD200', opacity: 'semi-opaque' },
  { id: 'cadmium-yellow-light-hue', name: 'Cadmium Yellow Light Hue', hex: '#FFE04A', opacity: 'semi-opaque' },
  { id: 'cadmium-yellow-medium-hue', name: 'Cadmium Yellow Medium Hue', hex: '#FFC20E', opacity: 'semi-opaque' },
  { id: 'cadmium-yellow-deep-hue', name: 'Cadmium Yellow Deep Hue', hex: '#FFA702', opacity: 'semi-opaque' },
  { id: 'yellow-oxide', name: 'Yellow Oxide', hex: '#C89234', opacity: 'opaque' },
  { id: 'raw-sienna', name: 'Raw Sienna', hex: '#A2683A', opacity: 'semi-opaque' },
  { id: 'burnt-sienna', name: 'Burnt Sienna', hex: '#7E3E1F', opacity: 'semi-opaque' },
  { id: 'raw-umber', name: 'Raw Umber', hex: '#57493C', opacity: 'semi-opaque' },
  { id: 'burnt-umber', name: 'Burnt Umber', hex: '#452F21', opacity: 'semi-opaque' },
  { id: 'cadmium-orange-hue', name: 'Cadmium Orange Hue', hex: '#F47B20', opacity: 'semi-opaque' },
  { id: 'primary-red', name: 'Primary Red', hex: '#D22630', opacity: 'semi-transparent' },
  { id: 'cadmium-red-light-hue', name: 'Cadmium Red Light Hue', hex: '#E03C31', opacity: 'semi-opaque' },
  { id: 'cadmium-red-deep-hue', name: 'Cadmium Red Deep Hue', hex: '#A32638', opacity: 'semi-opaque' },
  { id: 'alizarin-crimson-hue', name: 'Alizarin Crimson Hue', hex: '#7C2438', opacity: 'transparent' },
  { id: 'quinacridone-magenta', name: 'Quinacridone Magenta', hex: '#8A2E63', opacity: 'transparent' },
  { id: 'medium-magenta', name: 'Medium Magenta', hex: '#C25E9F', opacity: 'semi-opaque' },
  { id: 'brilliant-purple', name: 'Brilliant Purple', hex: '#7B68AE', opacity: 'semi-opaque' },
  { id: 'dioxazine-purple', name: 'Dioxazine Purple', hex: '#3B2B56', opacity: 'transparent' },
  { id: 'primary-blue', name: 'Primary Blue', hex: '#0069B1', opacity: 'semi-transparent' },
  { id: 'ultramarine-blue', name: 'Ultramarine Blue', hex: '#2E3192', opacity: 'transparent' },
  { id: 'phthalocyanine-blue', name: 'Phthalocyanine Blue', hex: '#0D3B70', opacity: 'semi-transparent' },
  { id: 'cerulean-blue-hue', name: 'Cerulean Blue Hue', hex: '#2D77BC', opacity: 'opaque' },
  { id: 'light-blue-permanent', name: 'Light Blue Permanent', hex: '#6FA8CE', opacity: 'opaque' },
  { id: 'cobalt-blue-hue', name: 'Cobalt Blue Hue', hex: '#2A52A0', opacity: 'semi-opaque' },
  { id: 'bright-aqua-green', name: 'Bright Aqua Green', hex: '#1FB6B4', opacity: 'semi-opaque' },
  { id: 'phthalocyanine-green', name: 'Phthalocyanine Green', hex: '#10604B', opacity: 'semi-transparent' },
  { id: 'emerald-green', name: 'Emerald Green', hex: '#009B77', opacity: 'semi-opaque' },
  { id: 'light-green-permanent', name: 'Light Green Permanent', hex: '#8DC63F', opacity: 'semi-opaque' },
  { id: 'chromium-oxide-green', name: 'Chromium Oxide Green', hex: '#5D7A45', opacity: 'opaque' },
  { id: 'hookers-green-hue', name: "Hooker's Green Hue", hex: '#2C5234', opacity: 'semi-transparent' },
  { id: 'paynes-gray', name: "Payne's Gray", hex: '#35414E', opacity: 'semi-opaque' },
  { id: 'neutral-gray-5', name: 'Neutral Gray Value 5', hex: '#7F8285', opacity: 'opaque' },
  { id: 'ivory-black', name: 'Ivory Black', hex: '#292724', opacity: 'opaque' },
  { id: 'mars-black', name: 'Mars Black', hex: '#222222', opacity: 'opaque' },
];

export const liquitexBasics: Paint[] = SEED.map((seed) => ({
  ...seed,
  brand: 'Liquitex BASICS',
  rgb: hexToRgb(seed.hex) ?? { r: 0, g: 0, b: 0 },
}));
