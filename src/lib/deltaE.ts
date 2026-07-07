import type { RGB } from '../types/color';

export type Lab = {
  l: number;
  a: number;
  b: number;
};

export function srgbToLinear(channel: number) {
  const v = Math.min(255, Math.max(0, channel)) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(value: number) {
  const v = Math.min(1, Math.max(0, value));
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

export function rgbToLab(rgb: RGB): Lab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  // sRGB → XYZ (D65), normalized to the D65 white point.
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * CIE76 Delta E between two Lab colors. Exposed separately so hot loops can
 * convert a fixed reference color to Lab once instead of per comparison.
 */
export function labDistance(a: Lab, b: Lab) {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

/**
 * CIE76 Delta E between two colors. Simpler than CIEDE2000 and slightly
 * overstates differences in saturated regions, which is acceptable for
 * ranking paint matches in the POC (plan §9A documents this limitation).
 */
export function colorDistance(a: RGB, b: RGB) {
  return labDistance(rgbToLab(a), rgbToLab(b));
}
