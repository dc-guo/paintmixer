import type { MixRecipe } from '../types/paint';
import type { SampledColor, SavedPalette } from '../types/palette';

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

function isValidPosition(value: unknown): value is { x: number; y: number } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const position = value as Record<string, unknown>;
  return typeof position.x === 'number' && typeof position.y === 'number';
}

/** Loose structural check — not a full MixRecipe type guard — but enough to
 * keep every field the app actually reads (recipe.ingredients.map/.reduce,
 * recipe.notes.filter/.length, recipe.confidence, recipe.targetHex,
 * recipe.estimatedHex) from crashing on a hand-edited or partially-written
 * stored recipe. */
function isMixRecipeLike(value: unknown): value is MixRecipe {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const recipe = value as Record<string, unknown>;

  if (!Array.isArray(recipe.ingredients)) {
    return false;
  }

  const ingredientsValid = recipe.ingredients.every((ingredient) => {
    if (typeof ingredient !== 'object' || ingredient === null) {
      return false;
    }

    const item = ingredient as Record<string, unknown>;
    return (
      typeof item.paintId === 'string' &&
      typeof item.paintName === 'string' &&
      typeof item.parts === 'number'
    );
  });

  if (!ingredientsValid) {
    return false;
  }

  return (
    typeof recipe.targetHex === 'string' &&
    typeof recipe.estimatedHex === 'string' &&
    typeof recipe.deltaE === 'number' &&
    (recipe.confidence === 'high' || recipe.confidence === 'medium' || recipe.confidence === 'low') &&
    Array.isArray(recipe.notes) &&
    recipe.notes.every((note) => typeof note === 'string')
  );
}

/** Validates and repairs a single stored color: drops the whole item when the
 * required fields (id/hex/source) aren't right, otherwise strips any
 * optional field that doesn't match its expected shape rather than
 * discarding the color (or the whole palette). Pure and exported for tests. */
export function sanitizeColor(value: unknown): SampledColor | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (
    typeof raw.id !== 'string' ||
    typeof raw.hex !== 'string' ||
    (raw.source !== 'image' && raw.source !== 'manual' && raw.source !== 'auto')
  ) {
    return null;
  }

  const color: SampledColor & { notes?: string } = {
    id: raw.id,
    hex: raw.hex,
    source: raw.source,
  };

  if (typeof raw.label === 'string') {
    color.label = raw.label;
  }

  if (isValidPosition(raw.position)) {
    color.position = { x: raw.position.x, y: raw.position.y };
  }

  if (isMixRecipeLike(raw.preferredRecipe)) {
    color.preferredRecipe = raw.preferredRecipe;
  }

  // `notes` isn't on SampledColor yet (landing in a later milestone); sanitize
  // it defensively now so data written by a newer build doesn't get corrupted
  // by round-tripping through this build.
  if (typeof raw.notes === 'string') {
    color.notes = raw.notes;
  }

  return color;
}

/** Validates a raw parsed value into saved palettes, dropping malformed
 * colors (not whole palettes) along the way. Pure and exported for tests. */
export function sanitizeSavedPalettes(value: unknown): SavedPalette[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isSavedPalette).map((palette) => ({
    ...palette,
    colors: palette.colors
      .map(sanitizeColor)
      .filter((color): color is SampledColor => color !== null),
  }));
}

export function loadSavedPalettes(): SavedPalette[] {
  try {
    const raw = window.localStorage.getItem(SAVED_PALETTES_KEY);

    if (!raw) {
      return [];
    }

    return sanitizeSavedPalettes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function persistSavedPalettes(palettes: SavedPalette[]) {
  try {
    window.localStorage.setItem(SAVED_PALETTES_KEY, JSON.stringify(palettes));
    return;
  } catch {
    // Likely over quota from artwork thumbnails. Degrade incrementally below
    // instead of stripping every palette's thumbnail for one oversized add.
  }

  const working = [...palettes];

  // Drop artwork one palette at a time, starting from the first element
  // (newest — the app prepends new palettes), retrying the write after each
  // drop and stopping as soon as one succeeds. If every palette has its
  // artwork stripped and the write still fails, this has degraded to the
  // old strip-everything behavior and gives up silently below, same as
  // before.
  for (let i = 0; i < working.length; i += 1) {
    if (!working[i].artwork) {
      continue;
    }

    const { artwork: _artwork, ...rest } = working[i];
    working[i] = rest;

    try {
      window.localStorage.setItem(SAVED_PALETTES_KEY, JSON.stringify(working));
      return;
    } catch {
      // Still over quota; drop the next palette's artwork and try again.
    }
  }

  // Storage can be unavailable (private mode), or the color data alone
  // exceeds quota even with every thumbnail stripped; persistence is
  // best-effort.
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
