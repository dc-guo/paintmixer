import type { SavedPalette } from '../types/palette';

const SAVED_PALETTES_KEY = 'paintbridge.savedPalettes.v1';
const OWNED_PAINTS_KEY = 'paintbridge.ownedPaints.v1';
const PALETTE_SIZE_KEY = 'paintbridge.paletteSize.v1';

export const MIN_PALETTE_SIZE = 3;
export const MAX_PALETTE_SIZE = 8;
export const DEFAULT_PALETTE_SIZE = 5;

export function clampPaletteSize(size: number): number {
  if (!Number.isFinite(size)) {
    return DEFAULT_PALETTE_SIZE;
  }

  return Math.min(MAX_PALETTE_SIZE, Math.max(MIN_PALETTE_SIZE, Math.round(size)));
}

/** Validate a stored palette-size string; missing/garbage falls back to the default. */
export function parsePaletteSize(raw: string | null): number {
  if (raw === null || raw.trim() === '') {
    return DEFAULT_PALETTE_SIZE;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampPaletteSize(parsed) : DEFAULT_PALETTE_SIZE;
}

export function loadPaletteSize(): number {
  try {
    return parsePaletteSize(window.localStorage.getItem(PALETTE_SIZE_KEY));
  } catch {
    return DEFAULT_PALETTE_SIZE;
  }
}

export function persistPaletteSize(size: number): void {
  try {
    window.localStorage.setItem(PALETTE_SIZE_KEY, String(clampPaletteSize(size)));
  } catch {
    // Storage can be unavailable (private mode, quota); persistence is best-effort.
  }
}

function loadStoredArray<T>(key: string, isItem: (value: unknown) => value is T): T[] {
  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isItem) : [];
  } catch {
    return [];
  }
}

function isSavedPalette(value: unknown): value is SavedPalette {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const palette = value as Partial<SavedPalette>;
  return (
    typeof palette.id === 'string' &&
    typeof palette.name === 'string' &&
    typeof palette.createdAt === 'string' &&
    Array.isArray(palette.colors)
  );
}

export function loadSavedPalettes(): SavedPalette[] {
  return loadStoredArray(SAVED_PALETTES_KEY, isSavedPalette);
}

export function persistSavedPalettes(palettes: SavedPalette[]) {
  try {
    window.localStorage.setItem(SAVED_PALETTES_KEY, JSON.stringify(palettes));
  } catch {
    try {
      // Likely over quota from artwork thumbnails: keep the color data,
      // drop the images.
      window.localStorage.setItem(
        SAVED_PALETTES_KEY,
        JSON.stringify(palettes.map(({ artwork: _artwork, ...rest }) => rest)),
      );
    } catch {
      // Storage can be unavailable (private mode); persistence is best-effort.
    }
  }
}

export function loadOwnedPaintIds(): string[] {
  return loadStoredArray(OWNED_PAINTS_KEY, (id): id is string => typeof id === 'string');
}

export function persistOwnedPaintIds(ids: string[]) {
  try {
    window.localStorage.setItem(OWNED_PAINTS_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be unavailable (private mode, quota); persistence is best-effort.
  }
}

export function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
