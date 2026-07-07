# PaintBridge PWA — Codex Project Context

## Purpose of this document

This file is intended to be placed in the root of a new project and read by Codex before implementation begins.

Codex should treat this as the product, project, and engineering context for building a demoable POC/MVP.

---

# 1. Product Summary

## Working name

**PaintBridge PWA**

Alternative names:
- Acrylic Match
- PaintMix Studio
- Color-to-Acrylic

## Mission

Create a PWA that helps digital artists confidently translate digital color into physical acrylic paint by showing what colors are printable/paintable, which close alternatives are realistic, and how to mix target colors using the paints they already own.

## Product wedge

A **digital-to-Liquitex BASICS acrylic transfer assistant**.

This wedge is a positioning and prioritization lens, not a feature cut. The app should still preserve the original full workflow as much as possible:

```txt
digital artwork
→ color selection
→ RGB/CMYK print viability
→ Liquitex BASICS acrylic approximation
→ owned-paint starter mix
→ saved/exportable project palette
```

## North Star

Reduce the gap between **“what I see on screen”** and **“what I can actually paint.”**

## MVP objective

Build a demoable PWA where a user can:

1. Upload digital artwork.
2. Pick a color from the image.
3. See the selected RGB/hex color.
4. See an approximate CMYK/print-safe version.
5. Compare the digital target against Liquitex BASICS acrylic colors.
6. Select which Liquitex BASICS paints they own.
7. Receive a practical starter mix using only owned paints.
8. Save/export a project palette.

The MVP should be useful even if color science is approximate. The product must not claim exact physical accuracy.

---

# 2. User Need

## Original user need

An artist drew something digitally and wants to transfer it to print/physical acrylic painting. The artist understands that RGB screen colors may not translate cleanly to CMYK print or acrylic paint. They want to know:

- How close the desired digital color is to a realistic print/paint version.
- Which Liquitex BASICS acrylic color is closest.
- How to mix the color using the paints they already own.
- Eventually, how opacity and translucency affect the result.

## Primary user

A digital artist, student artist, hobbyist, or beginner/intermediate acrylic painter who uses affordable acrylic paints such as Liquitex BASICS.

## Primary job-to-be-done

When I choose a color from my digital artwork, I want to know the closest realistic acrylic paint version and how to mix it using my available paints, so I can paint the piece with less trial and error.

---

# 3. Competitive Differentiation

There are existing paint/color mixing tools. This project should not position itself as a generic color mixer.

The differentiation is:

## 1. Liquitex BASICS-first

The app starts with the actual paint line the user is likely using.

## 2. Digital-to-print-to-paint workflow

The app explicitly bridges:

```txt
RGB digital color → approximate CMYK/print-safe version → acrylic paint/mix approximation
```

## 3. Owned-paint inventory

Recommendations should be based on what the user already has, not only ideal theoretical paints.

## 4. Honest approximation language

The app should say:
- closest approximation
- starter mix
- likely result
- confidence estimate
- test a small swatch first

The app should not say:
- exact formula
- perfect match
- guaranteed result
- printer accurate
- scientifically exact

## 5. Beginner-friendly acrylic workflow

The target user needs practical guidance, not a pigment-science dashboard.

---

# 4. MVP Scope

## Must-have features

### A. Artwork upload

- User can upload a PNG/JPG/WebP image.
- Image displays in the app.
- On upload, the app auto-generates a starting palette (~6 dominant, visually distinct colors) so the user has something to work with immediately. Deterministic local extraction, no AI.
- User can click or tap on the image to sample additional colors.
- App shows the sampled color as hex, RGB, and preview swatch.

### B. Manual color input

- User can manually enter a hex color.
- App validates the input.
- App updates the target color preview.

### C. RGB → CMYK approximation

- App shows approximate CMYK values.
- App shows a “print-adjusted” preview.
- App flags highly saturated colors as likely difficult to reproduce in print/paint.
- This should be framed as an approximation, not printer-profile-accurate conversion.

### D. Liquitex BASICS paint library

App includes a seed library of Liquitex BASICS acrylic colors.

Each paint record should have:

- `id`
- `name`
- `brand`
- `hex`
- `rgb`
- optional `pigmentNotes`
- optional `opacity`
- owned state handled separately

For the POC, use a curated seed set. Full production-grade color validation can come later.

### E. Paint inventory

- User can mark which paints they own.
- Inventory persists locally.
- App can filter recommendations to owned paints only.

### F. Closest paint match

App calculates closest Liquitex BASICS colors to the selected target.

Show top 3–5 matches:

- paint name
- swatch
- approximate color difference
- match confidence: high / medium / low
- owned/not owned badge

### G. Starter mix engine

App generates a suggested starter mix using owned paints.

Output should include:

- “Suggested starter mix”
- approximate ratio
- expected result preview
- adjustment notes
- confidence

Recipes should be simple, usually 2–4 colors.

### H. Project palette

User can save a sampled color to a project palette.

Each saved palette item includes:

- original target color
- print-adjusted approximation
- closest paint match
- starter mix
- notes/confidence

Palette persists locally.

User can export palette as JSON or copy a plain-English summary.

### I. PWA behavior

- App should be installable.
- App should have app name, icon placeholders, theme color, and manifest.
- App should cache enough assets to load offline after first visit.
- Image processing should stay local in browser.

---

# 5. Non-Goals for POC

Do not build these in the first POC unless explicitly requested later:

- User accounts
- Cloud sync
- Payments/subscriptions
- Multi-brand paint support beyond placeholders
- Full ICC printer profile support
- Camera swatch calibration
- AI-generated painting critique
- Social sharing
- Marketplace paint purchasing
- Backend database
- Mobile native app wrapper
- Perfect pigment-physics simulation

---

# 6. Product Guardrails

## Guardrail 1: Never overclaim accuracy

Use approximation language throughout the product.

Good language:

- “Closest acrylic approximation”
- “Suggested starter mix”
- “Likely result”
- “Confidence estimate”
- “Test a small swatch first”

Avoid:

- “Exact match”
- “Perfect recipe”
- “Guaranteed color”
- “Printer accurate”
- “Scientifically exact”

## Guardrail 2: Keep the original vision intact

The Liquitex BASICS wedge is not a feature cut. The app should still support the broader original workflow:

```txt
digital artwork
→ color selection
→ RGB/CMYK viability
→ acrylic approximation
→ owned-paint mix
→ saved project palette
```

## Guardrail 3: Local-first privacy

Uploaded images should be processed locally in browser.

Do not send user images to a server or AI API.

## Guardrail 4: Deterministic before AI

Do not use AI for the first color-matching engine.

Use deterministic color math and transparent scoring so results are explainable.

## Guardrail 5: Source paint data carefully

If using public paint color data, add comments indicating the data source and that values are approximate.

For demo purposes, curated approximate values are acceptable if clearly labeled.

## Guardrail 6: Avoid generic color-mixer bloat

The app is not just a generic color mixer.

It is a guided workflow for translating digital artwork into Liquitex BASICS acrylic paint decisions.

## Guardrail 7: Accessibility is required

The app should be:

- keyboard navigable
- responsive
- readable
- accessible to screen readers where practical
- not dependent on color alone to communicate status

---

# 7. Recommended Technical Approach

## Suggested stack

- Vite
- React
- TypeScript
- LocalStorage or IndexedDB for persistence
- Canvas API for image color sampling
- CSS modules, Tailwind, or plain CSS
- Optional color library if useful, though custom utilities are acceptable for POC

## Recommended architecture

```txt
src/
  app/
    App.tsx            // shell + routing between the three pages
  pages/
    StartPage.tsx      // Page 1: intro, upload, manual hex entry
    WorkspacePage.tsx  // Page 2: canvas sampling, palette customization
    PalettesPage.tsx   // Page 3: saved palettes, paint usage chart, exports
  components/
    ImageUploader.tsx
    ImageColorPicker.tsx
    ManualColorInput.tsx
    WorkingPaletteStrip.tsx
    ColorComparisonPanel.tsx
    PaintInventoryPanel.tsx
    PaintMatchList.tsx
    MixRecipePanel.tsx
    ProjectPalette.tsx
    PaintUsageChart.tsx
  data/
    liquitexBasics.ts
  lib/
    color.ts
    cmyk.ts
    deltaE.ts
    paintMatching.ts
    recipeEngine.ts
    paintUsage.ts      // aggregate paint proportions across a palette
    storage.ts
  types/
    paint.ts
    color.ts
    project.ts
  styles/
    global.css
```

---

# 8. Core TypeScript Models

```ts
export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type CMYK = {
  c: number;
  m: number;
  y: number;
  k: number;
};

export type Paint = {
  id: string;
  name: string;
  brand: "Liquitex BASICS";
  hex: string;
  rgb: RGB;
  opacity?: "opaque" | "semi-opaque" | "semi-transparent" | "transparent" | "unknown";
  pigmentNotes?: string;
};

export type PaintMatch = {
  paint: Paint;
  deltaE: number;
  confidence: "high" | "medium" | "low";
};

export type MixRecipe = {
  targetHex: string;
  ingredients: Array<{
    paintId: string;
    paintName: string;
    parts: number;
  }>;
  estimatedHex: string;
  deltaE: number;
  confidence: "high" | "medium" | "low";
  notes: string[];
};

export type PaletteItem = {
  id: string;
  targetHex: string;
  targetRgb: RGB;
  approximateCmyk: CMYK;
  printAdjustedHex: string;
  closestMatches: PaintMatch[];
  selectedRecipe?: MixRecipe;
  createdAt: string;
};
```

---

# 9. Algorithm Requirements

## A. Color conversion

Implement utility functions:

- `hexToRgb`
- `rgbToHex`
- `rgbToCmyk`
- `rgbToHsl` or equivalent saturation helper
- `rgbToLab` or `rgbToOKLab`
- `colorDistance`
- `clampRgb`

For the POC, use CIELAB/Delta E if practical. If that slows development, use OKLab or another perceptual distance approximation and document the limitation.

## B. CMYK / print viability

This should be an approximation.

Basic logic:

- Convert RGB to CMYK.
- Generate a print-adjusted preview by reducing extreme saturation and clipping unrealistic neon-like values.
- Flag likely difficult colors:
  - very high saturation
  - very bright blues/greens/pinks
  - near-neon colors
  - colors with large difference between RGB and print-adjusted preview

Viability statuses:

- `Likely printable/paintable`
- `May shift in print/paint`
- `Difficult to reproduce in print/paint`

## C. Closest paint matching

For each Liquitex BASICS paint:

1. Convert target color and paint color to perceptual color space.
2. Calculate distance.
3. Sort ascending.
4. Return top 3–5.

Suggested confidence thresholds for POC:

- High: distance < 8
- Medium: 8–18
- Low: > 18

Thresholds should be easy to tune.

## D. Starter mix engine

POC recipe engine can be heuristic.

Recommended POC approach:

1. Take user-owned paints.
2. Generate candidate mixes with 2–4 ingredients.
3. Use discrete ratios, for example 1–6 parts.
4. Estimate mixed color using a simple weighted average in linear RGB or perceptual color space.
5. Score against target color.
6. Penalize overly complex recipes.
7. Prefer recipes using common anchors:
   - white for lightening
   - black/brown/complement for muting
   - primary colors for hue movement
8. Return the best 1–3 recipes.

Important: label all recipes as approximate starter mixes.

## E. Aggregate paint usage (for Page 3 chart)

For a saved palette, estimate how much of each base paint the user needs overall:

1. Take the selected/best recipe for every color in the palette.
2. Sum the parts of each base paint across all recipes (optionally weighted by how prominent the color is, if area data exists later; equal weighting is fine for the POC).
3. Normalize to percentages of total parts.
4. Output chart-ready data: `Array<{ paintId, paintName, hex, percentage }>`.
5. Render as a pie chart by default (plain SVG is fine — no chart library required for the POC).
6. Include the same data in exports as a plain-English relative amounts list (for example, "Titanium White ~40% of total mix volume").

Label the output as a relative planning estimate, not a physical volume calculation.

Example recipe note:

> Start with 3 parts Primary Yellow and 1 part Primary Blue. Add Titanium White gradually to raise value. The target is more saturated than this paint mix may allow.

---

# 10. UX Requirements

## Page architecture (updated 2026-07-06)

The app is an interactive three-page website with client-side navigation. Most interaction happens inside the page interfaces, not across page loads.

### Page 1 — Start / Upload

Keep this page thin: one primary CTA (upload), minimal reading. Users learn the tool by using it, not by reading feature explanations.

- One-line value proposition and approximation disclaimer.
- Upload artwork (PNG/JPG/WebP) as the dominant element: drag-and-drop plus file picker, processed locally in the browser.
- Manual hex entry as an alternative starting point for users without an image.
- Recent projects/palettes row (small swatch previews) so returning users can jump back in without re-uploading; links into Page 3.
- After upload, the user continues to the Palette Workspace (Page 2) with the image loaded.

### Page 2 — Palette Workspace (customization)

Layout follows the standard creator-tool convention: **canvas left (~60%), inspector right (~40%)**.

- Left: image canvas with click/tap sampling of specific areas, with the working palette strip beneath it — every sampled color as a swatch with hex code; colors can be renamed, re-sampled, or removed.
- The working palette is pre-seeded with the auto-generated dominant colors from the artwork; an "Auto-generate palette" action re-runs extraction (deduped against colors already present).
- Right (inspector, always describing the active swatch): target color card with hex, RGB, approximate CMYK, and print/paint viability — ideally as a three-swatch comparison card (digital target / print-adjusted / paint mix approximation).
- Inspector: closest Liquitex BASICS matches with confidence and owned/not-owned badges.
- Inspector: starter mix recipe for the active swatch using owned paints. (Future opacity/translucency guidance surfaces here as notes on the mix card.)
- Paint inventory is NOT a resident panel. It is set-once/edit-rarely and app-level, so it lives in a slide-over drawer or modal opened from the workspace ("Edit my paints") with search/filter, owned toggles, and an owned-only filter. The workspace itself only shows owned/not-owned badges.
- Save the working palette (or individual colors) to a project palette → Page 3.

### Page 3 — Saved Palettes (output)

- List of saved project palettes; each shows swatches, hex codes, closest matches, and starter mixes.
- Aggregate paint usage chart: for a selected palette, show the proportion of each base Liquitex BASICS paint needed to mix all colors in that palette. Default to a pie chart when roughly 7 or fewer paints are involved; switch to a horizontal bar chart above that (pie charts become unreadable past ~7 slices).
- Ideal final output summary: for each palette color, show the original digital target next to the estimated mixed result so the user sees the best realistic outcome.
- Export palette as JSON / copy plain-English summary (including a shopping-style list of paints and relative amounts).

## Navigation

- Simple top-level navigation among the three pages.
- Client-side routing (React Router or lightweight state-based routing — implementer's choice; no server).
- The in-progress workspace state should survive navigating to Page 3 and back within a session.

## Visual comparison card

Show three swatches side by side:

1. Digital target
2. Print-adjusted approximation
3. Acrylic/mix approximation

Each should have labels and values.

## Empty states

- No image uploaded: “Upload artwork or enter a hex color to begin.”
- No owned paints selected: “Select paints you own to generate starter mixes.”
- No good match: “This color may be difficult to reproduce with your current paints.”

---

# 11. Acceptance Criteria for Demoable POC

The POC is demoable when:

1. App runs locally with one command.
2. App loads in browser without console errors.
3. User can upload an image.
4. User can click/tap image and sample a color.
5. User can manually enter a hex color.
6. App displays RGB, hex, and CMYK approximation.
7. App shows print/paint viability warning.
8. App includes a Liquitex BASICS seed paint library.
9. User can mark paints as owned.
10. App shows closest paint matches.
11. App creates a starter mix using owned paints.
12. User can save selected colors to a project palette.
13. Palette persists after page refresh.
14. User can export/copy project palette.
15. App is organized as three navigable pages: Start/Upload, Palette Workspace, Saved Palettes.
16. Saved Palettes page shows an aggregate paint usage chart (pie or bar) for a selected palette.
17. Saved Palettes page shows target-vs-estimated-mix previews (ideal final outputs).
18. UI is responsive enough for desktop and tablet.
19. All claims are phrased as approximations.

---

# 12. Suggested Build Milestones

## Milestone 1: Scaffold and layout

- Create Vite + React + TypeScript app.
- Add responsive layout.
- Add placeholder sections.
- Add approximation disclaimer.

## Milestone 2: Types and paint data

- Add core TypeScript types.
- Add seed Liquitex BASICS dataset.
- Render inventory list.

## Milestone 3: Color utilities

- Add hex/RGB/CMYK conversions.
- Add perceptual color distance.
- Wire manual hex input to target color state.

## Milestone 4: Image upload and color picking

- Add local image upload.
- Add canvas-based click/tap sampling.
- Update selected color from image.

## Milestone 5: Print viability

- Add CMYK approximation.
- Add print-adjusted preview.
- Add viability warning and explanation.

## Milestone 6: Paint matching

- Match target color to closest Liquitex BASICS paints.
- Add confidence status.
- Add owned/not-owned badges.

## Milestone 7: Inventory persistence

- Persist owned paints locally.
- Add search/filter and quick actions.

## Milestone 8: Starter mix engine

- Generate simple approximate recipes from owned paints.
- Show expected color preview, ratio, confidence, and notes.

## Milestone 9: Project palette

- Save current analysis to palette.
- Persist palette locally.
- Export JSON and copy summary.

## Milestone 10: Saved Palettes page and demo polish

- Build the Saved Palettes page: palette list, aggregate paint usage chart, ideal final output previews.
- Wire up three-page navigation (Start → Workspace → Saved Palettes).
- Polish UI for leadership demo.
- Run QA checklist.

(PWA manifest/service worker dropped per the decision log — do not build them.)

---

# 13. First Codex Prompt for a New Project

Use this prompt to start implementation in a new project.

```txt
You are a senior full-stack engineer helping build a demoable PWA MVP called PaintBridge.

Read CODEX_CONTEXT.md first and treat it as the product/project source of truth.

Create a new Vite + React + TypeScript PWA-ready app for PaintBridge.

Product context:
PaintBridge is a digital-to-Liquitex BASICS acrylic transfer assistant. It lets artists upload digital artwork, pick colors, see RGB/CMYK approximations, match colors to Liquitex BASICS paints, select owned paints, generate approximate starter mixes, and save project palettes.

Build requirements for this first step:
1. Scaffold a Vite React TypeScript app.
2. Add a clean responsive layout with placeholder sections:
   - Artwork upload / color picker
   - Target color details
   - RGB/CMYK viability
   - Liquitex BASICS matches
   - Owned paint inventory
   - Starter mix
   - Saved project palette
3. Add minimal global styling.
4. Add clear approximation disclaimer in the UI.
5. Do not implement the full app yet. Build only the scaffold and shell for this step.
6. Confirm app runs locally.

Important guardrails:
- Build the smallest working version that satisfies this step.
- Do not add backend/auth/cloud services unless explicitly requested.
- Keep future image processing local in the browser.
- Do not claim exact paint accuracy. Use approximation language.
- Use TypeScript types and keep code readable.
- After changes, run the relevant install/build/test/lint command if available.

Return:
1. Summary.
2. Files changed.
3. Commands run.
4. Current app behavior.
5. Known issues.
6. Next recommended step.
```

---

# 14. Standard Guardrail Block for Future Codex Prompts

Add this block to the bottom of every future Codex prompt.

```txt
Important guardrails:
- Read CODEX_CONTEXT.md before making changes.
- Build the smallest working version that satisfies this step.
- Do not add backend/auth/cloud services unless explicitly requested.
- Keep image processing local in the browser.
- Do not claim exact paint accuracy. Use approximation language.
- Use TypeScript types and keep code readable.
- Preserve the full product workflow: digital artwork → RGB/CMYK viability → Liquitex BASICS match → owned-paint starter mix → saved/exported palette.
- After changes, run the relevant install/build/test/lint command if available.

Return:
1. Summary.
2. Files changed.
3. Commands run.
4. Current app behavior.
5. Known issues.
6. Next recommended step.
```

---

# 15. Engineer Reporting Format

After each Codex iteration, return this to product review:

```txt
Prompt used:
[Paste prompt number/name]

Codex summary:
[Paste summary]

Files changed:
[Paste file list]

Commands run:
[Paste commands and results]

Current app behavior:
[Describe what works now]

Known issues:
[List issues]

Questions / decisions needed:
[List blockers or product decisions]
```

---

# 16. Demo Script

Use this flow for leadership demo:

1. Open PaintBridge on the Start page.
2. Show approximation disclaimer.
3. Upload a digital artwork and continue to the Palette Workspace.
4. Click a saturated area of the artwork to sample its color.
5. Show RGB/hex and approximate CMYK.
6. Point out print/paint viability warning.
7. Show closest Liquitex BASICS matches.
8. Select owned paints from inventory.
9. Generate starter mix.
10. Save color to project palette.
11. Repeat with another color to build up the working palette.
12. Navigate to the Saved Palettes page.
13. Show the aggregate paint usage chart and ideal final output previews.
14. Export palette.
15. Refresh page to show persistence.

Demo message:

> This POC validates the core workflow: digital color selection, print/paint reality check, Liquitex BASICS matching, owned-paint starter mix, and saved project palette. Results are intentionally framed as approximations and should be tested with physical swatches.

---

# 17. Future Scope After POC

After the POC works, likely next investments are:

1. Better Liquitex BASICS dataset validation.
2. Full Liquitex BASICS color library.
3. Improved color-difference and pigment-mixing model.
4. Opacity/translucency handling.
5. User swatch calibration.
6. Photo-based swatch capture.
7. Project-level palette extraction from full artwork.
8. Better print workflow with ICC profile support.
9. Additional paint brands.
10. Account/cloud sync via a hosted backend (Supabase is the intended choice: auth, Postgres for palettes/inventory sync). Confirmed as a definite future need (2026-07-06) — still out of scope for the POC. Design persistence so `lib/storage.ts` remains the single swap point.

---

# 18. Product Decision Log

Current approved decisions:

1. Build a plain website, not a native app. (Updated 2026-07-06: PWA installability/offline support was dropped by product decision — ignore PWA manifest/service-worker requirements elsewhere in this document.)
2. Start with Liquitex BASICS acrylics.
3. Preserve the original full workflow.
4. Position the wedge around digital-to-acrylic transfer.
5. Keep the POC local-first.
6. Avoid exact-match claims.
7. Use deterministic matching/mixing before introducing AI.
8. Optimize for a demoable MVP, not perfect color science.
9. (2026-07-06) Structure the app as three pages: (1) Start/Upload, (2) Palette Workspace with per-area color picking and palette customization, (3) Saved Palettes with an aggregate paint usage chart and ideal final output previews. See Section 10 for details.
10. (2026-07-06) A backend WILL be added after the POC, with Supabase as the intended platform (auth + cloud sync of palettes and paint inventory). It remains out of scope for the POC, but keep all persistence behind `lib/storage.ts` so the future migration is a contained swap. Uploaded artwork images stay local-only regardless (Guardrail 3).
