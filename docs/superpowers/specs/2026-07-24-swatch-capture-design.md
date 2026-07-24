# Photo swatch check — design spec

Phase 4, feature 2. Written 2026-07-24. Approved direction after a question round with Diane
(purpose → mix-check; accuracy → white-paper correction; placement → workspace).

## Goal

Close the mix → paint → adjust loop: the user mixes a color from a recipe, paints a test swatch
on white paper, photographs it, and the app says how close the swatch is to the target color —
in the app's existing confidence words — plus one plain-language nudge for the recipe. All
processing is on-device and deterministic; the photo is never stored or uploaded.

## User-facing behavior

1. In the workspace, with a palette color selected, the **Starter mix** panel shows a
   **"Check a painted swatch"** action (only when a color is selected; it does not require a
   recipe — see Nudge line).
2. Activating it opens the device camera on phones (`<input type="file" accept="image/*"
   capture="environment">`) or a file picker on desktop. No getUserMedia, no permission prompt.
3. The photo opens in a modal on a canvas. Two taps, prompted in sequence:
   - "Tap your painted swatch."
   - "Tap a clean bit of the paper."
   Each tap drops a marker (draggable to re-sample, same interaction as artwork markers).
   Samples average a small patch (5×5 device pixels) rather than a single pixel.
4. The result replaces the prompts in the same modal:
   - **Comparison strip**: target color and the *corrected* swatch color side by side
     (reuses the MixComparison visual pattern).
   - **Verdict**: one confidence word — close / fair / far — via the existing
     `confidenceForDistance` thresholds and `CONFIDENCE_LABEL` mapping. No Delta-E, no numbers.
   - **Nudge line** (at most one sentence, only when the color has a current recipe):
     e.g. "Your swatch is lighter than the target — ease off the white." Derived from the
     corrected difference; see Nudge line below.
   - Standing copy: "Approximate — lighting still matters. The photo stays on your device."
5. "Check another" restarts at step 2 with the same target. Closing the modal discards
   everything; nothing persists to the palette or storage.

## White-paper correction (the honesty mechanism)

A phone photo's colors are tinted by the light source and the camera's auto white balance.
Because the swatch is painted on white paper, the paper itself is a known-neutral reference in
the same light:

- Sample the paper patch → `paperRGB`.
- In **linear** RGB (via existing `srgbToLinear` / `linearToSrgb` in `src/lib/deltaE.ts`),
  compute per-channel gains `gain_c = referenceWhiteLinear_c ÷ paperLinear_c`, where the
  reference white is neutral `#F6F6F3` (paper is not a perfect #FFFFFF; a near-white neutral
  avoids over-brightening). Guard against divide-by-zero on a black paper sample (the sanity
  check below rejects it first).
- Apply the gains to the swatch sample's linear channels, clamp to [0, 1], convert back to sRGB.
  This is von Kries-style scaling — deterministic, no AI, no network.
- **Paper sanity check**: if the paper sample is too dark (linear luminance < 0.25) or too
  saturated (max channel − min channel > 0.25 of max), it is rejected with "That doesn't look
  like white paper — tap a cleaner spot." The verdict never renders from a rejected reference.

Limits stated honestly in the UI copy: correction handles color *cast*; it cannot fix deep
shadow, glare, or mixed lighting. The approximation line stays visible with the verdict.

## Verdict

- Compare corrected swatch vs target with the same distance the paint matcher uses
  (`colorDistance` / `rgbToLab` + `labDistance` in `src/lib/deltaE.ts`), mapped through
  `confidenceForDistance` and `CONFIDENCE_LABEL` (`src/lib/paintMatching.ts`) → close / fair /
  far. Reusing the existing thresholds keeps "close" meaning the same thing everywhere.
- Confidence words only. No numbers anywhere in the UI (export/debug excluded, per decision #11).

## Nudge line

Only when the selected color currently has a recipe (preferred or live suggestion) — without
one there is nothing to nudge; the verdict stands alone.

Deterministic, order-of-priority rules on the corrected-swatch → target difference in Lab
(reusing the existing lightness/saturation note thresholds from the recipe engine where they
exist):

1. **Lightness gap dominant** (|ΔL| largest and above threshold): swatch lighter than target →
   "Your swatch is lighter than the target — ease off the white." (or "— a touch more of the
   darkest paint" when the recipe has no white); darker → the mirror phrasing.
2. **Otherwise, hue/chroma direction**: name the plain-words direction of the gap — "a touch
   more blue would help", "slightly less red". Direction comes from the a/b deltas mapped to
   the nearest of six plain color words (red, orange, yellow, green, blue, purple); the
   sentence never names a specific paint unless the recipe contains an obvious carrier of that
   direction (single ingredient whose hue matches), in which case: "a touch more Ultramarine
   Blue."
3. **Below all thresholds** (verdict is close): "Right in the neighborhood — paint a larger
   swatch and check in daylight."

One sentence, terse voice, never more than one suggestion.

## Architecture

- **`src/lib/swatchCheck.ts`** (pure, fully tested): `correctForPaper(swatchRGB, paperRGB):
  RGB` (with a `PaperRejection` result type for the sanity check), `swatchVerdict(corrected,
  target): 'close' | 'fair' | 'far'` (thin wrapper over existing distance + thresholds), and
  `nudgeLine(corrected, target, recipe | null): string | null` implementing the rules above.
- **`src/components/SwatchCheckModal.tsx`**: the modal — file input trigger, canvas render of
  the photo, two-tap marker flow, result panel. Consumes only `swatchCheck.ts` outputs plus
  `MixComparison`-style presentation. Follows the existing modal/drawer patterns
  (backdrop + Escape via `useEscapeKey`).
- **`src/pages/WorkspacePage.tsx`**: the "Check a painted swatch" action in the Starter mix
  panel (visible when `activeColor && !preview`), passing the target hex and current recipe.
- No storage changes; no route changes; no new dependencies. The photo's data URL lives in
  component state only and is dropped on close.

## Error handling

- Non-image / unreadable file → the uploader's existing error pattern ("Use a png, jpg, or webp").
- Paper sanity rejection → inline prompt to re-tap; swatch marker is kept.
- Photo smaller than the sample patch → sample clamps to image bounds (5×5 shrinks at edges).
- No recipe on the color → verdict + comparison only, no nudge line.

## Testing

- `swatchCheck.test.ts` (node:test): known-cast fixtures — a warm-tinted (every channel of a
  neutral gray scaled by a warm gain) and cool-tinted photo pair of a known swatch color must
  correct back to within the "close" threshold of the true color; paper sanity rejections
  (dark paper, colored wall); verdict threshold boundaries; nudge rules — lighter/darker
  phrasing, no-white recipe variant, hue-direction wording, close-case line, and null without
  a recipe.
- Modal flow browser-verified (photo injection via DataTransfer, tap simulation, marker drag),
  like the rest of the app's UI.

## Non-goals

- No live viewfinder (getUserMedia), no flash control, no multi-swatch batch capture.
- No storing of photos or corrected colors; no calibration profiles (that's the separate
  "swatch calibration" roadmap item, still unscheduled).
- No claim of colorimetric accuracy — the language stays approximate everywhere.
