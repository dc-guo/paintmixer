import { hexToRgb } from '../lib/color.js';
import type { Paint, PaintOpacity } from '../types/paint';

// Complete current Liquitex BASICS range (72 colors), per the official
// 72x22ml "Complete Range" set listing at liquitex.com (checked 2026-07).
//
// Hex values are hand-approximated sRGB readings of official/retailer swatch
// imagery — NOT manufacturer color data. Physical paint will differ; the app
// frames every use of these values as an approximation (plan guardrails 1 & 5).
// Metallic/iridescent sheen and fluorescent glow cannot be represented in
// flat sRGB at all; those entries carry an extra note.
//
// Opacity ratings follow the official color-chart labels where known and are
// otherwise best-effort. Pigment codes are included only where confident.

const DEFAULT_SOURCE_NOTE =
  'Range per liquitex.com 72-set (2026-07); hex hand-approximated from swatch imagery';

type SeedPaint = {
  id: string;
  name: string;
  hex: string;
  opacity?: PaintOpacity;
  pigmentNotes?: string;
  /** Rough relative tinting strength; only set where clearly non-average. */
  tintingStrength?: number;
  sourceNote?: string;
};

const SEED: SeedPaint[] = [
  // Whites & near-whites
  { id: 'titanium-white', tintingStrength: 1.5, name: 'Titanium White', hex: '#F4F4F0', opacity: 'opaque', pigmentNotes: 'PW6' },
  { id: 'unbleached-titanium', tintingStrength: 1.2, name: 'Unbleached Titanium', hex: '#E6DCC3', opacity: 'opaque' },
  { id: 'parchment', tintingStrength: 1.2, name: 'Parchment', hex: '#EFE8D5', opacity: 'semi-opaque' },
  { id: 'transparent-mixing-white', tintingStrength: 0.3, name: 'Transparent Mixing White', hex: '#F1F1EE', opacity: 'transparent', pigmentNotes: 'glazing white — thins color without hiding' },

  // Yellows
  { id: 'primary-yellow', name: 'Primary Yellow', hex: '#FFD200', opacity: 'semi-opaque' },
  { id: 'cadmium-yellow-light-hue', name: 'Cadmium Yellow Light Hue', hex: '#FFE04A', opacity: 'semi-opaque' },
  { id: 'cadmium-yellow-medium-hue', name: 'Cadmium Yellow Medium Hue', hex: '#FFC20E', opacity: 'semi-opaque' },
  { id: 'cadmium-yellow-deep-hue', name: 'Cadmium Yellow Deep Hue', hex: '#FFA702', opacity: 'semi-opaque' },
  { id: 'naples-yellow-hue', name: 'Naples Yellow Hue', hex: '#F0C987', opacity: 'opaque' },
  { id: 'transparent-yellow', name: 'Transparent Yellow', hex: '#EFBA1F', opacity: 'transparent' },
  { id: 'yellow-oxide', name: 'Yellow Oxide', hex: '#C89234', opacity: 'opaque', pigmentNotes: 'PY42 (iron oxide)' },
  { id: 'bronze-yellow', name: 'Bronze Yellow', hex: '#A08327', opacity: 'opaque' },

  // Oranges & reds
  { id: 'cadmium-orange-hue', name: 'Cadmium Orange Hue', hex: '#F47B20', opacity: 'semi-opaque' },
  { id: 'vivid-red-orange', name: 'Vivid Red Orange', hex: '#EC5228', opacity: 'semi-opaque' },
  { id: 'cadmium-red-light-hue', name: 'Cadmium Red Light Hue', hex: '#E03C31', opacity: 'semi-opaque' },
  { id: 'cadmium-red-medium-hue', name: 'Cadmium Red Medium Hue', hex: '#C42430', opacity: 'semi-opaque' },
  { id: 'cadmium-red-deep-hue', name: 'Cadmium Red Deep Hue', hex: '#A32638', opacity: 'semi-opaque' },
  { id: 'primary-red', name: 'Primary Red', hex: '#D22630', opacity: 'semi-transparent' },
  { id: 'pyrrole-red', name: 'Pyrrole Red', hex: '#D22B2B', opacity: 'semi-opaque', pigmentNotes: 'PR254' },
  { id: 'naphthol-crimson', name: 'Naphthol Crimson', hex: '#BE2543', opacity: 'semi-transparent', pigmentNotes: 'PR170' },
  { id: 'alizarin-crimson-hue', name: 'Alizarin Crimson Hue Permanent', hex: '#7C2438', opacity: 'transparent' },
  { id: 'transparent-red', name: 'Transparent Red', hex: '#B22226', opacity: 'transparent' },
  { id: 'red-oxide', name: 'Red Oxide', hex: '#914334', opacity: 'opaque', pigmentNotes: 'PR101 (iron oxide)' },

  // Pinks & magentas
  { id: 'rose-pink', name: 'Rose Pink', hex: '#ED96AC', opacity: 'opaque' },
  { id: 'light-portrait-pink', name: 'Light Portrait Pink', hex: '#F4C2AC', opacity: 'opaque' },
  { id: 'medium-magenta', name: 'Medium Magenta', hex: '#C25E9F', opacity: 'semi-opaque' },
  { id: 'quinacridone-magenta', tintingStrength: 1.6, name: 'Quinacridone Magenta', hex: '#8A2E63', opacity: 'transparent', pigmentNotes: 'PR122' },

  // Violets
  { id: 'brilliant-purple', name: 'Brilliant Purple', hex: '#7B68AE', opacity: 'semi-opaque' },
  { id: 'light-blue-violet', name: 'Light Blue Violet', hex: '#8290D4', opacity: 'opaque' },
  { id: 'prism-violet', name: 'Prism Violet', hex: '#6F3E9C', opacity: 'semi-transparent' },
  { id: 'deep-violet', name: 'Deep Violet', hex: '#4A2C5F', opacity: 'semi-transparent' },
  { id: 'dioxazine-purple', tintingStrength: 1.8, name: 'Dioxazine Purple', hex: '#3B2B56', opacity: 'transparent', pigmentNotes: 'PV23' },
  { id: 'purple-gray', name: 'Purple Gray', hex: '#6F6172', opacity: 'opaque' },

  // Blues
  { id: 'primary-blue', name: 'Primary Blue', hex: '#0069B1', opacity: 'semi-transparent' },
  { id: 'brilliant-blue', name: 'Brilliant Blue', hex: '#1E7FC2', opacity: 'semi-opaque' },
  { id: 'ultramarine-blue', tintingStrength: 1.2, name: 'Ultramarine Blue', hex: '#2E3192', opacity: 'transparent', pigmentNotes: 'PB29' },
  { id: 'phthalocyanine-blue', tintingStrength: 2.2, name: 'Phthalocyanine Blue', hex: '#0D3B70', opacity: 'semi-transparent', pigmentNotes: 'PB15' },
  { id: 'prussian-blue-hue', tintingStrength: 1.8, name: 'Prussian Blue Hue', hex: '#1B3A54', opacity: 'semi-transparent' },
  { id: 'cerulean-blue-hue', name: 'Cerulean Blue Hue', hex: '#2D77BC', opacity: 'opaque' },
  { id: 'light-blue-permanent', name: 'Light Blue Permanent', hex: '#6FA8CE', opacity: 'opaque' },
  { id: 'cobalt-blue-hue', name: 'Cobalt Blue Hue', hex: '#2A52A0', opacity: 'semi-opaque' },
  { id: 'blue-gray', name: 'Blue Gray', hex: '#64778A', opacity: 'opaque' },
  { id: 'turquoise-blue', name: 'Turquoise Blue', hex: '#1B96AE', opacity: 'semi-opaque' },

  // Greens
  { id: 'bright-aqua-green', name: 'Bright Aqua Green', hex: '#1FB6B4', opacity: 'semi-opaque' },
  { id: 'phthalocyanine-green', tintingStrength: 2.2, name: 'Phthalocyanine Green', hex: '#10604B', opacity: 'semi-transparent', pigmentNotes: 'PG7' },
  { id: 'green-deep-permanent', name: 'Green Deep Permanent', hex: '#0E6B44', opacity: 'semi-transparent' },
  { id: 'hookers-green-hue', name: "Hooker's Green Hue Permanent", hex: '#2C5234', opacity: 'semi-transparent' },
  { id: 'light-green-permanent', name: 'Light Green Permanent', hex: '#8DC63F', opacity: 'semi-opaque' },
  { id: 'brilliant-yellow-green', name: 'Brilliant Yellow Green', hex: '#A9C93E', opacity: 'semi-opaque' },
  { id: 'lime-green', name: 'Lime Green', hex: '#93D30B', opacity: 'semi-opaque' },
  { id: 'light-olive-green', name: 'Light Olive Green', hex: '#8B8B50', opacity: 'opaque' },
  { id: 'green-gray', name: 'Green Gray', hex: '#7C8577', opacity: 'opaque' },

  // Earths
  { id: 'raw-sienna', name: 'Raw Sienna', hex: '#A2683A', opacity: 'semi-opaque', pigmentNotes: 'PBr7 (earth)' },
  { id: 'burnt-sienna', name: 'Burnt Sienna', hex: '#7E3E1F', opacity: 'semi-opaque', pigmentNotes: 'PBr7 (earth)' },
  { id: 'raw-umber', name: 'Raw Umber', hex: '#57493C', opacity: 'semi-opaque', pigmentNotes: 'PBr7 (earth)' },
  { id: 'burnt-umber', name: 'Burnt Umber', hex: '#452F21', opacity: 'semi-opaque', pigmentNotes: 'PBr7 (earth)' },

  // Grays & blacks
  { id: 'paynes-gray', tintingStrength: 1.4, name: "Payne's Gray", hex: '#35414E', opacity: 'semi-opaque' },
  { id: 'neutral-gray-5', name: 'Neutral Gray 5', hex: '#7F8285', opacity: 'opaque' },
  { id: 'ivory-black', tintingStrength: 1.6, name: 'Ivory Black', hex: '#292724', opacity: 'opaque', pigmentNotes: 'PBk9 (bone black)' },
  { id: 'mars-black', tintingStrength: 1.8, name: 'Mars Black', hex: '#222222', opacity: 'opaque', pigmentNotes: 'PBk11 (iron oxide)' },

  // Metallics & iridescents (flat sRGB stand-ins; sheen is not representable)
  { id: 'gold', name: 'Gold', hex: '#C49A3C', opacity: 'semi-opaque', pigmentNotes: 'metallic — sheen not representable on screen' },
  { id: 'silver', name: 'Silver', hex: '#ACAEB1', opacity: 'semi-opaque', pigmentNotes: 'metallic — sheen not representable on screen' },
  { id: 'copper', name: 'Copper', hex: '#B26946', opacity: 'semi-opaque', pigmentNotes: 'metallic — sheen not representable on screen' },
  { id: 'bronze', name: 'Bronze', hex: '#8C6E3C', opacity: 'semi-opaque', pigmentNotes: 'metallic — sheen not representable on screen' },
  { id: 'iridescent-white', tintingStrength: 1.2, name: 'Iridescent White', hex: '#EEEEE8', opacity: 'semi-opaque', pigmentNotes: 'iridescent — sheen not representable on screen' },
  { id: 'iridescent-graphite', tintingStrength: 1.3, name: 'Iridescent Graphite', hex: '#4A4C4F', opacity: 'semi-opaque', pigmentNotes: 'iridescent — sheen not representable on screen' },

  // Fluorescents (glow exceeds sRGB; values are clipped stand-ins)
  { id: 'fluorescent-yellow', name: 'Fluorescent Yellow', hex: '#F2FF26', opacity: 'semi-transparent', pigmentNotes: 'fluorescent — glow exceeds sRGB' },
  { id: 'fluorescent-orange', name: 'Fluorescent Orange', hex: '#FF6A13', opacity: 'semi-transparent', pigmentNotes: 'fluorescent — glow exceeds sRGB' },
  { id: 'fluorescent-red', name: 'Fluorescent Red', hex: '#FF3B4E', opacity: 'semi-transparent', pigmentNotes: 'fluorescent — glow exceeds sRGB' },
  { id: 'fluorescent-pink', name: 'Fluorescent Pink', hex: '#FF4FA3', opacity: 'semi-transparent', pigmentNotes: 'fluorescent — glow exceeds sRGB' },
  { id: 'fluorescent-green', name: 'Fluorescent Green', hex: '#44E052', opacity: 'semi-transparent', pigmentNotes: 'fluorescent — glow exceeds sRGB' },
  { id: 'fluorescent-blue', name: 'Fluorescent Blue', hex: '#2F6BFF', opacity: 'semi-transparent', pigmentNotes: 'fluorescent — glow exceeds sRGB' },
];

export const liquitexBasics: Paint[] = SEED.map((seed) => ({
  ...seed,
  brand: 'Liquitex BASICS',
  rgb: hexToRgb(seed.hex) ?? { r: 0, g: 0, b: 0 },
  sourceNote: seed.sourceNote ?? DEFAULT_SOURCE_NOTE,
}));
