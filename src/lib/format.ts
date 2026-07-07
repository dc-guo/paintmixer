import type { SavedPalette } from '../types/palette';

export function formatPaletteDate(createdAt: string, options?: { withYear?: boolean }) {
  return new Date(createdAt).toLocaleDateString(undefined, {
    ...(options?.withYear ? { year: 'numeric' as const } : {}),
    month: 'long',
    day: 'numeric',
  });
}

/** The "July 7 · 6 colors" line shown under palette names. */
export function formatPaletteMeta(palette: SavedPalette) {
  const count = palette.colors.length;
  return `${formatPaletteDate(palette.createdAt)} · ${count} color${count === 1 ? '' : 's'}`;
}
