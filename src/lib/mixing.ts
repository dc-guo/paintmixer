// Single-constant Kubelka–Munk mixing helpers.
//
// Real pigment mixing is subtractive: mixture color is predicted far better
// by averaging K/S (absorption over scattering) than by averaging light,
// which is what a plain linear-RGB average does. Single-constant K–M is the
// standard cheap approximation when per-pigment K and S are unmeasured —
// still an approximation, and the UI labels every result as such.
//
// Reflectance is clamped away from 0 so very dark paints produce large but
// finite K/S. The floor is a tuning knob: lower means dark paints dominate
// mixtures more aggressively. 0.06 keeps black believably dominant while
// letting heavy white ratios actually tint colors toward pastels.

const MIN_REFLECTANCE = 0.06;
const MAX_REFLECTANCE = 0.99;

/** Linear reflectance (0–1) → K/S. */
export function linearToKS(linear: number) {
  const r = Math.min(MAX_REFLECTANCE, Math.max(MIN_REFLECTANCE, linear));
  return (1 - r) ** 2 / (2 * r);
}

/** K/S → linear reflectance (0–1). Inverse of linearToKS within the clamps. */
export function ksToLinear(ks: number) {
  const safe = Math.max(0, ks);
  return Math.min(1, Math.max(0, 1 + safe - Math.sqrt(safe * safe + 2 * safe)));
}
