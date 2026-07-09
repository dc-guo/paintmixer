import type { RGB } from '../types/color';
import { rgbToHex } from './color.js';
import { rgbToLab, labDistance, type Lab } from './deltaE.js';
import { loadImage } from './loadImage.js';

export type ExtractedColor = {
  hex: string;
  /** Fractions (0–1) of image width/height at a representative pixel of the color. */
  x: number;
  y: number;
};

// Seed-separation thresholds in CIE76 Lab (ΔE) units, progressively relaxed so
// seeds spread out (a deterministic stand-in for k-means++ initialization) while
// still filling the requested count on low-variety artwork. The first threshold
// is high enough that near-duplicate colors share a seed and merge; the final 1
// blocks exact-duplicate seeds.
const SEED_SEPARATION_THRESHOLDS = [40, 24, 12, 1];
const MAX_KMEANS_ITERATIONS = 10;

type Bin = {
  key: number;
  count: number;
  r: number; // sum of channel over member pixels
  g: number;
  b: number;
  firstIndex: number;
  sumX: number;
  sumY: number;
  rgb: RGB; // mean RGB (filled after accumulation)
  lab: Lab; // Lab of the mean RGB
};

function quantizeKey(r: number, g: number, b: number) {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
}

export function extractPaletteFromPixels(
  pixels: Uint8ClampedArray | number[],
  width: number,
  maxColors = 5,
): ExtractedColor[] {
  const safeWidth = Math.max(1, width);
  const rows = Math.max(1, Math.ceil(pixels.length / 4 / safeWidth));

  // 1. Bin pixels into 4-bit-per-channel buckets.
  const bins = new Map<number, Bin>();

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) {
      continue;
    }

    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const key = quantizeKey(r, g, b);
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
        rgb: { r: 0, g: 0, b: 0 },
        lab: { l: 0, a: 0, b: 0 },
      });
    }
  }

  const binList = [...bins.values()];

  if (binList.length === 0 || maxColors <= 0) {
    return [];
  }

  // 2. Precompute each bin's mean RGB and its Lab.
  for (const bin of binList) {
    bin.rgb = {
      r: Math.round(bin.r / bin.count),
      g: Math.round(bin.g / bin.count),
      b: Math.round(bin.b / bin.count),
    };
    bin.lab = rgbToLab(bin.rgb);
  }

  // 3. Seed centroids: count-ranked greedy pick with relaxing Lab separation.
  const ranked = [...binList].sort((a, b) => b.count - a.count);
  const centroids: Lab[] = [];

  for (const threshold of SEED_SEPARATION_THRESHOLDS) {
    for (const bin of ranked) {
      if (centroids.length >= maxColors) {
        break;
      }

      if (centroids.every((c) => labDistance(c, bin.lab) >= threshold)) {
        centroids.push({ ...bin.lab });
      }
    }

    if (centroids.length >= maxColors) {
      break;
    }
  }

  const k = centroids.length;
  const assignment = new Array<number>(binList.length).fill(-1);

  // 4. k-means over the bins, weighted by count, distance in Lab.
  for (let iter = 0; iter < MAX_KMEANS_ITERATIONS; iter += 1) {
    let changed = false;

    for (let bi = 0; bi < binList.length; bi += 1) {
      const lab = binList[bi].lab;
      let best = 0;
      let bestDist = Infinity;

      for (let ci = 0; ci < k; ci += 1) {
        // Strict `<` keeps ties on the lowest centroid index — deterministic.
        const d = labDistance(lab, centroids[ci]);
        if (d < bestDist) {
          bestDist = d;
          best = ci;
        }
      }

      if (assignment[bi] !== best) {
        assignment[bi] = best;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }

    const acc = centroids.map(() => ({ l: 0, a: 0, b: 0, w: 0 }));

    for (let bi = 0; bi < binList.length; bi += 1) {
      const bin = binList[bi];
      const target = acc[assignment[bi]];
      target.l += bin.lab.l * bin.count;
      target.a += bin.lab.a * bin.count;
      target.b += bin.lab.b * bin.count;
      target.w += bin.count;
    }

    for (let ci = 0; ci < k; ci += 1) {
      if (acc[ci].w > 0) {
        centroids[ci] = { l: acc[ci].l / acc[ci].w, a: acc[ci].a / acc[ci].w, b: acc[ci].b / acc[ci].w };
      }
    }
  }

  // 5. Build clusters from the final assignment (empty centroids drop out).
  type Cluster = {
    index: number;
    count: number;
    r: number; // count-weighted RGB sums
    g: number;
    b: number;
    sumX: number;
    sumY: number;
    dominantBin: Bin;
  };
  const clusters = new Map<number, Cluster>();
  const keyToCluster = new Map<number, number>();

  for (let bi = 0; bi < binList.length; bi += 1) {
    const bin = binList[bi];
    const ci = assignment[bi];
    keyToCluster.set(bin.key, ci);
    const existing = clusters.get(ci);

    if (existing) {
      existing.count += bin.count;
      existing.r += bin.rgb.r * bin.count;
      existing.g += bin.rgb.g * bin.count;
      existing.b += bin.rgb.b * bin.count;
      existing.sumX += bin.sumX;
      existing.sumY += bin.sumY;
      if (bin.count > existing.dominantBin.count) {
        existing.dominantBin = bin;
      }
    } else {
      clusters.set(ci, {
        index: ci,
        count: bin.count,
        r: bin.rgb.r * bin.count,
        g: bin.rgb.g * bin.count,
        b: bin.rgb.b * bin.count,
        sumX: bin.sumX,
        sumY: bin.sumY,
        dominantBin: bin,
      });
    }
  }

  // 6. Emit, most-dominant cluster first.
  const ordered = [...clusters.values()].sort((a, b) => b.count - a.count);

  return ordered.map((cluster) => {
    const rgb: RGB = {
      r: Math.round(cluster.r / cluster.count),
      g: Math.round(cluster.g / cluster.count),
      b: Math.round(cluster.b / cluster.count),
    };

    // Representative position: the cluster's member-pixel centroid, unless that
    // pixel belongs to a different cluster (disconnected region) — then fall
    // back to the dominant bin's first pixel, guaranteed in-cluster.
    const cx = Math.min(safeWidth - 1, Math.round(cluster.sumX / cluster.count));
    const cy = Math.min(rows - 1, Math.round(cluster.sumY / cluster.count));
    const centroidOffset = (cy * safeWidth + cx) * 4;
    const centroidKey = quantizeKey(
      pixels[centroidOffset] ?? 0,
      pixels[centroidOffset + 1] ?? 0,
      pixels[centroidOffset + 2] ?? 0,
    );
    const centroidInCluster =
      (pixels[centroidOffset + 3] ?? 0) >= 128 && keyToCluster.get(centroidKey) === cluster.index;
    const px = centroidInCluster ? cx : cluster.dominantBin.firstIndex % safeWidth;
    const py = centroidInCluster ? cy : Math.floor(cluster.dominantBin.firstIndex / safeWidth);

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
