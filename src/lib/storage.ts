import type { SavedPalette } from '../types/palette';

const SAVED_PALETTES_KEY = 'paintbridge.savedPalettes.v1';

export function loadSavedPalettes(): SavedPalette[] {
  try {
    const raw = window.localStorage.getItem(SAVED_PALETTES_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedPalette[]) : [];
  } catch {
    return [];
  }
}

export function persistSavedPalettes(palettes: SavedPalette[]) {
  try {
    window.localStorage.setItem(SAVED_PALETTES_KEY, JSON.stringify(palettes));
  } catch {
    // Storage can be unavailable (private mode, quota); persistence is best-effort.
  }
}

const OWNED_PAINTS_KEY = 'paintbridge.ownedPaints.v1';

export function loadOwnedPaintIds(): string[] {
  try {
    const raw = window.localStorage.getItem(OWNED_PAINTS_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
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
