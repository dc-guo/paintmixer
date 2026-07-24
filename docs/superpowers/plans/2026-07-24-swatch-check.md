# Photo Swatch-Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user photograph a painted test swatch, correct it for lighting against a white-paper reference, and get a close/fair/far verdict plus one recipe nudge — all on-device, deterministic, no stored photos.

**Architecture:** A pure, fully-tested `swatchCheck.ts` library holds all the color logic (patch averaging, white-paper correction, verdict, nudge). A `SwatchCheckModal` component owns the camera/file input, canvas render, two-tap sampling, and result display, consuming only the library. A button in the workspace Starter-mix panel opens the modal for the selected color.

**Tech Stack:** React 19 + TypeScript, Vite, `node --test` via `tsconfig.test.json` (tests compile to `temp/test-dist`; sibling lib imports use the `.js` suffix). Plain CSS in `src/styles.css`.

**Spec:** `docs/superpowers/specs/2026-07-24-swatch-capture-design.md` (approved 2026-07-24).

## Deviations from spec (flagged for Diane — vetoable at plan handoff)

1. **Marker adjustment is tap-to-replace, not drag.** The spec said markers are "draggable to re-sample, same interaction as artwork markers." This plan uses a simpler, equally-functional flow: tap places the swatch point, tap places the paper point, and two "Adjust swatch" / "Adjust paper" controls re-arm a point for another tap. No pointer-drag code. Fully touch-friendly and easier to verify.
2. **The nudge line stays plain-words** ("a touch more blue would help") and does **not** name a carrier paint ("a touch more Ultramarine Blue"). The spec allowed naming a paint when the recipe has a single obvious carrier; that needs a paint-hue lookup for marginal gain. Dropped to keep `swatchCheck.ts` dependency-free and its tests clean.

Everything else follows the spec exactly.

## Global Constraints

- Design system: white ground, Palatino serif, terse copy. No gradients.
- **No CMYK, no Delta-E, no RGB values, no numbers in the UI.** Verdict is the words close / fair / far only.
- Deterministic color math, no AI, no network. The photo is processed in component state and dropped on close — never stored, never uploaded.
- No new npm dependencies. No route changes. No `lib/storage.ts` changes.
- Reference white for correction: `#F6F6F3`. Gains clamped to `[0.25, 4]`.
- Paper sanity: reject if linear luminance `< 0.25` (too dark) or linear `(max−min)/max > 0.25` (too saturated).
- Verdict reuses `confidenceForDistance` + `CONFIDENCE_LABEL` from `src/lib/paintMatching.ts` (thresholds HIGH_MAX=8, MEDIUM_MAX=18) — do not introduce new thresholds for the verdict.
- Standing copy in the modal: `Approximate — lighting still matters. The photo stays on your device.`
- Delivery: commits accumulate on `working`; STOP for Diane's UAT after the final task; no PR (one per phase).
- Gates every task: `npx tsc -b` clean and `npm test` all-pass before each commit.

**Existing helpers this feature builds on (verified signatures):**
- `src/types/color.ts`: `type RGB = { r: number; g: number; b: number }`
- `src/lib/deltaE.ts`: `srgbToLinear(channel: number): number`, `linearToSrgb(value: number): number` (returns a rounded 0–255 int), `rgbToLab(rgb: RGB): Lab`, `labDistance(a: Lab, b: Lab): number`, `colorDistance(a: RGB, b: RGB): number`; `type Lab = { l; a; b }`.
- `src/lib/paintMatching.ts`: `confidenceForDistance(distance: number): 'high'|'medium'|'low'`, `CONFIDENCE_LABEL = { high:'close', medium:'fair', low:'far' }`.
- `src/lib/color.ts`: `hexToRgb(hex): RGB | null`, `rgbToHex(rgb: RGB): string`.
- `src/hooks/useEscapeKey.ts`: `useEscapeKey(active: boolean, onClose: () => void)`.
- `src/types/paint.ts`: `MixRecipe` with `ingredients: Array<{ paintId; paintName; parts }>`.

---

### Task 1: `swatchCheck.ts` — patch averaging + white-paper correction

**Files:**
- Create: `src/lib/swatchCheck.ts`
- Test: `src/lib/swatchCheck.test.ts`

**Interfaces:**
- Consumes: `RGB` from `../types/color`; `srgbToLinear`, `linearToSrgb` from `./deltaE`.
- Produces (later tasks/tests rely on these exact names):
  - `averagePatch(data: Uint8ClampedArray, width: number, height: number, cx: number, cy: number, size?: number): RGB` — mean RGB of a `size`×`size` (default 5) patch centered on (cx, cy), clamped to image bounds.
  - `type PaperResult = { ok: true; corrected: RGB } | { ok: false; reason: 'too-dark' | 'too-saturated' }`
  - `correctForPaper(swatch: RGB, paper: RGB): PaperResult`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/swatchCheck.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { averagePatch, correctForPaper } from './swatchCheck.js';

// A 3x3 RGBA image: center pixel white, others black.
function grid3x3(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(3 * 3 * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * 3 + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  };
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      set(x, y, 0, 0, 0);
    }
  }
  set(1, 1, 255, 255, 255);
  return px;
}

test('averagePatch averages a patch, clamped to image bounds', () => {
  const px = grid3x3();
  // 3x3 patch over the whole image: one white pixel among nine → 255/9 ≈ 28.
  assert.deepEqual(averagePatch(px, 3, 3, 1, 1, 3), { r: 28, g: 28, b: 28 });
  // 1x1 patch on the white center.
  assert.deepEqual(averagePatch(px, 3, 3, 1, 1, 1), { r: 255, g: 255, b: 255 });
  // Patch centered at a corner still clamps (does not read out of bounds).
  const corner = averagePatch(px, 3, 3, 0, 0, 3);
  assert.ok(corner.r >= 0 && corner.r <= 255);
});

test('correctForPaper neutralizes a warm cast using the paper reference', () => {
  // A warm light makes neutral paper read warm (high R, low B) and tints the
  // swatch the same way. Correcting against the paper should pull the swatch
  // back toward its true neutral-gray self. The paper stays under the
  // too-saturated guard (linear (max-min)/max < 0.25) so it is accepted.
  const paper = { r: 245, g: 240, b: 225 }; // gently warm-tinted "white" paper
  const swatch = { r: 150, g: 140, b: 110 }; // a mid-gray under the same warm light
  const result = correctForPaper(swatch, paper);
  assert.ok(result.ok);
  if (result.ok) {
    // Removing a warm cast lifts blue and lifts it more than red.
    assert.ok(result.corrected.b > swatch.b, 'blue should be lifted');
    assert.ok(
      result.corrected.b - swatch.b > result.corrected.r - swatch.r,
      'blue should be lifted more than red',
    );
    const spread = Math.max(result.corrected.r, result.corrected.g, result.corrected.b) -
      Math.min(result.corrected.r, result.corrected.g, result.corrected.b);
    assert.ok(spread < 50, `corrected gray should read closer to neutral, spread was ${spread}`);
  }
});

test('correctForPaper is near-identity when the paper already reads neutral white', () => {
  const paper = { r: 246, g: 246, b: 243 }; // == reference white
  const swatch = { r: 120, g: 90, b: 60 };
  const result = correctForPaper(swatch, paper);
  assert.ok(result.ok);
  if (result.ok) {
    assert.ok(Math.abs(result.corrected.r - swatch.r) <= 3);
    assert.ok(Math.abs(result.corrected.g - swatch.g) <= 3);
    assert.ok(Math.abs(result.corrected.b - swatch.b) <= 3);
  }
});

test('correctForPaper rejects paper that is too dark', () => {
  const result = correctForPaper({ r: 100, g: 100, b: 100 }, { r: 60, g: 60, b: 60 });
  assert.deepEqual(result, { ok: false, reason: 'too-dark' });
});

test('correctForPaper rejects paper that is too saturated (a colored wall)', () => {
  const result = correctForPaper({ r: 100, g: 100, b: 100 }, { r: 220, g: 120, b: 90 });
  assert.deepEqual(result, { ok: false, reason: 'too-saturated' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module .../swatchCheck.js`. The existing 80 tests stay green.

- [ ] **Step 3: Write the implementation**

Create `src/lib/swatchCheck.ts`:

> **Import suffixes matter here.** `swatchCheck.ts` lives in `src/lib/**`, which the test
> config compiles and runs under Node's native ESM loader — so every *value* import of a sibling
> compiled module needs the `.js` suffix (`./deltaE.js`, `./paintMatching.js`). `import type`
> lines (RGB, MixRecipe) are erased at compile and need no suffix. `tsc` (Bundler resolution)
> will NOT catch a missing suffix; `npm test` will fail to load the module. Component `.tsx`
> files are the opposite — they are not in the test config, so they omit suffixes.

```ts
import type { RGB } from '../types/color';
import { linearToSrgb, srgbToLinear } from './deltaE.js';

/** Mean RGB of a size×size patch centered on (cx, cy), clamped to image bounds. */
export function averagePatch(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  size = 5,
): RGB {
  const half = Math.floor(size / 2);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = cy - half; y <= cy + half; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        continue;
      }
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
  }

  if (count === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

// Paper is not a perfect #FFFFFF; a near-white neutral avoids over-brightening.
const REFERENCE_WHITE: RGB = { r: 246, g: 246, b: 243 };
const PAPER_MIN_LUM = 0.25;
const PAPER_MAX_SAT = 0.25;
const GAIN_MIN = 0.25;
const GAIN_MAX = 4;

export type PaperResult = { ok: true; corrected: RGB } | { ok: false; reason: 'too-dark' | 'too-saturated' };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Von Kries-style per-channel correction: the white paper in the photo is a
 * known-neutral reference under the same light, so scaling the swatch by
 * reference-white ÷ paper (in linear RGB) removes the light's color cast.
 * Rejects a paper sample that is too dark or too colored to trust.
 */
export function correctForPaper(swatch: RGB, paper: RGB): PaperResult {
  const paperLin = { r: srgbToLinear(paper.r), g: srgbToLinear(paper.g), b: srgbToLinear(paper.b) };

  const lum = 0.2126 * paperLin.r + 0.7152 * paperLin.g + 0.0722 * paperLin.b;
  if (lum < PAPER_MIN_LUM) {
    return { ok: false, reason: 'too-dark' };
  }

  const maxLin = Math.max(paperLin.r, paperLin.g, paperLin.b);
  const minLin = Math.min(paperLin.r, paperLin.g, paperLin.b);
  if (maxLin > 0 && (maxLin - minLin) / maxLin > PAPER_MAX_SAT) {
    return { ok: false, reason: 'too-saturated' };
  }

  const refLin = {
    r: srgbToLinear(REFERENCE_WHITE.r),
    g: srgbToLinear(REFERENCE_WHITE.g),
    b: srgbToLinear(REFERENCE_WHITE.b),
  };

  const gain = {
    r: clamp(refLin.r / paperLin.r, GAIN_MIN, GAIN_MAX),
    g: clamp(refLin.g / paperLin.g, GAIN_MIN, GAIN_MAX),
    b: clamp(refLin.b / paperLin.b, GAIN_MIN, GAIN_MAX),
  };

  const swatchLin = { r: srgbToLinear(swatch.r), g: srgbToLinear(swatch.g), b: srgbToLinear(swatch.b) };

  return {
    ok: true,
    corrected: {
      r: linearToSrgb(clamp(swatchLin.r * gain.r, 0, 1)),
      g: linearToSrgb(clamp(swatchLin.g * gain.g, 0, 1)),
      b: linearToSrgb(clamp(swatchLin.b * gain.b, 0, 1)),
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass (80 existing + 5 new).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc -b
git add src/lib/swatchCheck.ts src/lib/swatchCheck.test.ts
git commit -m "Swatch check: patch averaging + white-paper correction"
```

---

### Task 2: `swatchCheck.ts` — verdict + nudge line

**Files:**
- Modify: `src/lib/swatchCheck.ts` (append)
- Modify: `src/lib/swatchCheck.test.ts` (append)

**Interfaces:**
- Consumes: `RGB` from `../types/color`; `rgbToLab`, `labDistance`, `colorDistance` from `./deltaE`; `confidenceForDistance`, `CONFIDENCE_LABEL` from `./paintMatching`; `MixRecipe` from `../types/paint`.
- Produces:
  - `type Verdict = 'close' | 'fair' | 'far'`
  - `swatchVerdict(corrected: RGB, target: RGB): Verdict`
  - `nudgeLine(corrected: RGB, target: RGB, recipe: MixRecipe | null): string | null` — `null` when `recipe` is `null`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/swatchCheck.test.ts`:

```ts
import { nudgeLine, swatchVerdict } from './swatchCheck.js';
import type { MixRecipe } from '../types/paint';

function recipeWith(names: string[]): MixRecipe {
  return {
    targetHex: '#000000',
    ingredients: names.map((paintName, i) => ({ paintId: `p${i}`, paintName, parts: 1 })),
    estimatedHex: '#000000',
    deltaE: 0,
    confidence: 'high',
    notes: [],
  };
}

test('swatchVerdict maps corrected-vs-target distance to close/fair/far', () => {
  assert.equal(swatchVerdict({ r: 100, g: 120, b: 140 }, { r: 100, g: 120, b: 140 }), 'close');
  // A large, obvious difference is far.
  assert.equal(swatchVerdict({ r: 20, g: 20, b: 20 }, { r: 240, g: 240, b: 240 }), 'far');
});

test('nudgeLine returns null when there is no recipe', () => {
  assert.equal(nudgeLine({ r: 200, g: 200, b: 200 }, { r: 100, g: 100, b: 100 }, null), null);
});

test('nudgeLine: swatch lighter than target, recipe has white → ease off the white', () => {
  const line = nudgeLine({ r: 210, g: 210, b: 210 }, { r: 120, g: 120, b: 120 }, recipeWith(['Titanium White', 'Mars Black']));
  assert.equal(line, 'Your swatch is lighter than the target — ease off the white.');
});

test('nudgeLine: swatch lighter, recipe has no white → add the darkest paint', () => {
  const line = nudgeLine({ r: 210, g: 210, b: 210 }, { r: 120, g: 120, b: 120 }, recipeWith(['Primary Blue', 'Primary Yellow']));
  assert.equal(line, 'Your swatch is lighter than the target — add a touch of the darkest paint.');
});

test('nudgeLine: swatch darker than target, recipe has white → add a little white', () => {
  const line = nudgeLine({ r: 120, g: 120, b: 120 }, { r: 210, g: 210, b: 210 }, recipeWith(['Titanium White', 'Mars Black']));
  assert.equal(line, 'Your swatch is darker than the target — add a little white.');
});

test('nudgeLine: hue gap dominant → plain-words direction toward the target', () => {
  // Same lightness, but the target is bluer than the swatch.
  const line = nudgeLine({ r: 150, g: 150, b: 120 }, { r: 150, g: 150, b: 210 }, recipeWith(['Titanium White']));
  assert.equal(line, 'A touch more blue would help.');
});

test('nudgeLine: already close → encouragement, no change', () => {
  const line = nudgeLine({ r: 150, g: 150, b: 150 }, { r: 150, g: 150, b: 150 }, recipeWith(['Titanium White']));
  assert.equal(line, 'Right in the neighborhood — paint a larger swatch and check in daylight.');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `nudgeLine`/`swatchVerdict` are not exported yet.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/swatchCheck.ts`:

```ts
import { CONFIDENCE_LABEL, confidenceForDistance } from './paintMatching.js';
import { colorDistance, labDistance, rgbToLab } from './deltaE.js';
import type { MixRecipe } from '../types/paint';

export type Verdict = 'close' | 'fair' | 'far';

/** Corrected swatch vs target in the same words the paint matcher uses. */
export function swatchVerdict(corrected: RGB, target: RGB): Verdict {
  return CONFIDENCE_LABEL[confidenceForDistance(colorDistance(corrected, target))];
}

const L_NUDGE = 3;
const C_NUDGE = 3;

// CIELAB a/b axes: +a red, +b yellow, −a green, −b blue. Six plain hue words at
// their a/b-plane angles; the nudge names whichever is nearest the gap direction.
const HUE_WORDS: Array<{ word: string; angle: number }> = [
  { word: 'red', angle: 0 },
  { word: 'orange', angle: 45 },
  { word: 'yellow', angle: 90 },
  { word: 'green', angle: 180 },
  { word: 'blue', angle: 270 },
  { word: 'purple', angle: 315 },
];

function nearestHueWord(da: number, db: number): string {
  const angle = ((Math.atan2(db, da) * 180) / Math.PI + 360) % 360;
  let best = HUE_WORDS[0];
  let bestDist = 360;
  for (const candidate of HUE_WORDS) {
    const raw = Math.abs(angle - candidate.angle);
    const dist = Math.min(raw, 360 - raw);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best.word;
}

/**
 * One plain-language suggestion for moving the mix toward the target, or null
 * when there is no recipe to nudge. Lightness gap wins first; then hue
 * direction; otherwise an "already close" encouragement.
 */
export function nudgeLine(corrected: RGB, target: RGB, recipe: MixRecipe | null): string | null {
  if (!recipe) {
    return null;
  }

  const swatchLab = rgbToLab(corrected);
  const targetLab = rgbToLab(target);
  const dLight = swatchLab.l - targetLab.l; // > 0 → swatch is lighter
  const da = targetLab.a - swatchLab.a; // direction FROM swatch TO target
  const db = targetLab.b - swatchLab.b;
  const chromaGap = labDistance({ l: swatchLab.l, a: swatchLab.a, b: swatchLab.b }, { l: swatchLab.l, a: targetLab.a, b: targetLab.b });

  const hasWhite = recipe.ingredients.some((ingredient) => /white/i.test(ingredient.paintName));

  if (Math.abs(dLight) >= L_NUDGE && Math.abs(dLight) >= chromaGap) {
    if (dLight > 0) {
      return hasWhite
        ? 'Your swatch is lighter than the target — ease off the white.'
        : 'Your swatch is lighter than the target — add a touch of the darkest paint.';
    }
    return hasWhite
      ? 'Your swatch is darker than the target — add a little white.'
      : 'Your swatch is darker than the target — ease off the darkest paint.';
  }

  if (chromaGap >= C_NUDGE) {
    return `A touch more ${nearestHueWord(da, db)} would help.`;
  }

  return 'Right in the neighborhood — paint a larger swatch and check in daylight.';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass (85 existing + 7 new).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc -b
git add src/lib/swatchCheck.ts src/lib/swatchCheck.test.ts
git commit -m "Swatch check: verdict and one-line recipe nudge"
```

---

### Task 3: `SwatchCheckModal` component + styles

**Files:**
- Create: `src/components/SwatchCheckModal.tsx`
- Modify: `src/styles.css` (append a `/* ---------- swatch check ---------- */` block)

**Interfaces:**
- Consumes: `averagePatch`, `correctForPaper`, `swatchVerdict`, `nudgeLine`, `PaperResult` from `../lib/swatchCheck`; `hexToRgb`, `rgbToHex` from `../lib/color`; `useEscapeKey` from `../hooks/useEscapeKey`; `MixRecipe` from `../types/paint`.
- Produces: `SwatchCheckModal({ targetHex, recipe, onClose }: { targetHex: string; recipe: MixRecipe | null; onClose: () => void })` — a self-contained modal. Mounted by Task 4.

No unit test (repo has no DOM test rig); the logic is all in the tested library. Browser-verified in Task 5.

- [ ] **Step 1: Write the component**

Create `src/components/SwatchCheckModal.tsx`:

```tsx
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { hexToRgb, rgbToHex } from '../lib/color';
import { averagePatch, correctForPaper, nudgeLine, swatchVerdict } from '../lib/swatchCheck';
import type { PaperResult } from '../lib/swatchCheck';
import type { MixRecipe } from '../types/paint';
import type { RGB } from '../types/color';
import { useEscapeKey } from '../hooks/useEscapeKey';

type Phase = 'swatch' | 'paper' | 'result';
type Point = { x: number; y: number };

type SwatchCheckModalProps = {
  targetHex: string;
  recipe: MixRecipe | null;
  onClose: () => void;
};

const PROMPT: Record<Phase, string> = {
  swatch: 'Tap your painted swatch.',
  paper: 'Tap a clean bit of the paper.',
  result: '',
};

export function SwatchCheckModal({ targetHex, recipe, onClose }: SwatchCheckModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('swatch');
  const [swatchPoint, setSwatchPoint] = useState<Point | null>(null);
  const [paperPoint, setPaperPoint] = useState<Point | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEscapeKey(true, onClose);

  const targetRgb = hexToRgb(targetHex);

  const loadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(typeof reader.result === 'string' ? reader.result : null);
      setPhase('swatch');
      setSwatchPoint(null);
      setPaperPoint(null);
    };
    reader.readAsDataURL(file);
  };

  const drawImage = (url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const image = new Image();
    image.onload = () => {
      const maxW = 460;
      const scale = Math.min(1, maxW / image.naturalWidth);
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = url;
  };

  const sampleAt = (point: Point): RGB | null => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return null;
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return averagePatch(data, canvas.width, canvas.height, Math.round(point.x), Math.round(point.y), 5);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || phase === 'result') {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
    if (phase === 'swatch') {
      setSwatchPoint(point);
      setPhase('paper');
    } else if (phase === 'paper') {
      setPaperPoint(point);
      setPhase('result');
    }
  };

  // Result is derived on render from the two sample points.
  let paper: PaperResult | null = null;
  let verdict: 'close' | 'fair' | 'far' | null = null;
  let correctedHex: string | null = null;
  let nudge: string | null = null;

  if (phase === 'result' && swatchPoint && paperPoint && targetRgb) {
    const swatchRgb = sampleAt(swatchPoint);
    const paperRgb = sampleAt(paperPoint);
    if (swatchRgb && paperRgb) {
      paper = correctForPaper(swatchRgb, paperRgb);
      if (paper.ok) {
        verdict = swatchVerdict(paper.corrected, targetRgb);
        correctedHex = rgbToHex(paper.corrected);
        nudge = nudgeLine(paper.corrected, targetRgb, recipe);
      }
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        aria-label="Check a painted swatch"
        className="swatch-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="swatch-modal-head">
          <p className="eyebrow">Check a painted swatch</p>
          <button className="secondary-button" onClick={onClose} type="button">
            Close
          </button>
        </header>

        {!imageUrl ? (
          <label className="swatch-pick">
            <span>Take or choose a photo of your painted swatch on white paper.</span>
            <input accept="image/*" capture="environment" onChange={loadFile} type="file" />
          </label>
        ) : (
          <>
            {phase !== 'result' ? <p className="swatch-prompt">{PROMPT[phase]}</p> : null}
            <div className="swatch-canvas-wrap">
              <canvas
                className="swatch-canvas"
                onClick={handleCanvasClick}
                ref={(node) => {
                  canvasRef.current = node;
                  if (node && imageUrl) {
                    drawImage(imageUrl);
                  }
                }}
              />
            </div>

            {phase === 'result' ? (
              <div className="swatch-result">
                {!targetRgb ? (
                  <p className="empty-state">Select a color first.</p>
                ) : paper && !paper.ok ? (
                  <p className="quiet-note">
                    That doesn't look like white paper — <button className="text-link" onClick={() => setPhase('paper')} type="button">tap a cleaner spot</button>.
                  </p>
                ) : verdict && correctedHex ? (
                  <>
                    <div className="mix-compare">
                      <span aria-label={`Target color ${targetHex}`} className="half" style={{ backgroundColor: targetHex }} />
                      <span aria-hidden className="arrow">→</span>
                      <span aria-label="Your swatch, corrected" className="half" style={{ backgroundColor: correctedHex }} />
                    </div>
                    <div className="mix-labels">
                      <span className="micro">Target</span>
                      <span className="micro">Your swatch</span>
                    </div>
                    <p className={`swatch-verdict ${verdict}`}>{verdict}</p>
                    {nudge ? <p className="quiet-note">{nudge}</p> : null}
                  </>
                ) : null}

                <div className="swatch-adjust">
                  <button className="text-link" onClick={() => setPhase('swatch')} type="button">Adjust swatch</button>
                  <button className="text-link" onClick={() => setPhase('paper')} type="button">Adjust paper</button>
                  <button className="text-link" onClick={() => setImageUrl(null)} type="button">Check another</button>
                </div>
              </div>
            ) : null}

            <p className="swatch-foot micro">Approximate — lighting still matters. The photo stays on your device.</p>
          </>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Append the styles**

Append to `src/styles.css`, immediately before the `/* ---------- responsive ---------- */` section:

```css
/* ---------- swatch check ---------- */

.swatch-modal {
  width: min(520px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  border-radius: 20px;
  padding: 24px 26px;
  background: var(--card);
}

.swatch-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.swatch-modal-head .secondary-button {
  margin-top: 0;
}

.swatch-pick {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
  padding: 22px 0 8px;
  color: var(--ink-soft);
  font-style: italic;
  font-size: 0.92rem;
}

.swatch-prompt {
  margin: 4px 0 12px;
  color: var(--ink);
  font-style: italic;
  font-size: 0.95rem;
}

.swatch-canvas-wrap {
  display: flex;
  justify-content: center;
}

.swatch-canvas {
  max-width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: crosshair;
}

.swatch-result {
  margin-top: 16px;
}

.swatch-verdict {
  margin: 14px 0 0;
  font-style: italic;
  font-size: 1.1rem;
  text-transform: capitalize;
}

.swatch-verdict.close {
  color: var(--accent);
}

.swatch-verdict.fair {
  color: var(--clay);
}

.swatch-verdict.far {
  color: var(--danger);
}

.swatch-adjust {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 16px;
}

.swatch-foot {
  display: block;
  margin-top: 16px;
  text-transform: none;
  letter-spacing: 0.02em;
  font-style: italic;
  color: var(--ink-faint);
}
```

- [ ] **Step 3: Typecheck (component compiles; nothing mounts it yet)**

Run: `npx tsc -b` — clean; `npm test` — all pass, unchanged count.

- [ ] **Step 4: Commit**

```bash
git add src/components/SwatchCheckModal.tsx src/styles.css
git commit -m "Swatch check: photo modal with two-tap sampling and verdict"
```

---

### Task 4: Wire into the workspace Starter-mix panel

**Files:**
- Modify: `src/pages/WorkspacePage.tsx`

**Interfaces:**
- Consumes: `SwatchCheckModal` (Task 3); the page already has `activeColor`, `preview`, `ownedPaints`, `suggestMixes`, `hexToRgb`.
- Produces: a "Check a painted swatch" button in the Starter-mix panel (shown when `activeColor && !preview`) that opens the modal with the active color's hex and its resolved recipe.

- [ ] **Step 1: Add modal state and the resolved active recipe**

In `src/pages/WorkspacePage.tsx`, add near the other `useState` hooks (alongside `labelDraft`/`notesDraft`):

```ts
const [isSwatchCheckOpen, setIsSwatchCheckOpen] = useState(false);
```

Add a memo for the active color's current recipe, next to the existing `previewRecipe` memo (it mirrors the same resolution the MixEditor does — preferred wins, else one live suggestion):

```ts
const activeRecipe = useMemo(() => {
  if (!activeColor) {
    return null;
  }
  if (activeColor.preferredRecipe) {
    return activeColor.preferredRecipe;
  }
  const rgb = hexToRgb(activeColor.hex);
  return rgb && ownedPaints.length > 0 ? suggestMixes(rgb, ownedPaints, 1)[0] ?? null : null;
}, [activeColor, ownedPaints]);
```

- [ ] **Step 2: Add the button in the Starter-mix panel**

In the Starter-mix `<article>`, inside the `activeColor ? (...)` branch that renders `<MixEditor .../>`, wrap the editor and add the button beneath it:

```tsx
) : activeColor ? (
  <>
    <MixEditor
      footnote="Approximate · test a swatch first"
      onPreferredChange={(recipe) => onSetColorRecipe(activeColor.id, recipe)}
      ownedPaints={ownedPaints}
      preferred={activeColor.preferredRecipe ?? null}
      targetHex={activeColor.hex}
    />
    <button
      className="secondary-button"
      onClick={() => setIsSwatchCheckOpen(true)}
      type="button"
    >
      Check a painted swatch
    </button>
  </>
) : null}
```

- [ ] **Step 3: Mount the modal**

Add the import at the top: `import { SwatchCheckModal } from '../components/SwatchCheckModal';`

Mount it alongside the inventory drawer (just before the closing `</div>` of `.page`, next to the `{isInventoryOpen ? ... : null}` block):

```tsx
{isSwatchCheckOpen && activeColor ? (
  <SwatchCheckModal
    onClose={() => setIsSwatchCheckOpen(false)}
    recipe={activeRecipe}
    targetHex={activeColor.hex}
  />
) : null}
```

- [ ] **Step 4: Gates and a quick smoke check**

Run: `npx tsc -b` — clean; `npm test` — all pass.
Dev server (`preview_start paintbridge-dev`): upload an image, own paints, select a color → the Starter-mix panel shows "Check a painted swatch" → clicking opens the modal with the file picker. (Full sampling flow is verified in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/WorkspacePage.tsx
git commit -m "Swatch check: open from the workspace Starter-mix panel"
```

---

### Task 5: Browser verification pass

**Files:** none (verification only; fix-and-recommit anything found).

- [ ] **Step 1: Start the dev server** (`preview_start paintbridge-dev`), upload an artwork, mark a few owned paints, select a palette color with a recipe.

- [ ] **Step 2: Open the modal, inject a swatch photo.** Click "Check a painted swatch". Inject a canvas-generated PNG into the modal's file input (DataTransfer + `change`) — make it a two-region image: a mid-gray swatch area on a near-white paper area. Verify the prompt reads "Tap your painted swatch."

- [ ] **Step 3: Two-tap flow.** Click the swatch region (prompt advances to "Tap a clean bit of the paper."), then click the paper region → result panel appears with: target-vs-corrected comparison strip, a one-word verdict (close/fair/far) styled, and — since the color has a recipe — a nudge line. Confirm NO numbers/RGB/Delta-E anywhere.

- [ ] **Step 4: Paper rejection.** "Adjust paper", tap the dark swatch region as if it were paper → the "That doesn't look like white paper — tap a cleaner spot" message appears instead of a verdict.

- [ ] **Step 5: No-recipe path.** Close, select a color with no workable mix (or remove owned paints), reopen → verdict shows with no nudge line.

- [ ] **Step 6: Escape + backdrop close, and photo-not-persisted.** Escape closes; reopening starts fresh (no leftover photo). Confirm nothing was written to `localStorage` (`paintbridge.*` keys unchanged).

- [ ] **Step 7: Mobile width** (375px): modal fits, canvas scales, no horizontal page scroll.

- [ ] **Step 8: Final gates and closing commit.** `npx tsc -b` and `npm test`. Commit any verification fixes separately. Then **STOP for Diane's UAT** — no PR.

---

## Self-review notes (already applied)

- **Spec coverage:** entry point (Task 4) · camera/file input, no getUserMedia (Task 3) · two-tap swatch+paper (Task 3) · white-paper correction + sanity reject (Task 1) · verdict via existing thresholds (Task 2) · nudge rules incl. lighter/darker/hue/close and null-without-recipe (Task 2) · comparison strip + confidence word, no numbers (Task 3) · standing copy (Task 3) · no storage/route/deps (all) · edge cases: paper reject, no recipe, small photo/edge clamp (Tasks 1–3), non-image file handled by the FileReader path (Task 3).
- **Deviations** (drag→tap, plain-words nudge) are recorded at the top and surfaced to Diane at handoff — not silent.
- **Type consistency:** `PaperResult`, `Verdict`, `averagePatch`, `correctForPaper`, `swatchVerdict`, `nudgeLine` are used identically across Tasks 1–4. `linearToSrgb` returns a 0–255 int, so corrected channels are already `RGB`-valid.
- **Reused thresholds:** verdict goes through `confidenceForDistance`; no parallel verdict thresholds introduced. `L_NUDGE`/`C_NUDGE` are nudge-only and don't touch the verdict.
