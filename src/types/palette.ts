import type { MixRecipe } from './paint';

export type ColorSource = 'image' | 'manual' | 'auto';

export type SampledColor = {
  id: string;
  hex: string;
  source: ColorSource;
  /** Optional user-given name for the color, e.g. "Sky". */
  label?: string;
  /**
   * Freeform user annotation — a scratch place for reminders. Shown only on the
   * palette detail page (not on swatches or in the copy summary), and included
   * in the JSON export as part of the user's own palette data.
   */
  notes?: string;
  /** Fractions (0–1) of image width/height; absent for manual colors. */
  position?: { x: number; y: number };
  /**
   * The user's chosen or ratio-adjusted mix. When absent, the engine's live
   * suggestion is used everywhere this color appears.
   */
  preferredRecipe?: MixRecipe;
};

export type SavedPalette = {
  id: string;
  name: string;
  colors: SampledColor[];
  createdAt: string;
  /**
   * Which paint set this palette mixes from. Absent on pre-paint-sets
   * palettes and resolved with the my-paints/first-set fallback at read time.
   */
  paintSetId?: string;
  /** Downscaled local thumbnail of the source artwork; absent for hex-only palettes. */
  artwork?: {
    thumbnailDataUrl: string;
    name: string;
  };
};
