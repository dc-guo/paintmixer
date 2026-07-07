import type { RGB } from '../types/color';
import { rgbToHex } from './color.js';

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
  maxColors = 6,
): string[] {
  type Bin = { count: number; r: number; g: number; b: number };
  const bins = new Map<number, Bin>();

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) {
      continue;
    }

    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key);

    if (bin) {
      bin.count += 1;
      bin.r += r;
      bin.g += g;
      bin.b += b;
    } else {
      bins.set(key, { count: 1, r, g, b });
    }
  }

  const ranked = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .map(
      (bin): RGB => ({
        r: Math.round(bin.r / bin.count),
        g: Math.round(bin.g / bin.count),
        b: Math.round(bin.b / bin.count),
      }),
    );

  const picked: RGB[] = [];

  for (const threshold of SEPARATION_THRESHOLDS) {
    for (const candidate of ranked) {
      if (picked.length >= maxColors) {
        break;
      }

      if (picked.every((chosen) => perceivedDistance(chosen, candidate) >= threshold)) {
        picked.push(candidate);
      }
    }

    if (picked.length >= maxColors) {
      break;
    }
  }

  return picked.map(rgbToHex);
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be decoded.'));
    image.src = dataUrl;
  });
}

export async function extractPaletteFromDataUrl(dataUrl: string, maxColors = 6) {
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
  return extractPaletteFromPixels(data, maxColors);
}
