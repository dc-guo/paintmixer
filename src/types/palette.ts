export type ColorSource = 'image' | 'manual' | 'auto';

export type SampledColor = {
  id: string;
  hex: string;
  source: ColorSource;
};

export type SavedPalette = {
  id: string;
  name: string;
  colors: SampledColor[];
  createdAt: string;
};
