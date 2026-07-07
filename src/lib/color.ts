import type { CMYK, PrintViability, RGB } from '../types/color';

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
  return `R ${rgb.r} / G ${rgb.g} / B ${rgb.b}`;
}

export function formatCmyk(cmyk: CMYK) {
  return `C ${cmyk.c}% / M ${cmyk.m}% / Y ${cmyk.y}% / K ${cmyk.k}%`;
}

function getSaturation(rgb: RGB) {
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

export function getPrintViability(rgb: RGB): PrintViability {
  const saturation = getSaturation(rgb);
  const maxChannel = Math.max(rgb.r, rgb.g, rgb.b);
  const channelSpread = maxChannel - Math.min(rgb.r, rgb.g, rgb.b);
  const isBright = maxChannel > 220;

  if (saturation > 0.82 && isBright && channelSpread > 150) {
    return {
      status: 'Difficult to reproduce in print/paint',
      explanation:
        'This target is very saturated, so a printed or acrylic version will likely need a duller approximation.',
    };
  }

  if (saturation > 0.55 || (isBright && channelSpread > 100)) {
    return {
      status: 'May shift in print/paint',
      explanation:
        'This color may move slightly when translated from screen color into print or acrylic paint.',
    };
  }

  return {
    status: 'Likely printable/paintable',
    explanation:
      'This color is less extreme, so it is a more realistic starting point for print and acrylic approximation.',
  };
}
