import type { SampledColor, SavedPalette } from '../types/palette';

/** Trims a raw label input; a blank result normalizes to undefined (no label). */
export function normalizeLabel(raw: string): string | undefined {
  const trimmed = raw.trim();
  return trimmed || undefined;
}

/**
 * Move the color with `id` by `delta` positions (clamped to the array bounds).
 * Returns a new array; returns the input unchanged if the id is missing or the
 * move would not change the order.
 */
export function moveColorInList(
  colors: SampledColor[],
  id: string,
  delta: number,
): SampledColor[] {
  const index = colors.findIndex((color) => color.id === id);

  if (index === -1) {
    return colors;
  }

  const target = Math.min(colors.length - 1, Math.max(0, index + delta));

  if (target === index) {
    return colors;
  }

  const next = [...colors];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * Copy a saved palette for an independent duplicate: fresh palette id, fresh
 * per-color ids, a "Copy of …" name, and a caller-supplied timestamp. Colors are
 * shallow-copied (keeping hex/source/label/position/preferredRecipe) — safe
 * because the app updates those fields immutably and save/reload fully separates them.
 */
export function clonePalette(
  palette: SavedPalette,
  makeId: () => string,
  createdAt: string,
): SavedPalette {
  return {
    id: makeId(),
    name: `Copy of ${palette.name}`,
    createdAt,
    colors: palette.colors.map((color) => ({ ...color, id: makeId() })),
    artwork: palette.artwork ? { ...palette.artwork } : undefined,
  };
}
