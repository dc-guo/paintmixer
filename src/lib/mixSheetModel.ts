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

export type PaintShare = { paintName: string; percentage: number };

/**
 * How much of each paint the whole palette needs, as relative percentages.
 * Each color is normalized first so every color contributes equally regardless
 * of its own parts total (mirrors aggregatePaintUsage, but keyed on paint name
 * so it works from a decoded share payload with no paint library). A planning
 * estimate, not a physical volume.
 */
export function aggregateMixUsage(colors: SheetColor[]): PaintShare[] {
  const shares = new Map<string, number>();

  for (const color of colors) {
    const total = color.mix.reduce((sum, line) => sum + line.parts, 0);

    if (total === 0) {
      continue;
    }

    for (const line of color.mix) {
      shares.set(line.paintName, (shares.get(line.paintName) ?? 0) + line.parts / total);
    }
  }

  const grandTotal = [...shares.values()].reduce((sum, share) => sum + share, 0);

  if (grandTotal === 0) {
    return [];
  }

  return [...shares.entries()]
    .map(([paintName, share]) => ({
      paintName,
      percentage: Math.round((share / grandTotal) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}
