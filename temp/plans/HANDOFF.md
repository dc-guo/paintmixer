# PaintBridge — Session Handoff (2026-07-07)

Read this first, then `CODEX_CONTEXT.md` (product source of truth) and
`PHASE_2_COLOR_TOOLS.md` (current phase plan) in this folder. Claude's project
memory also carries the design/process rules.

## What this is

PaintBridge: a public, local-first web app that turns digital artwork into
Liquitex BASICS acrylic paint decisions — extract palette from an image,
match to paints, get mix recipes, save/export palettes.

- **Live:** https://dc-guo.github.io/paintmixer/ (GitHub Pages; merge to `main` deploys)
- **Repo:** https://github.com/dc-guo/paintmixer (public; no LICENSE = all rights reserved)
- **Stack:** Vite + React 19 + TypeScript, plain CSS, no backend. localStorage
  behind `src/lib/storage.ts` (future Supabase swap point). Hash routing in `App.tsx`.

## Where we are: Phase 2 (richer color tools), mid-flight

| Milestone | Status |
|---|---|
| 2.1 Full 72-color BASICS library | ✅ shipped via PR #2 (predates the batching rule) |
| 2.2 Kubelka–Munk mixing + tinting strength + glaze notes | ✅ on `working`, UAT-approved (after 2 UAT fixes: pale tints keep hue via 8:1/12:1 ratios + hueless penalty; semi-transparents count toward glaze) |
| 2.3 Recipe alternates + live ratio steppers + persisted `preferredRecipe` | ✅ on `working`, UAT-approved ("lgtm") |
| 2.4 Extraction upgrades (palette-size control 3–8, deterministic k-means in Lab, stretch: region re-extract) | ⬜ NEXT |
| 2.5 Palette housekeeping (name colors, reorder, duplicate palette) | ⬜ after 2.4 (or swap order if Diane asks) |

**Then:** high-effort multi-agent code review over the accumulated diff (8 finder
angles + verifiers, like the MVP review), apply fixes, and open ONE PR for the
whole phase. Merging deploys.

## Process rules (Diane's explicit instructions — do not drift)

1. Milestones accumulate as commits on `working`. **No PR per milestone** — one
   PR at the end of the phase, gated by the high-effort review.
2. **After each milestone commit, STOP for Diane's UAT** — hand her a short
   test script for localhost:5173, wait for her verdict before the next milestone.
3. Verify before every commit: `npm test` (tsc + node --test), plus in-browser
   verification via the preview tools (`paintbridge-dev` in .claude/launch.json).
   Mix-search perf budget ~50ms worst-case (currently 58ms with all 72 owned — accepted).
4. Git: repo-local identity is set to Diane's GitHub noreply email. Commit
   trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. `main` is
   branch-protected (CI `test` check). `gh` CLI is NOT installed — use the
   GitHub REST API with the stored git credential
   (`printf 'protocol=https\nhost=github.com\n' | git credential fill`).

## Product/design rules (settled — don't re-litigate)

- Liquitex BASICS only, ever. Deterministic color math, no AI.
- No jargon in UI: no CMYK, no ΔE (export-only). Mixes = parts ratios;
  confidence = close/fair/far. Approximation language everywhere.
- Design: white ground, Palatino serif stack, muted slate accent (#56707E),
  terse copy. Tokens in `src/styles.css`.
- Storage schema changes must be backward compatible (optional fields;
  loaders shape-validate).

## Architecture crib sheet

- `src/App.tsx` — routing (`#/`, `#/workspace`, `#/palettes`, `#/palettes/:id`),
  all shared state (workingColors, activeColorId, savedPalettes, ownedPaintIds,
  editingPaletteId), save/update/edit-in-workspace logic.
- `src/pages/` — StartPage, WorkspacePage (canvas + markers + inspector),
  PalettesPage (gallery), PaletteDetailPage (blocks, mix rows, modal).
- `src/components/` — ImageColorPicker (draggable/arrow-key markers, click =
  preview), MixEditor (alternates + steppers, used in workspace card AND detail
  modal), MixComparison, WorkingPaletteStrip, ImageUploader, ManualColorInput.
- `src/lib/` — color (hex/RGB, viability, isLightColor, formatRgb), deltaE
  (Lab, labDistance), mixing (Kubelka–Munk K/S), recipeEngine (suggestMixes,
  buildRecipe, estimateMix, notes; ratio set includes 8:1/12:1; hueless penalty),
  paletteExtraction (bins + positions), paintMatching (CONFIDENCE_LABEL),
  paintUsage, paletteSummary (mixSteps, describeMix, buildPaletteSummary),
  storage, format, thumbnails, loadImage; hooks/useEscapeKey.
- `src/data/liquitexBasics.ts` — 72 paints, opacity + sourceNote on all,
  tintingStrength on 15, pigment codes where confident. IDs are stable API
  (stored in localStorage) — never rename without migration.
- Tests: 43 in `src/lib/*.test.ts` via `npm test`. Custom assert stub in
  `src/testing/node-test.d.ts` (extend it when using new assert methods).
- localStorage keys: `paintbridge.savedPalettes.v1`, `paintbridge.ownedPaints.v1`.

## Known caveats / parked items

- Edit-in-workspace uses the stored 480px thumbnail as canvas (original isn't
  persisted); thumbnail reuse prevents re-compression on update.
- Quota fallback silently drops artwork thumbnails from persisted palettes
  (in-memory keeps them until reload) — accepted for now.
- Rare async race: re-generate count/active-id can be off if a duplicate hex is
  added mid-extraction — accepted.
- 2.4 stretch (region re-extraction) is skip-by-default unless Diane asks.

## Pick up here

Start milestone **2.4** per `PHASE_2_COLOR_TOOLS.md`: palette-size control
(3–8, default 5, persisted preference), deterministic k-means in Lab seeded
from the current bin picks (markers/positions must keep working — tests exist),
then UAT handoff. After 2.5 + review + phase PR, next horizon is Phase 3
(Supabase accounts: email verification + TOTP 2FA, sync behind storage.ts).
