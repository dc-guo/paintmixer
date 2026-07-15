import type { MixRecipe } from './paint';

export type ColorSource = 'image' | 'manual' | 'auto';

export type SampledColor = {
  id: string;
  hex: string;
  source: ColorSource;
  /** Optional user-given name for the color, e.g. "Sky". */
  label?: string;
  /** Freeform private annotation; never rendered on swatches or in the copy summary. */
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
  /** Downscaled local thumbnail of the source artwork; absent for hex-only palettes. */
  artwork?: {
    thumbnailDataUrl: string;
    name: string;
  };
};
