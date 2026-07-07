import type { RGB } from '../types/color';
import { rgbToHex } from './color.js';
import { loadImage } from './loadImage.js';

export type ExtractedColor = {
  hex: string;
  /** Fractions (0–1) of image width/height at a representative pixel of the color. */
  x: number;
  y: number;
};

// Progressively relaxed separation thresholds: prefer a varied palette, but
// still fill the requested count when the artwork has few distinct colors.
// The final threshold of 1 prevents exact-duplicate picks.
const SEPARATION_THRESHOLDS = [48, 32, 16, 1];

function perceivedDistance(a: RGB, b: RGB) {
  // Luminance-weighted RGB distance: a cheap stand-in for perceptual
  // difference until the dedicated deltaE utility lands.
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
}

export function extractPaletteFromPixels(
  pixels: Uint8ClampedArray | number[],
  width: number,
  maxColors = 5,
): ExtractedColor[] {
  type Bin = {
    key: number;
    count: number;
    r: number;
    g: number;
    b: number;
    firstIndex: number;
    sumX: number;
    sumY: number;
  };
  const bins = new Map<number, Bin>();
  const safeWidth = Math.max(1, width);

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) {
      continue;
    }

    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const pixelIndex = i / 4;
    const bin = bins.get(key);

    if (bin) {
      bin.count += 1;
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.sumX += pixelIndex % safeWidth;
      bin.sumY += Math.floor(pixelIndex / safeWidth);
    } else {
      bins.set(key, {
        key,
        count: 1,
        r,
        g,
        b,
        firstIndex: pixelIndex,
        sumX: pixelIndex % safeWidth,
        sumY: Math.floor(pixelIndex / safeWidth),
      });
    }
  }

  const ranked = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .map((bin) => ({
      rgb: {
        r: Math.round(bin.r / bin.count),
        g: Math.round(bin.g / bin.count),
        b: Math.round(bin.b / bin.count),
      },
      bin,
    }));

  const picked: typeof ranked = [];

  for (const threshold of SEPARATION_THRESHOLDS) {
    for (const candidate of ranked) {
      if (picked.length >= maxColors) {
        break;
      }

      if (picked.every((chosen) => perceivedDistance(chosen.rgb, candidate.rgb) >= threshold)) {
        picked.push(candidate);
      }
    }

    if (picked.length >= maxColors) {
      break;
    }
  }

  const rows = Math.max(1, Math.ceil(pixels.length / 4 / safeWidth));

  return picked.map(({ rgb, bin }) => {
    // Prefer the centroid of the color's region; if the region is disconnected
    // and its centroid lands on a different color, fall back to the first pixel.
    const cx = Math.min(safeWidth - 1, Math.round(bin.sumX / bin.count));
    const cy = Math.min(rows - 1, Math.round(bin.sumY / bin.count));
    const centroidOffset = (cy * safeWidth + cx) * 4;
    const centroidKey =
      (((pixels[centroidOffset] ?? 0) >> 4) << 8) |
      (((pixels[centroidOffset + 1] ?? 0) >> 4) << 4) |
      ((pixels[centroidOffset + 2] ?? 0) >> 4);
    const useCentroid = centroidKey === bin.key && (pixels[centroidOffset + 3] ?? 0) >= 128;
    const px = useCentroid ? cx : bin.firstIndex % safeWidth;
    const py = useCentroid ? cy : Math.floor(bin.firstIndex / safeWidth);

    return {
      hex: rgbToHex(rgb),
      x: (px + 0.5) / safeWidth,
      y: (py + 0.5) / rows,
    };
  });
}

export async function extractPaletteFromDataUrl(dataUrl: string, maxColors = 5) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  // Downsample large artwork before reading pixels; palette extraction does
  // not need full resolution and this keeps sampling fast.
  const scale = Math.min(1, 160 / Math.max(image.naturalWidth, image.naturalHeight, 1));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return [];
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return extractPaletteFromPixels(data, canvas.width, maxColors);
}
