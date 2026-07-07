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

export function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
