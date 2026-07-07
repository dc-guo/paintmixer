# Phase 2 — Richer Color Tools

Implementation plan for the first post-launch phase (see CODEX_CONTEXT.md §19, decisions #13–14).
Written 2026-07-07. Prerequisite state: MVP live at https://dc-guo.github.io/paintmixer/,
38-paint seed library, linear-RGB mix estimation, single suggested recipe per color.

Standing constraints for every milestone:

- Liquitex BASICS only (decision #14).
- Deterministic color math, no AI (guardrail 4). No random seeding that changes results between runs.
- Approximation language everywhere; no CMYK or delta-E in the UI (decision #11) — confidence is
  always close/fair/far, mixes are always parts ratios.
- Design system: white ground, Palatino serif, muted slate accent, terse copy (memory + §10).
- Workflow: build on `working`, PR to `main`, CI green, browser-verify before merge. Merging deploys.
- localStorage schema changes must be backward compatible (new fields optional; loaders already
  shape-validate). `lib/storage.ts` stays the single persistence seam for the later Supabase swap.

---

## Milestone 2.1 — Full, validated Liquitex BASICS library

**Goal:** grow `src/data/liquitexBasics.ts` from 38 curated colors to the complete current BASICS
range (~72 colors per the current product line; confirm the exact count against the official color
chart at implementation time), with every value traceable to a source.

**Method:**

1. Pull the official Liquitex BASICS color chart (and 1–2 retailer swatch pages as cross-checks).
2. Sample each swatch to sRGB hex — our own `extractPaletteFromPixels` tooling can do the sampling
   from chart images; average across sources where they disagree.
3. Record per paint: validated `hex`, `opacity` (the official chart lists opacity ratings),
   `pigmentNotes` (pigment index codes, e.g. PW6, PB29 — feeds Milestone 2.2), and a new optional
   `sourceNote` string naming where the value came from.
4. Keep the file-header honesty comment: values are screen approximations of printed/photographed
   swatches, not manufacturer color data.

**Files:** `src/data/liquitexBasics.ts`, `src/types/paint.ts` (add `sourceNote?`), test updates.

**Acceptance:**
- Library covers the full current BASICS range; every paint has `opacity` and `sourceNote`.
- Tests: unique ids, valid normalized hexes, count ≥ 60, every entry has an opacity rating.
- Inventory drawer stays usable at ~72 rows (search already exists; verify scroll/perf).
- Existing owned-paint ids keep working (no id renames without a storage migration).

**Risk:** no official digital color values exist. Mitigation: multi-source sampling + sourceNote
per entry; the product already frames everything as approximate.

---

## Milestone 2.2 — Opacity-aware mixing model

**Goal:** replace the linear-RGB average with a subtractive-leaning estimate that uses the
per-paint data from 2.1, so predicted mixes behave more like paint (blue + yellow → green-ish,
not gray) and opacity influences guidance.

**Approach (in order, each gated by tests):**

1. **Kubelka–Munk single-constant mixing:** per channel, convert linear reflectance R to
   K/S = (1 − R)² / 2R; mix K/S weighted by parts; invert back. This is the standard cheap
   approximation when per-pigment K and S are unmeasured. Precompute per-paint K/S alongside the
   existing linearization (the 2.x hot-loop precompute pattern in `suggestMixes` carries over).
2. **Tinting strength:** optional `tintingStrength?` multiplier on `Paint` (default 1), applied to
   parts inside the estimate only. Seed rough values (blacks/phthalos strong ~3, whites weak ~0.5),
   labeled approximate. This is why 1 part black overwhelms 6 parts white in real life.
3. **Opacity in guidance:** extend `buildNotes` — high-proportion transparent paints get a
   glazing/undertone note; the existing white-folding and lightness-gap notes adapt to the new
   estimator unchanged.

**Files:** `src/lib/deltaE.ts` (K/S helpers), `src/lib/recipeEngine.ts`, `src/types/paint.ts`,
`src/data/liquitexBasics.ts` (tinting seeds), tests.

**Acceptance (sanity tests, not exactness):**
- Primary blue + primary yellow estimate is greener than the linear-RGB average of the two.
- Complementary mixes desaturate; white raises Lab L; 1 part black + 6 parts white lands notably
  darker than the parts-weighted linear average.
- All existing recipe-engine tests still pass (thresholds may need retuning — keep them tunable).
- Perf: full-library-owned mix search stays under ~50 ms on desktop (measure before/after).

**Non-goal:** measured pigment K/S data or ICC anything. This stays a planning estimate.

---

## Milestone 2.3 — Recipe interaction (alternates + live tweaking)

**Goal:** stop hiding the engine's output — it already returns up to 3 distinct recipes; show them,
and let the user adjust ratios with a live preview.

**Design:**

1. **Alternates:** workspace Starter-mix card and the how-to-mix modal list 2–3 recipes as
   selectable rows (paint-set label + confidence tag). Selecting one swaps the pills, comparison
   strip, and steps.
2. **Live ratio tweaking:** per-ingredient − / + steppers (1–6 parts, keyboard accessible) in the
   modal. Each change re-estimates the mix (single `estimateMix` call — cheap) and live-updates
   the likely-mix swatch and confidence word.
3. **Persist the chosen mix:** `SampledColor` gains optional `preferredRecipe?: MixRecipe`.
   Saving/updating a palette stores it; the detail page, usage donut, JSON export, and copy-summary
   all prefer it over the live suggestion (falling back to suggestion when absent). "Reset to
   suggested" affordance in the modal.

**Files:** `src/lib/recipeEngine.ts` (export a single-candidate `estimateMix`), `src/types/palette.ts`,
`src/pages/WorkspacePage.tsx`, `src/pages/PaletteDetailPage.tsx`, `src/lib/paintUsage.ts` +
`paletteSummary.ts` (prefer stored recipe), storage stays compatible (optional field).

**Acceptance:**
- Alternates show genuinely distinct paint sets (engine already dedups); selection updates
  everything in the card/modal.
- Stepper changes update the preview instantly with no visible lag.
- An adjusted recipe survives save → reload and shows up in the donut, export, and summary.
- Old saved palettes (no `preferredRecipe`) behave exactly as today.

---

## Milestone 2.4 — Extraction upgrades

**Goal:** better starting palettes, user control over size.

1. **Palette size control:** a small stepper next to "Re-generate" (3–8 colors, default 5).
   `extractPaletteFromDataUrl(dataUrl, n)` already takes the count — this is mostly UI + plumbing
   the choice through `App.autoGeneratePalette`/`selectArtwork` (persist the preference in
   localStorage via a new `loadStoredArray`-style helper or a simple settings key).
2. **Better clustering:** upgrade `extractPaletteFromPixels` from frequency-bins + greedy
   separation to k-means in Lab space, deterministically seeded from the current top-bin picks
   (no randomness — guardrail 4). Keep the representative-position output (centroid + first-pixel
   fallback) so markers keep working.
3. **Stretch (own PR, only if 1–2 land well):** region re-extraction — drag a box on the artwork
   to extract that region's dominant color as a new palette entry.

**Files:** `src/lib/paletteExtraction.ts`, `src/lib/storage.ts` (settings key),
`src/pages/WorkspacePage.tsx`, `src/App.tsx`, tests (band/position tests updated for k-means).

**Acceptance:**
- Same image + same settings always yields the same palette (determinism test).
- Position/marker tests still pass; markers land inside their color's region.
- Manual check on 2–3 real photos: k-means palette visibly beats the current one (fewer
  near-duplicate neutrals, better coverage of small-but-salient colors).

---

## Milestone 2.5 — Palette housekeeping (small, can land anytime)

1. **Name colors:** `SampledColor.label?` — editable in the inspector and how-to-mix modal; shown
   under the hex on swatches/detail; used in the copy-summary ("Sky — #89C5F4 — 2 parts…").
2. **Reorder colors:** move-left/right controls on the active swatch (keyboard: arrow keys already
   nudge markers, so use explicit buttons to avoid a conflict).
3. **Duplicate palette:** action on the detail page (copies colors + artwork thumbnail, fresh id,
   "Copy of …" name).

**Files:** `src/types/palette.ts`, `WorkingPaletteStrip`, `WorkspacePage`, `PaletteDetailPage`,
`paletteSummary`, `App.tsx`. All storage changes optional-field only.

**Acceptance:** labels persist and appear in exports; reorder persists; duplicate is independent
(editing the copy never touches the original).

---

## Sequencing

```
2.1 library ──► 2.2 mixing model ──► 2.3 recipe interaction
                                          │
2.5 housekeeping (anytime) ◄──────────────┘
2.4 extraction (independent, after 2.1 for eyeballing against real paints)
```

One milestone = one PR (2.4's stretch item separately). Each lands with tests, a browser
verification pass, and CI green before merge. Estimated effort: 2.1 and 2.2 are the heavy ones;
2.3–2.5 are UI-weight.

## Open questions for Diane (defaults if unanswered)

1. Default extraction size stays 5? (default: yes)
2. Alternates in the workspace card too, or modal-only? (default: both, compact in the card)
3. Region re-extraction worth the stretch? (default: skip until asked)
