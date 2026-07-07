export type ColorSource = 'image' | 'manual' | 'auto';

export type SampledColor = {
  id: string;
  hex: string;
  source: ColorSource;
  /** Fractions (0–1) of image width/height; absent for manual colors. */
  position?: { x: number; y: number };
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
