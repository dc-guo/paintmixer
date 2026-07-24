import type { MixLine, MixSheetModel, SheetColor } from './mixSheetModel';

/**
 * Hard cap on a full share URL. The hash fragment never reaches a server, but
 * past this many characters chat and email clients start mangling links, so
 * the UI refuses to copy and points at the PDF instead.
 */
export const MAX_SHARE_URL_LENGTH = 8000;

/** Compact wire format — short keys keep the URL small. */
type WireColor = { h: string; l?: string; t?: string; m: Array<[string, number]> };
type WirePayload = { v: 1; n: string; c: WireColor[] };

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string | null {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Serializes a sheet for the share URL. The artwork image never travels. */
export function encodeSheet(model: MixSheetModel): string {
  const payload: WirePayload = {
    v: 1,
    n: model.name,
    c: model.colors.map((color) => ({
      h: color.hex,
      ...(color.label ? { l: color.label } : {}),
      ...(color.notes ? { t: color.notes } : {}),
      m: color.mix.map((line): [string, number] => [line.paintName, line.parts]),
    })),
  };
  return toBase64Url(JSON.stringify(payload));
}

function parseColor(raw: unknown): SheetColor | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.h !== 'string' || !HEX_PATTERN.test(candidate.h)) {
    return null;
  }
  if (candidate.l !== undefined && typeof candidate.l !== 'string') {
    return null;
  }
  if (candidate.t !== undefined && typeof candidate.t !== 'string') {
    return null;
  }
  if (!Array.isArray(candidate.m)) {
    return null;
  }

  const mix: MixLine[] = [];
  for (const entry of candidate.m) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'number' ||
      !Number.isFinite(entry[1]) ||
      entry[1] <= 0
    ) {
      return null;
    }
    mix.push({ paintName: entry[0], parts: entry[1] });
  }

  return {
    hex: candidate.h,
    ...(candidate.l ? { label: candidate.l } : {}),
    ...(candidate.t ? { notes: candidate.t } : {}),
    mix,
  };
}

/** Returns null on anything malformed, tampered, oversized, or wrong-version. */
export function decodeSheet(encoded: string): MixSheetModel | null {
  if (encoded.length === 0 || encoded.length > MAX_SHARE_URL_LENGTH * 2) {
    return null;
  }

  const json = fromBase64Url(encoded);

  if (json === null) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const payload = raw as Record<string, unknown>;

  if (payload.v !== 1 || typeof payload.n !== 'string' || !Array.isArray(payload.c)) {
    return null;
  }

  const colors: SheetColor[] = [];
  for (const rawColor of payload.c) {
    const color = parseColor(rawColor);
    if (color === null) {
      return null;
    }
    colors.push(color);
  }

  return { name: payload.n, artworkDataUrl: null, colors };
}
