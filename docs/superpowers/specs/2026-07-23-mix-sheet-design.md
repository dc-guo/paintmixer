# Mix Sheet — design spec

Phase 4, feature 1. Written 2026-07-23. Approved direction after a mockup round with Diane.

## Goal

Turn any saved palette into a poster-style **mix sheet** the user can keep and share:
a titled layout with the source artwork, a hex strip, and one card per color showing its
name, hex, and paint mixing recipe. From the sheet the user can **Save as PDF** (full fidelity,
includes the photo) and **Copy a share link** (a read-only view of the palette on the live site,
no account needed).

This is the "digital-to-print-to-paint" workflow made portable. No backend (Phase 3 is tabled),
so everything runs in the browser.

## User-facing behavior

- On a saved palette's detail page, a **"Mix sheet"** button (next to Export) opens the sheet
  view at `#/palettes/:id/sheet`.
- The sheet view renders the poster layout for that palette and shows a small toolbar:
  **Save as PDF**, **Copy link**, **Back**.
- **Save as PDF** opens the browser's print dialog; the user picks "Save as PDF". The printed
  output is just the poster (toolbar and site nav hidden), white page, swatch colors preserved.
  Includes the real artwork photo.
- **Copy link** copies a URL of the form `…/#/shared/<encoded>` to the clipboard and confirms.
  Opening it (anyone, no sign-in) shows the same poster read-only, with the **color strip in
  place of the photo**.

## Layout (the poster)

Top to bottom, matching the approved mockup:

1. **Header** — an eyebrow ("Color palette", letterspaced sans) over the palette name (large serif),
   centered.
2. **Artwork + hex strip** — the source photo on the left (~60% width), a vertical strip of the
   palette colors on the right (~40%), each band showing its hex in luminance-aware italic.
   When there is no photo (hex-only palette, or the shared view), the photo area is replaced by
   the same color strip laid out wider, so the header still reads as a palette.
3. **Color cards** — one card per color, colored with that color, showing: the name (serif, if the
   color has a label; otherwise just the hex as the heading), the hex (italic), and the mixing
   recipe as a parts-ratio line ("4 ultramarine · 2 white · 1 burnt umber"). Text color is
   luminance-aware (dark on light swatches, light on dark).
4. **Footer** — the standing approximation line: "Approximations, not formulas. Test a swatch first."

Design system: white ground, Palatino serif, hex codes in italic serif, parts ratios only.
**No CMYK, no Delta-E, no RGB blocks, no gradients** — the mixing recipe occupies the slot the
reference used for RGB/CMYK. (RGB was removed from the app UI in the Phase 2 fix-wave; the mix
sheet does not reintroduce it.)

## Architecture

Three units, each with one job:

- **`MixSheet` (pure render component)** — props: a normalized view model
  `{ name, artwork?: { dataUrl } | null, colors: Array<{ hex, label?, notes?, mix: MixLine[] }> }`,
  where `MixLine` is `{ paintName, parts }`. It renders the poster and nothing else — no data
  fetching, no engine calls, no routing. Reused by both the own-sheet view and the shared view.
  The header rule is single and derived from the data: **show the photo when `artwork` is present,
  otherwise show the color strip.** The own view passes `artwork` when the palette has one; the
  shared view never has an image in its payload, so it always gets the strip. No separate variant
  flag.
- **`mixSheetCodec` (pure module)** — `encode(viewModel) → string` and `decode(string) → viewModel | null`.
  Serializes the palette to compact JSON (short keys), then to a URL-safe base64 string. Carries
  color hex, label, notes, and the **resolved** mix lines; carries the palette name; does **not**
  carry the artwork image. `decode` returns `null` on any malformed/oversized input. No third-party
  dependency — if the payload ever needs shrinking, use the browser's built-in `CompressionStream`
  (gzip), still dependency-free.
- **Routes** — extend `routeFromHash` in `App.tsx`:
  - `#/palettes/:id/sheet` → `{ page: 'sheet', paletteId }` (own sheet)
  - `#/shared/:encoded` → `{ page: 'shared', encoded }` (read-only)
  The `Route` union and the render switch in `App` gain the two cases.

A small **`SheetPage`** (own) resolves the palette by id from saved palettes, resolves each color's
recipe the same way the detail page does (preferred recipe if set, else a single suggested mix from
the user's owned paints), builds the `MixSheet` view model, and renders `MixSheet` + toolbar. A
small **`SharedSheetPage`** decodes the URL, and on success renders `MixSheet` in shared variant;
on failure renders a friendly fallback.

## The recipe-resolution constraint (important)

The app computes each color's mix from **the current viewer's owned paints**. A share-link
recipient owns different paints, so recomputing on their side would show different mixes or none.
Therefore the **sender's resolved recipes are baked into the link** as `MixLine[]` per color
(`MixRecipe.ingredients` already carry `paintName` + `parts`, so this is self-contained; the
recipient needs neither the paint library nor an inventory). The own-sheet view resolves recipes
locally at render time; only the encoded payload freezes them.

If a color has no workable mix (viewer owns too few paints), its card shows the hex and name with a
quiet "no mix from owned paints yet" line instead of a recipe — and the link carries an empty mix
for that color.

## Share link contents

Included: palette name; per color — hex, label, notes, resolved mix lines. **Excluded:** the
artwork image (shown as the color strip instead). Notes are **included** (Diane's call; consistent
with notes riding along in the JSON export).

**Size guard:** before copying, if the encoded URL exceeds a safe length (~8,000 chars — generous,
since the hash fragment never reaches a server, but past this many chat/email clients mangle it),
"Copy link" instead shows a short notice that the palette is too large to share by link (e.g. very
long notes) and suggests sharing the PDF. This keeps us from ever handing the user a silently-broken
link.

## PDF (print) approach

No PDF library. A print stylesheet (`@media print`) hides the site nav and the sheet toolbar, sets
a white page, and sets `print-color-adjust: exact` so the swatch colors render. "Save as PDF" simply
calls `window.print()`. Result: crisp, selectable-text PDF with the real photo. Doubles as a paper
printout for free.

## Error handling

- `#/shared/<bad>` (malformed, truncated, or over-size-on-decode) → `decode` returns `null`;
  `SharedSheetPage` shows "This link couldn't be read" with a link into the app. Mirrors how
  `routeFromHash` already fails safe on bad percent-encoding.
- `#/palettes/:id/sheet` for an unknown id → same graceful fallback the detail page uses (redirect
  to the gallery).
- No-photo palette → strip header (same path the shared view always takes).

## Testing

- **`mixSheetCodec`** — `node:test` cases: round-trip (encode→decode preserves name, colors, labels,
  notes, mix lines); malformed input → `null`; empty-mix color survives; a payload with unicode notes
  round-trips. Matches the repo's pure-function test style.
- **Recipe freezing** — a test that a decoded payload's mix lines equal the source recipe's
  ingredients (paintName + parts), independent of any owned-paint set.
- **`MixSheet` render** — browser-verified (like other UI in this repo): own view with photo, shared
  view with strip, luminance-aware text on light and dark swatches, print preview hides chrome.

## Non-goals / out of scope

- No backend, no image hosting, no account (Phase 3 remains tabled).
- No full photo in the share link (strip fallback by design).
- No RGB/CMYK/Delta-E anywhere on the sheet.
- No changes to `lib/storage.ts` — the feature reads existing saved palettes and is otherwise
  stateless.

## Files (anticipated)

- `src/components/MixSheet.tsx` (new, pure render)
- `src/lib/mixSheetCodec.ts` + `src/lib/mixSheetCodec.test.ts` (new)
- `src/lib/mixSheetModel.ts` (new, or a helper in an existing lib) — builds the view model and the
  parts-ratio line; may reuse/extract from `paletteSummary.ts`
- `src/pages/SheetPage.tsx`, `src/pages/SharedSheetPage.tsx` (new)
- `src/App.tsx` (routes + render cases), `src/pages/PaletteDetailPage.tsx` ("Mix sheet" button)
- `src/styles.css` (poster styles + `@media print`)
