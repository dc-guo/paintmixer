import type { MixRecipe } from '../types/paint';
import type { SampledColor, SavedPalette } from '../types/palette';

export type MixLine = { paintName: string; parts: number };

export type SheetColor = {
  hex: string;
  label?: string;
  notes?: string;
  mix: MixLine[];
};

export type MixSheetModel = {
  name: string;
  /** null on hex-only palettes and always null in a decoded share payload. */
  artworkDataUrl: string | null;
  colors: SheetColor[];
};

/**
 * Normalizes a palette plus its resolved recipes into what the sheet renders.
 * Recipes are resolved by the caller (preferred recipe or live suggestion) so
 * the model — and anything encoded from it — is self-contained.
 */
export function buildSheetModel(
  palette: SavedPalette,
  items: Array<{ color: SampledColor; recipe: MixRecipe | null }>,
): MixSheetModel {
  return {
    name: palette.name,
    artworkDataUrl: palette.artwork?.thumbnailDataUrl ?? null,
    colors: items.map(({ color, recipe }) => ({
      hex: color.hex,
      ...(color.label ? { label: color.label } : {}),
      ...(color.notes ? { notes: color.notes } : {}),
      mix: recipe
        ? [...recipe.ingredients]
            .sort((a, b) => b.parts - a.parts)
            .map(({ paintName, parts }) => ({ paintName, parts }))
        : [],
    })),
  };
}

/** "4 Titanium White · 1 Mars Black" — the card's one-line recipe. */
export function formatMixLine(mix: MixLine[]): string {
  return mix.map((line) => `${line.parts} ${line.paintName}`).join(' · ');
}
