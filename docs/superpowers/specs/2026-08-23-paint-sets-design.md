# Named paint sets — design spec

Phase 4, feature 3 (from friend feedback, triaged 2026-08-22). Written 2026-08-23.
Approved direction after a question round with Diane: per-image set selection via dropdown;
a "Starter" preset ships; existing owned paints migrate to "My paints"; management lives in
BOTH the paints drawer and a new Paint sets tab on the Saved palettes page.

## Goal

Replace the single global "owned paints" list with multiple **named paint sets**
(e.g. Starter / My paints / Sarah's). Each image (working palette or saved palette) points
at one set via a dropdown; that set drives its matches, starter mixes, usage ratios, and mix
sheet. Sets are created, renamed, duplicated, deleted, and their paints ticked — locally,
no backend (Phase 3 stays tabled).

## Data model

```ts
export type PaintSet = {
  id: string;          // crypto.randomUUID(), except the seeded ids below
  name: string;        // user-editable, non-empty after trim
  paintIds: string[];  // ids into liquitexBasics
  /** Cosmetic tag shown on the seeded Starter card; grants no protection. */
  isPreset?: boolean;
};
```

- All sets live in one new localStorage key: `paintbridge.paintSets.v1`
  (`{ sets: PaintSet[], workingSetId: string }`). Loaders shape-validate like the rest of
  `storage.ts` (drop malformed entries, never throw).
- `SavedPalette` gains optional `paintSetId?: string` — backward compatible (loaders already
  tolerate new optional fields; old payloads simply lack it).
- **Presets are normal sets** (Diane's call): Starter is editable and deletable like any
  other; `isPreset` is only a label on its card.
- The old `paintbridge.ownedPaints.v1` key is read once for migration and then left intact
  (safety net; no longer written).

## Seeding & migration (runs once, on first load without `paintSets.v1`)

1. **"My paints"** (`id: 'my-paints'`): created from the old owned-paints key when that list
   is non-empty. When the old key is empty/absent (fresh user), the set is not created.
2. **"Starter"** (`id: 'starter'`, `isPreset: true`): always seeded — eleven curated
   beginner paints from the BASICS library: Titanium White, Mars Black, Primary Red, Primary Yellow,
   Primary Blue, Ultramarine Blue, Phthalocyanine Green, Dioxazine Purple, Yellow Oxide,
   Burnt Sienna, Burnt Umber (confirm exact ids against `liquitexBasics` at implementation
   time; every listed name must resolve or the seed test fails).
3. `workingSetId`: "My paints" when it was created, else "Starter".

**Resolution fallback (the one seam):** given a `paintSetId`, resolve to its set's
`paintIds`; a dangling/absent id falls back to the migrated set (fixed id `my-paints`,
regardless of any rename), then to the first set. Old
saved palettes (no `paintSetId`) therefore resolve to "My paints" — **their mixes are
byte-identical to today**. The same fallback runs when a set referenced by palettes is
deleted; nothing is orphaned, no palette is rewritten on delete.

## Surfaces

### Workspace (per-image selection + quick editing)

- The strip-caption's "Edit paints · N" button becomes a **`PaintSetPicker`**: a dropdown
  showing the working set's name, listing all sets, plus two actions: **"＋ New set"**
  (creates an empty set named "New set", selects it, opens the drawer to tick paints) and
  **"Manage sets"** (navigates to the Paint sets tab). Picking a set repoints the current
  image; suggestions/matches recompute (existing memo deps on `ownedPaintIds` already do
  this).
- The **paints drawer** stays, now set-aware: header shows the set's name with inline
  **Rename / Duplicate / Delete** text-links and the same set dropdown at top; below it the
  existing search + tick list edits *that set's* `paintIds`. Count line reads
  "N of 72 in this set · approximate colors".
- Editing while a palette is being edited ("Editing 'X'") behaves as today: the set choice
  is saved with the palette on Save/Update. "Edit in workspace" initializes the working set
  from the palette's `paintSetId` (via the fallback), so the workspace opens showing the
  same mixes the detail page showed.

### Palette detail page

- The same `PaintSetPicker` appears in the header actions row. Changing it updates that
  palette's `paintSetId` immediately (persisted with the existing debounced palette save)
  and the page's mixes/usage recompute. The existing suggestion cache already keys on the
  owned-ids join, so no cache changes.

### Saved palettes page (management hub)

- Gains tabs **[ Palettes | Paint sets ]** (hash `#/palettes` keeps working; the tab is
  component state, default Palettes).
- **Paint sets tab**: one card per set — name, "N paints" (+ "preset" tag when `isPreset`),
  a swatch preview row (first 6 paint hexes), and Edit / Duplicate / Delete actions — plus a
  dashed **"＋ New paint set"** card. Edit opens the same set-aware drawer on this page.
  Delete asks nothing fancy: it's allowed always; if it removes the working set, the working
  set falls back per the resolution rule. Deleting the last remaining set immediately
  re-seeds Starter (the app never has zero sets).
- Duplicate mirrors palette duplication: fresh id, "Copy of <name>", same paintIds.

## Architecture

- **`src/lib/paintSets.ts`** (pure, fully tested): `createSet(name)`, `renameSet`,
  `duplicateSet`, `deleteSet` (returns next workingSetId too), `togglePaint`,
  `resolvePaintIds(sets, id | undefined): string[]` implementing the fallback chain,
  `seedPaintSets(oldOwnedIds: string[]): { sets, workingSetId }`, and the Starter list as
  an exported const. All return new arrays (no mutation), matching `paletteEdits.ts` style.
- **`src/lib/storage.ts`**: `loadPaintSets()` / `persistPaintSets()` with shape validation
  + the one-time migration described above. No changes to palette persistence beyond the
  optional field passing through the sanitizer.
- **`src/components/PaintSetPicker.tsx`**: the dropdown (native `<select>` styled to the
  design system — pill border, serif; "＋ New set" and "Manage sets" as sentinel options),
  reused by workspace and detail page.
- **`src/App.tsx`**: replaces `ownedPaintIds` state with `paintSets` + `workingSetId`;
  derives `ownedPaintIds = resolvePaintIds(...)` for the current context and keeps passing
  it to pages, so `WorkspacePage` / `PaletteDetailPage` / `SheetPage` prop shapes barely
  change. Detail and sheet resolve from the *palette's* `paintSetId`, workspace from
  `workingSetId`.
- Drawer and tab share one set-editing component (drawer body extracted from
  `WorkspacePage`'s inventory drawer).

## Constraints

- Design system as everywhere: white ground, serif, pill controls, terse copy; no jargon.
- Deterministic; no new dependencies; no routes beyond the tab state; share links
  unaffected (they bake resolved recipes already).
- Liquitex BASICS only — sets are subsets of the one library (decision #14 stands).

## Error handling

- Malformed `paintSets.v1` → drop bad entries; if nothing valid survives, re-run seeding.
- Empty rename → rejected (keep old name), matching `normalizeLabel` behavior.
- Set with zero paints → valid; its images show the existing "Mark the paints you own"
  empty states.

## Testing

- `paintSets.test.ts` (node:test): seeding with/without old owned paints; Starter names all
  resolve to real library ids; resolution fallback chain (valid id → dangling id → no id →
  no "My paints"); delete returns a valid next workingSetId and re-seeds at zero sets;
  duplicate independence; rename trim/reject; toggle add/remove.
- `storage` tests: migration round-trip; malformed payloads; old palettes without
  `paintSetId` unchanged.
- Browser verification: switch sets on an image and watch mixes change; per-palette set
  dropdown on the detail page; drawer rename/duplicate/delete; Paint sets tab cards; a
  pre-existing palette shows identical mixes after migration.

## Non-goals

- No backend/sync (Phase 3 tabled), no sharing sets via links, no per-set custom colors,
  no locked presets, no multi-brand.
