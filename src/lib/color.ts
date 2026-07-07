import type { CMYK, PrintViabilityStatus, RGB } from '../types/color';

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function clampChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function normalizeHex(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(HEX_PATTERN);

  if (!match) {
    return null;
  }

  const rawHex = match[1].toUpperCase();
  const expandedHex =
    rawHex.length === 3
      ? rawHex
          .split('')
          .map((digit) => `${digit}${digit}`)
          .join('')
      : rawHex;

  return `#${expandedHex}`;
}

export function hexToRgb(hex: string): RGB | null {
  const normalizedHex = normalizeHex(hex);

  if (!normalizedHex) {
    return null;
  }

  return {
    r: parseInt(normalizedHex.slice(1, 3), 16),
    g: parseInt(normalizedHex.slice(3, 5), 16),
    b: parseInt(normalizedHex.slice(5, 7), 16),
  };
}

export function rgbToHex(rgb: RGB) {
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) =>
    clampChannel(channel).toString(16).padStart(2, '0').toUpperCase(),
  );

  return `#${channels.join('')}`;
}

export function rgbToCmyk(rgb: RGB): CMYK {
  const r = clampChannel(rgb.r) / 255;
  const g = clampChannel(rgb.g) / 255;
  const b = clampChannel(rgb.b) / 255;
  const k = 1 - Math.max(r, g, b);

  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

export function formatRgb(rgb: RGB) {
  return `${rgb.r} · ${rgb.g} · ${rgb.b}`;
}

// formatCmyk and rgbToCmyk are UI-dead by design: CMYK is export-only per
// plan decision #11, retained for exports and a possible future print view.
export function formatCmyk(cmyk: CMYK) {
  return `C ${cmyk.c}% / M ${cmyk.m}% / Y ${cmyk.y}% / K ${cmyk.k}%`;
}

export function getSaturation(rgb: RGB) {
  const r = clampChannel(rgb.r) / 255;
  const g = clampChannel(rgb.g) / 255;
  const b = clampChannel(rgb.b) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max === min) {
    return 0;
  }

  const lightness = (max + min) / 2;
  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

export function isLightColor(rgb: RGB) {
  // Perceived luminance; decides whether overlaid text should be dark or light.
  return (0.299 * clampChannel(rgb.r) + 0.587 * clampChannel(rgb.g) + 0.114 * clampChannel(rgb.b)) / 255 > 0.66;
}

export function getPrintViability(rgb: RGB): PrintViabilityStatus {
  const saturation = getSaturation(rgb);
  const maxChannel = Math.max(rgb.r, rgb.g, rgb.b);
  const channelSpread = maxChannel - Math.min(rgb.r, rgb.g, rgb.b);
  const isBright = maxChannel > 220;

  if (saturation > 0.82 && isBright && channelSpread > 150) {
    return 'Difficult to reproduce in print/paint';
  }

  if (saturation > 0.55 || (isBright && channelSpread > 100)) {
    return 'May shift in print/paint';
  }

  return 'Likely printable/paintable';
}
