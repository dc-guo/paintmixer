# Named Paint Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single global owned-paints list with multiple named paint sets (Starter / My paints / …): each image points at a set via a dropdown; sets are managed in a set-aware drawer and a new Paint sets tab on the Saved palettes page.

**Architecture:** A pure `paintSets.ts` library owns all set operations and the resolution fallback; `storage.ts` gains one new key (`paintbridge.paintSets.v1`) with shape-validation and a one-time migration from the old owned-paints key. `App.tsx` swaps its `ownedPaintIds` state for `{sets, workingSetId}` and keeps handing pages plain `ownedPaintIds` arrays resolved through the one seam, so page internals barely change. UI lands in three slices: a `PaintSetPicker` dropdown + extracted `PaintSetDrawer` (workspace), the picker on the palette detail page, and a Paint sets tab on the Saved palettes page.

**Tech Stack:** React 19 + TypeScript, Vite, `node --test` via `tsconfig.test.json` (tests compile to `temp/test-dist`; **value imports of sibling `src/lib` modules need the `.js` suffix**, `import type` lines do not; `.tsx` components use suffix-free imports). Plain CSS in `src/styles.css`.

**Spec:** `docs/superpowers/specs/2026-08-23-paint-sets-design.md` (approved 2026-08-23).

## Deviations from spec (flagged for Diane — vetoable at handoff)

1. **Picker location:** the spec says the picker replaces the "strip-caption's Edit paints button", but that button moved during the inspector rework — it now lives in the **Closest Liquitex BASICS panel header** (`.panel-head .text-button`, "Edit paints · N"). The picker goes there, with a compact "Edit · N" link beside it opening the drawer.
2. **Paint sets tab is a hash sub-route** `#/palettes/sets` (spec said component state). This makes "Manage sets" a plain navigation, keeps the back button working, and can't collide with palette ids (UUIDs). `#/palettes` still opens the Palettes tab.
3. **Seed order** is `[Starter, My paints]` with "My paints" as the working set when it exists (spec fixed the working set but not card order).

## Global Constraints

- Design system: white ground, Palatino serif, pill controls, terse copy; no gradients, no CMYK/Delta-E/RGB numbers in the UI.
- Deterministic; **no new npm dependencies**; share links unaffected (they bake resolved recipes).
- Storage: new key `paintbridge.paintSets.v1` holding `{ sets: PaintSet[], workingSetId: string }`; loaders shape-validate and never throw; the old `paintbridge.ownedPaints.v1` key is read for migration and **left intact, never written again**.
- Fixed ids: Starter set `id: 'starter'` (`isPreset: true`), migrated set `id: 'my-paints'`. Fallback chain for any set lookup: requested id → `'my-paints'` → first set.
- Starter preset paint ids, exactly these eleven (all verified present in `liquitexBasics`): `titanium-white`, `mars-black`, `primary-red`, `primary-yellow`, `primary-blue`, `ultramarine-blue`, `phthalocyanine-green`, `dioxazine-purple`, `yellow-oxide`, `burnt-sienna`, `burnt-umber`.
- Presets are normal sets: editable and deletable; `isPreset` is a cosmetic card tag only.
- The app never has zero sets (deleting the last re-seeds Starter). Empty rename is rejected (name unchanged). Old palettes (no `paintSetId`) must resolve to "My paints" so their mixes are identical to today.
- Pure lib functions never mutate inputs (match `paletteEdits.ts` style); id-generating functions take a `makeId: () => string` parameter (match `clonePalette(original, createId, …)`) so the lib does not import `storage.ts` (avoids an import cycle — storage imports the lib for seeding).
- Delivery: commits accumulate on `working`; STOP for Diane's UAT after the final task; no PR (one per phase).
- Gates for every task: `npx tsc -b` clean and `npm test` all-pass (currently 94 tests) before each commit.

---

### Task 1: `paintSets.ts` — pure set operations + resolution fallback

**Files:**
- Create: `src/lib/paintSets.ts`
- Test: `src/lib/paintSets.test.ts`

**Interfaces:**
- Consumes: nothing from the app (the test imports `liquitexBasics` to validate Starter ids).
- Produces (later tasks rely on these exact names):
  - `type PaintSet = { id: string; name: string; paintIds: string[]; isPreset?: boolean }`
  - `type PaintSetsState = { sets: PaintSet[]; workingSetId: string }`
  - `STARTER_SET_ID = 'starter'`, `MY_PAINTS_SET_ID = 'my-paints'`, `STARTER_PAINT_IDS: readonly string[]`
  - `seedPaintSets(oldOwnedIds: string[]): PaintSetsState`
  - `resolveSetId(sets: PaintSet[], id: string | undefined): string`
  - `resolvePaintIds(sets: PaintSet[], id: string | undefined): string[]`
  - `createSet(name: string, makeId: () => string): PaintSet`
  - `renameSet(sets: PaintSet[], id: string, rawName: string): PaintSet[]`
  - `duplicateSet(sets: PaintSet[], id: string, makeId: () => string): PaintSet[]`
  - `deleteSet(sets: PaintSet[], id: string, workingSetId: string): PaintSetsState`
  - `togglePaint(sets: PaintSet[], setId: string, paintId: string): PaintSet[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/paintSets.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSet,
  deleteSet,
  duplicateSet,
  MY_PAINTS_SET_ID,
  renameSet,
  resolvePaintIds,
  resolveSetId,
  seedPaintSets,
  STARTER_PAINT_IDS,
  STARTER_SET_ID,
  togglePaint,
} from './paintSets.js';
import type { PaintSet } from './paintSets.js';
import { liquitexBasics } from '../data/liquitexBasics.js';

let nextId = 0;
const makeId = () => `id-${(nextId += 1)}`;

function sets(): PaintSet[] {
  return [
    { id: STARTER_SET_ID, name: 'Starter', paintIds: ['titanium-white'], isPreset: true },
    { id: MY_PAINTS_SET_ID, name: 'My paints', paintIds: ['mars-black', 'yellow-oxide'] },
    { id: 's3', name: "Sarah's", paintIds: ['primary-red'] },
  ];
}

test('every Starter paint id resolves to a real library paint', () => {
  const libraryIds = new Set(liquitexBasics.map((paint) => paint.id));
  for (const id of STARTER_PAINT_IDS) {
    assert.ok(libraryIds.has(id), `${id} is not in liquitexBasics`);
  }
  assert.equal(STARTER_PAINT_IDS.length, 11);
});

test('seedPaintSets with old owned paints creates Starter + My paints, working = My paints', () => {
  const state = seedPaintSets(['mars-black', 'burnt-umber']);
  assert.deepEqual(
    state.sets.map((set) => set.id),
    [STARTER_SET_ID, MY_PAINTS_SET_ID],
  );
  assert.equal(state.sets[0].isPreset, true);
  assert.deepEqual(state.sets[0].paintIds, [...STARTER_PAINT_IDS]);
  assert.deepEqual(state.sets[1].paintIds, ['mars-black', 'burnt-umber']);
  assert.equal(state.sets[1].name, 'My paints');
  assert.equal(state.workingSetId, MY_PAINTS_SET_ID);
});

test('seedPaintSets with no old paints creates Starter only, working = Starter', () => {
  const state = seedPaintSets([]);
  assert.deepEqual(state.sets.map((set) => set.id), [STARTER_SET_ID]);
  assert.equal(state.workingSetId, STARTER_SET_ID);
});

test('resolveSetId: valid id wins; dangling falls back to my-paints, then first set', () => {
  assert.equal(resolveSetId(sets(), 's3'), 's3');
  assert.equal(resolveSetId(sets(), 'gone'), MY_PAINTS_SET_ID);
  assert.equal(resolveSetId(sets(), undefined), MY_PAINTS_SET_ID);
  const noMyPaints = sets().filter((set) => set.id !== MY_PAINTS_SET_ID);
  assert.equal(resolveSetId(noMyPaints, 'gone'), STARTER_SET_ID);
});

test('resolvePaintIds returns the resolved set paintIds', () => {
  assert.deepEqual(resolvePaintIds(sets(), 's3'), ['primary-red']);
  assert.deepEqual(resolvePaintIds(sets(), 'gone'), ['mars-black', 'yellow-oxide']);
  assert.deepEqual(resolvePaintIds([], undefined), []);
});

test('createSet trims the name and defaults blank to "New set"', () => {
  assert.equal(createSet('  Plein air  ', makeId).name, 'Plein air');
  assert.equal(createSet('   ', makeId).name, 'New set');
  const set = createSet('X', makeId);
  assert.deepEqual(set.paintIds, []);
  assert.ok(set.id.startsWith('id-'));
});

test('renameSet trims; blank rename keeps the old name; unknown id is a no-op', () => {
  const renamed = renameSet(sets(), 's3', '  Field kit ');
  assert.equal(renamed.find((set) => set.id === 's3')?.name, 'Field kit');
  const blank = renameSet(sets(), 's3', '   ');
  assert.equal(blank.find((set) => set.id === 's3')?.name, "Sarah's");
  assert.deepEqual(renameSet(sets(), 'gone', 'X'), sets());
});

test('duplicateSet inserts an independent "Copy of" after the original, dropping isPreset', () => {
  const input = sets();
  const result = duplicateSet(input, STARTER_SET_ID, makeId);
  assert.equal(result.length, 4);
  const copy = result[1];
  assert.equal(copy.name, 'Copy of Starter');
  assert.equal(copy.isPreset, undefined);
  assert.notEqual(copy.id, STARTER_SET_ID);
  assert.deepEqual(copy.paintIds, input[0].paintIds);
  assert.notEqual(copy.paintIds, input[0].paintIds); // fresh array, not shared
  assert.deepEqual(input, sets()); // input untouched
});

test('deleteSet removes and re-resolves the working set', () => {
  const state = deleteSet(sets(), MY_PAINTS_SET_ID, MY_PAINTS_SET_ID);
  assert.deepEqual(state.sets.map((set) => set.id), [STARTER_SET_ID, 's3']);
  assert.equal(state.workingSetId, STARTER_SET_ID); // fallback: no my-paints -> first
  const untouched = deleteSet(sets(), 's3', MY_PAINTS_SET_ID);
  assert.equal(untouched.workingSetId, MY_PAINTS_SET_ID); // working survives
});

test('deleting the last set re-seeds Starter', () => {
  const only: PaintSet[] = [{ id: 'x', name: 'Only', paintIds: [] }];
  const state = deleteSet(only, 'x', 'x');
  assert.deepEqual(state.sets.map((set) => set.id), [STARTER_SET_ID]);
  assert.equal(state.workingSetId, STARTER_SET_ID);
});

test('togglePaint adds then removes without mutating input', () => {
  const input = sets();
  const added = togglePaint(input, 's3', 'mars-black');
  assert.deepEqual(added.find((set) => set.id === 's3')?.paintIds, ['primary-red', 'mars-black']);
  const removed = togglePaint(added, 's3', 'primary-red');
  assert.deepEqual(removed.find((set) => set.id === 's3')?.paintIds, ['mars-black']);
  assert.deepEqual(input, sets());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module .../paintSets.js`. The existing 94 tests stay green.

- [ ] **Step 3: Write the implementation**

Create `src/lib/paintSets.ts`:

```ts
export type PaintSet = {
  id: string;
  name: string;
  paintIds: string[];
  /** Cosmetic tag on the seeded Starter card; grants no protection. */
  isPreset?: boolean;
};

export type PaintSetsState = { sets: PaintSet[]; workingSetId: string };

export const STARTER_SET_ID = 'starter';
export const MY_PAINTS_SET_ID = 'my-paints';

/** Eleven curated beginner paints; a test pins each id to the real library. */
export const STARTER_PAINT_IDS: readonly string[] = [
  'titanium-white',
  'mars-black',
  'primary-red',
  'primary-yellow',
  'primary-blue',
  'ultramarine-blue',
  'phthalocyanine-green',
  'dioxazine-purple',
  'yellow-oxide',
  'burnt-sienna',
  'burnt-umber',
];

/** First-run seeding: Starter always; old owned paints become "My paints". */
export function seedPaintSets(oldOwnedIds: string[]): PaintSetsState {
  const starter: PaintSet = {
    id: STARTER_SET_ID,
    name: 'Starter',
    paintIds: [...STARTER_PAINT_IDS],
    isPreset: true,
  };

  if (oldOwnedIds.length === 0) {
    return { sets: [starter], workingSetId: STARTER_SET_ID };
  }

  const myPaints: PaintSet = {
    id: MY_PAINTS_SET_ID,
    name: 'My paints',
    paintIds: [...oldOwnedIds],
  };
  return { sets: [starter, myPaints], workingSetId: MY_PAINTS_SET_ID };
}

/**
 * The one resolution seam: requested id -> the migrated set (fixed id
 * 'my-paints', regardless of rename) -> first set. Old palettes without a
 * paintSetId therefore keep mixing from "My paints", identical to before.
 */
export function resolveSetId(sets: PaintSet[], id: string | undefined): string {
  if (id && sets.some((set) => set.id === id)) {
    return id;
  }

  if (sets.some((set) => set.id === MY_PAINTS_SET_ID)) {
    return MY_PAINTS_SET_ID;
  }

  return sets[0]?.id ?? '';
}

export function resolvePaintIds(sets: PaintSet[], id: string | undefined): string[] {
  const resolved = resolveSetId(sets, id);
  return sets.find((set) => set.id === resolved)?.paintIds ?? [];
}

function normalizeName(raw: string): string {
  return raw.trim();
}

export function createSet(name: string, makeId: () => string): PaintSet {
  return { id: makeId(), name: normalizeName(name) || 'New set', paintIds: [] };
}

/** Blank names are rejected (set keeps its old name); unknown ids are a no-op. */
export function renameSet(sets: PaintSet[], id: string, rawName: string): PaintSet[] {
  const name = normalizeName(rawName);

  if (!name) {
    return sets;
  }

  return sets.map((set) => (set.id === id ? { ...set, name } : set));
}

/** Inserts "Copy of <name>" right after the original; copies are never presets. */
export function duplicateSet(sets: PaintSet[], id: string, makeId: () => string): PaintSet[] {
  const index = sets.findIndex((set) => set.id === id);

  if (index === -1) {
    return sets;
  }

  const original = sets[index];
  const copy: PaintSet = {
    id: makeId(),
    name: `Copy of ${original.name}`,
    paintIds: [...original.paintIds],
  };
  return [...sets.slice(0, index + 1), copy, ...sets.slice(index + 1)];
}

/**
 * Removes a set and re-resolves the working set. The app never has zero sets:
 * deleting the last one re-seeds Starter.
 */
export function deleteSet(sets: PaintSet[], id: string, workingSetId: string): PaintSetsState {
  const remaining = sets.filter((set) => set.id !== id);

  if (remaining.length === 0) {
    return seedPaintSets([]);
  }

  const nextWorking =
    workingSetId === id ? resolveSetId(remaining, undefined) : resolveSetId(remaining, workingSetId);
  return { sets: remaining, workingSetId: nextWorking };
}

export function togglePaint(sets: PaintSet[], setId: string, paintId: string): PaintSet[] {
  return sets.map((set) => {
    if (set.id !== setId) {
      return set;
    }

    return {
      ...set,
      paintIds: set.paintIds.includes(paintId)
        ? set.paintIds.filter((id) => id !== paintId)
        : [...set.paintIds, paintId],
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass (94 existing + 11 new = 105).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc -b
git add src/lib/paintSets.ts src/lib/paintSets.test.ts
git commit -m "Paint sets: pure set operations and resolution fallback"
```

---

### Task 2: storage — paint-sets key, migration, palette `paintSetId`

**Files:**
- Modify: `src/lib/storage.ts` (new key + load/persist/sanitize; `sanitizeSavedPalettes` passes `paintSetId` through only when it is a string)
- Modify: `src/types/palette.ts` (add `paintSetId?: string` to `SavedPalette`)
- Test: `src/lib/storage.test.ts` (append)

**Interfaces:**
- Consumes (Task 1): `PaintSet`, `PaintSetsState`, `seedPaintSets`, `resolveSetId` from `./paintSets` (**value imports need `./paintSets.js`**).
- Produces:
  - `loadPaintSets(): PaintSetsState` — sanitized stored state, else seeds from `loadOwnedPaintIds()`.
  - `persistPaintSets(state: PaintSetsState): void` — best-effort try/catch like the other persisters.
  - `sanitizePaintSetsState(value: unknown): PaintSetsState | null` — pure, exported for tests; `null` when no valid set survives.
  - `SavedPalette.paintSetId?: string`.

- [ ] **Step 1: Add the type field**

In `src/types/palette.ts`, inside `SavedPalette` after `createdAt`:

```ts
  /**
   * Which paint set this palette mixes from. Absent on pre-paint-sets
   * palettes and resolved with the my-paints/first-set fallback at read time.
   */
  paintSetId?: string;
```

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/storage.test.ts` (existing file; it already imports `assert`/`test` — add imports for the new names to its import list: `sanitizePaintSetsState` from `./storage.js`, and `MY_PAINTS_SET_ID`, `STARTER_SET_ID` from `./paintSets.js`):

```ts
test('sanitizePaintSetsState keeps valid sets, drops junk, re-resolves workingSetId', () => {
  const state = sanitizePaintSetsState({
    sets: [
      { id: 'a', name: 'Good', paintIds: ['titanium-white', 7, 'mars-black'] },
      { id: 8, name: 'bad id', paintIds: [] },
      { id: 'b', name: 'Preset-ish', paintIds: [], isPreset: 'yes' },
    ],
    workingSetId: 'gone',
  });
  assert.ok(state);
  if (state) {
    assert.deepEqual(state.sets.map((set) => set.id), ['a', 'b']);
    assert.deepEqual(state.sets[0].paintIds, ['titanium-white', 'mars-black']); // non-strings dropped
    assert.equal(state.sets[1].isPreset, undefined); // non-boolean-true stripped
    assert.equal(state.workingSetId, 'a'); // dangling -> no my-paints -> first
  }
});

test('sanitizePaintSetsState returns null when nothing valid survives', () => {
  assert.equal(sanitizePaintSetsState({ sets: [], workingSetId: 'x' }), null);
  assert.equal(sanitizePaintSetsState({ sets: 'nope' }), null);
  assert.equal(sanitizePaintSetsState(null), null);
  assert.equal(sanitizePaintSetsState([1, 2, 3]), null);
});

test('sanitizePaintSetsState keeps isPreset only when literally true', () => {
  const state = sanitizePaintSetsState({
    sets: [{ id: STARTER_SET_ID, name: 'Starter', paintIds: [], isPreset: true }],
    workingSetId: STARTER_SET_ID,
  });
  assert.ok(state);
  if (state) {
    assert.equal(state.sets[0].isPreset, true);
  }
});

test('sanitizeSavedPalettes passes a string paintSetId through and drops other types', () => {
  const palettes = sanitizeSavedPalettes([
    { id: 'p1', name: 'A', createdAt: 'now', colors: [], paintSetId: MY_PAINTS_SET_ID },
    { id: 'p2', name: 'B', createdAt: 'now', colors: [], paintSetId: 42 },
    { id: 'p3', name: 'C', createdAt: 'now', colors: [] },
  ]);
  assert.equal(palettes[0].paintSetId, MY_PAINTS_SET_ID);
  assert.equal(palettes[1].paintSetId, undefined);
  assert.equal(palettes[2].paintSetId, undefined);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `sanitizePaintSetsState` is not exported. (The `sanitizeSavedPalettes` paintSetId test may pass for p1/p3 already — the spread keeps unknown fields — but p2 fails: `42` currently survives.)

- [ ] **Step 4: Implement**

In `src/lib/storage.ts`:

Add to the imports at the top:

```ts
import { resolveSetId, seedPaintSets } from './paintSets.js';
import type { PaintSet, PaintSetsState } from './paintSets';
```

Add the key next to the other keys:

```ts
const PAINT_SETS_KEY = 'paintbridge.paintSets.v1';
```

Change the `sanitizeSavedPalettes` map so a non-string `paintSetId` is stripped (replace the existing `return value.filter(isSavedPalette).map(...)` body):

```ts
  return value.filter(isSavedPalette).map((palette) => {
    const { paintSetId, ...rest } = palette as SavedPalette & { paintSetId?: unknown };
    return {
      ...rest,
      ...(typeof paintSetId === 'string' ? { paintSetId } : {}),
      colors: palette.colors
        .map(sanitizeColor)
        .filter((color): color is SampledColor => color !== null),
    };
  });
```

Add after `persistOwnedPaintIds` (which stays but is no longer called by the app — the old key is read-only from now on):

```ts
function sanitizePaintSet(value: unknown): PaintSet | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || !Array.isArray(raw.paintIds)) {
    return null;
  }

  const set: PaintSet = {
    id: raw.id,
    name: raw.name,
    paintIds: raw.paintIds.filter((id): id is string => typeof id === 'string'),
  };

  if (raw.isPreset === true) {
    set.isPreset = true;
  }

  return set;
}

/** Validates a raw parsed value into paint-sets state; null when no valid set
 * survives (the caller re-seeds). Pure and exported for tests. */
export function sanitizePaintSetsState(value: unknown): PaintSetsState | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (!Array.isArray(raw.sets)) {
    return null;
  }

  const sets = raw.sets
    .map(sanitizePaintSet)
    .filter((set): set is PaintSet => set !== null);

  if (sets.length === 0) {
    return null;
  }

  const requested = typeof raw.workingSetId === 'string' ? raw.workingSetId : undefined;
  return { sets, workingSetId: resolveSetId(sets, requested) };
}

/** Loads paint sets; a missing or unusable key seeds Starter + a "My paints"
 * migration of the old owned-paints list (which is left intact as a safety net). */
export function loadPaintSets(): PaintSetsState {
  try {
    const raw = window.localStorage.getItem(PAINT_SETS_KEY);

    if (raw) {
      const state = sanitizePaintSetsState(JSON.parse(raw));

      if (state) {
        return state;
      }
    }
  } catch {
    // Fall through to seeding.
  }

  return seedPaintSets(loadOwnedPaintIds());
}

export function persistPaintSets(state: PaintSetsState) {
  try {
    window.localStorage.setItem(PAINT_SETS_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, quota); persistence is best-effort.
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all pass (105 + 4 new = 109).

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc -b
git add src/lib/storage.ts src/lib/storage.test.ts src/types/palette.ts
git commit -m "Paint sets: storage key, migration seeding, palette paintSetId"
```

---

### Task 3: App wiring — sets state, resolution seam, per-palette sets

**Files:**
- Modify: `src/App.tsx` only.

**Interfaces:**
- Consumes (Tasks 1–2): `createSet`, `deleteSet`, `duplicateSet`, `renameSet`, `resolvePaintIds`, `resolveSetId`, `togglePaint` and types from `../lib/paintSets` (suffix-free — App.tsx is not in the test config); `loadPaintSets`, `persistPaintSets` from `./lib/storage`.
- Produces (handlers later tasks wire to UI — exact names):
  - `paintSets: PaintSet[]` and `workingSetId: string` (state), `workspaceOwnedIds: string[]` (derived)
  - `selectWorkingSet(id: string)`, `createWorkingSet()`, `renameSetById(id, name)`, `duplicateSetById(id)`, `deleteSetById(id)`, `togglePaintInSet(setId, paintId)`, `toggleOwnedPaint(paintId)` (kept name; now toggles in the working set)
  - `setPaletteSet(paletteId: string, setId: string)`, `createSetForPalette(paletteId: string)`
- Behavior gates: pages keep compiling with their existing props (`ownedPaintIds` etc.); the detail and sheet routes now resolve from the palette's `paintSetId`; `savePalette` stamps `paintSetId`; `editPalette` adopts the palette's set.

- [ ] **Step 1: Swap the state**

Replace the `ownedPaintIds` state line (`const [ownedPaintIds, setOwnedPaintIds] = useState<string[]>(loadOwnedPaintIds);`) with:

```ts
  const [paintSetsState, setPaintSetsState] = useState<PaintSetsState>(loadPaintSets);
```

Update imports: from `./lib/storage` drop `loadOwnedPaintIds`/`persistOwnedPaintIds`, add `loadPaintSets`, `persistPaintSets`; add:

```ts
import {
  createSet,
  deleteSet,
  duplicateSet,
  renameSet,
  resolvePaintIds,
  resolveSetId,
  togglePaint,
} from './lib/paintSets';
import type { PaintSetsState } from './lib/paintSets';
```

Replace the owned-paints persist effect (`useEffect(... persistOwnedPaintIds(ownedPaintIds) ...)`) with:

```ts
  useEffect(() => {
    if (hasHydrated.current) {
      persistPaintSets(paintSetsState);
    }
  }, [paintSetsState]);
```

- [ ] **Step 2: Derive and rewire the handlers**

Add below the state block:

```ts
  const paintSets = paintSetsState.sets;
  const workingSetId = paintSetsState.workingSetId;
  const workspaceOwnedIds = resolvePaintIds(paintSets, workingSetId);

  const selectWorkingSet = (id: string) => {
    setPaintSetsState((current) => ({ ...current, workingSetId: resolveSetId(current.sets, id) }));
  };

  const createWorkingSet = () => {
    const set = createSet('New set', createId);
    setPaintSetsState((current) => ({ sets: [...current.sets, set], workingSetId: set.id }));
  };

  const renameSetById = (id: string, name: string) => {
    setPaintSetsState((current) => ({ ...current, sets: renameSet(current.sets, id, name) }));
  };

  const duplicateSetById = (id: string) => {
    setPaintSetsState((current) => ({
      ...current,
      sets: duplicateSet(current.sets, id, createId),
    }));
  };

  const deleteSetById = (id: string) => {
    setPaintSetsState((current) => deleteSet(current.sets, id, current.workingSetId));
  };

  const togglePaintInSet = (setId: string, paintId: string) => {
    setPaintSetsState((current) => ({ ...current, sets: togglePaint(current.sets, setId, paintId) }));
  };

  const setPaletteSet = (paletteId: string, setId: string) => {
    setSavedPalettes((current) =>
      current.map((palette) => (palette.id === paletteId ? { ...palette, paintSetId: setId } : palette)),
    );
  };

  const createSetForPalette = (paletteId: string) => {
    const set = createSet('New set', createId);
    setPaintSetsState((current) => ({ ...current, sets: [...current.sets, set] }));
    setPaletteSet(paletteId, set.id);
  };
```

Replace the body of `toggleOwnedPaint`:

```ts
  const toggleOwnedPaint = (id: string) => {
    togglePaintInSet(workingSetId, id);
  };
```

- [ ] **Step 3: Stamp and adopt the set on save/edit**

In `savePalette`, add `paintSetId: workingSetId` to both writes:
- update branch: `{ ...palette, name, colors: workingColors, artwork: paletteArtwork ?? palette.artwork, paintSetId: workingSetId }`
- create branch: add `paintSetId: workingSetId,` to the new `palette` object literal.

In `editPalette`, before `navigate('workspace')`:

```ts
    setPaintSetsState((current) => ({
      ...current,
      workingSetId: resolveSetId(current.sets, palette.paintSetId),
    }));
```

- [ ] **Step 4: Resolve per-context ids in the render switch**

- `WorkspacePage` call: `ownedPaintIds={workspaceOwnedIds}` (was `ownedPaintIds`).
- `PaletteDetailPage` call: replace `ownedPaintIds={ownedPaintIds}` with a per-palette resolution — above the `return`, nothing extra is needed; inline in the JSX case:

```tsx
        {route.page === 'palette' ? (
          <PaletteDetailPage
            key={route.paletteId}
            /* ...existing props unchanged... */
            ownedPaintIds={resolvePaintIds(
              paintSets,
              savedPalettes.find((palette) => palette.id === route.paletteId)?.paintSetId,
            )}
            palette={savedPalettes.find((palette) => palette.id === route.paletteId) ?? null}
          />
        ) : null}
```

- `SheetPage` call: same pattern —

```tsx
            ownedPaintIds={resolvePaintIds(
              paintSets,
              savedPalettes.find((palette) => palette.id === route.paletteId)?.paintSetId,
            )}
```

- [ ] **Step 5: Gates**

Run: `npx tsc -b` — clean; `npm test` — all 109 pass. (No page prop-type changes yet, so everything compiles; the app now migrates on first load and resolves per-palette sets.)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "Paint sets: App state, resolution seam, per-palette set stamping"
```

---

### Task 4: `PaintSetPicker` + `PaintSetDrawer` + workspace integration

**Files:**
- Create: `src/components/PaintSetPicker.tsx`
- Create: `src/components/PaintSetDrawer.tsx` (extraction of WorkspacePage's inventory drawer, made set-aware)
- Modify: `src/pages/WorkspacePage.tsx` (picker in the Closest BASICS panel-head; drawer replaced; drawer-only state removed; new props)
- Modify: `src/App.tsx` (pass the new props)
- Modify: `src/styles.css` (picker + drawer-head styles)

**Interfaces:**
- Consumes (Tasks 1, 3): `PaintSet` type; App handlers `selectWorkingSet`, `createWorkingSet`, `renameSetById`, `duplicateSetById`, `deleteSetById`, `togglePaintInSet`.
- Produces:
  - `PaintSetPicker({ sets, value, onSelect, onCreateNew, onManage }: { sets: PaintSet[]; value: string; onSelect: (id: string) => void; onCreateNew: () => void; onManage?: () => void })`
  - `PaintSetDrawer({ sets, setId, onSelectSet, onTogglePaint, onRename, onDuplicate, onDelete, onClose }: { sets: PaintSet[]; setId: string; onSelectSet: (id: string) => void; onTogglePaint: (setId: string, paintId: string) => void; onRename: (setId: string, name: string) => void; onDuplicate: (setId: string) => void; onDelete: (setId: string) => void; onClose: () => void })`
  - New WorkspacePage props: `paintSets: PaintSet[]`, `workingSetId: string`, `onSelectSet: (id: string) => void`, `onCreateSet: () => void`, `onRenameSet: (setId: string, name: string) => void`, `onDuplicateSet: (setId: string) => void`, `onDeleteSet: (setId: string) => void`, `onTogglePaintInSet: (setId: string, paintId: string) => void` (existing `ownedPaintIds`/`onToggleOwnedPaint` stay).

- [ ] **Step 1: Create the picker**

Create `src/components/PaintSetPicker.tsx`:

```tsx
import type { PaintSet } from '../lib/paintSets';

const NEW_SENTINEL = '__new__';
const MANAGE_SENTINEL = '__manage__';

type PaintSetPickerProps = {
  sets: PaintSet[];
  value: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onManage?: () => void;
};

/** Per-image paint-set dropdown: pick a set, spin up a new one, or jump to
 * the management tab. A native select keeps it keyboard/touch-correct. */
export function PaintSetPicker({ sets, value, onSelect, onCreateNew, onManage }: PaintSetPickerProps) {
  return (
    <select
      aria-label="Paint set"
      className="set-picker"
      onChange={(event) => {
        const next = event.target.value;

        if (next === NEW_SENTINEL) {
          onCreateNew();
        } else if (next === MANAGE_SENTINEL) {
          onManage?.();
        } else {
          onSelect(next);
        }

        // Sentinel choices must not stick as the select's value.
        event.target.value = value;
      }}
      value={value}
    >
      {sets.map((set) => (
        <option key={set.id} value={set.id}>
          {set.name}
        </option>
      ))}
      <option disabled>──</option>
      <option value={NEW_SENTINEL}>＋ New set</option>
      {onManage ? <option value={MANAGE_SENTINEL}>Manage sets…</option> : null}
    </select>
  );
}
```

- [ ] **Step 2: Create the set-aware drawer**

Create `src/components/PaintSetDrawer.tsx` (the search + tick list is moved verbatim from WorkspacePage's inventory drawer; the head gains set controls):

```tsx
import { useMemo, useState } from 'react';
import { liquitexBasics } from '../data/liquitexBasics';
import type { PaintSet } from '../lib/paintSets';
import { PaintSetPicker } from './PaintSetPicker';

type PaintSetDrawerProps = {
  sets: PaintSet[];
  setId: string;
  onSelectSet: (id: string) => void;
  onTogglePaint: (setId: string, paintId: string) => void;
  onRename: (setId: string, name: string) => void;
  onDuplicate: (setId: string) => void;
  onDelete: (setId: string) => void;
  onClose: () => void;
};

/** The paints drawer, set-aware: pick/rename/duplicate/delete a set up top,
 * tick its paints below. Used from the workspace and the Paint sets tab. */
export function PaintSetDrawer({
  sets,
  setId,
  onSelectSet,
  onTogglePaint,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: PaintSetDrawerProps) {
  const [paintQuery, setPaintQuery] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const set = sets.find((candidate) => candidate.id === setId) ?? sets[0];

  const filteredPaints = useMemo(() => {
    const query = paintQuery.trim().toLowerCase();
    return query
      ? liquitexBasics.filter((paint) => paint.name.toLowerCase().includes(query))
      : liquitexBasics;
  }, [paintQuery]);

  if (!set) {
    return null;
  }

  const commitRename = () => {
    onRename(set.id, nameDraft);
    setIsRenaming(false);
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        aria-label="Paint set"
        className="drawer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="drawer-head">
          {isRenaming ? (
            <form
              className="rename-form"
              onSubmit={(event) => {
                event.preventDefault();
                commitRename();
              }}
            >
              <input
                aria-label="Set name"
                autoFocus
                onBlur={commitRename}
                onChange={(event) => setNameDraft(event.target.value)}
                value={nameDraft}
              />
            </form>
          ) : (
            <h2>{set.name}</h2>
          )}
          <button className="secondary-button" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="drawer-set-row">
          <PaintSetPicker
            onCreateNew={() => onSelectSet(set.id)}
            onSelect={onSelectSet}
            sets={sets}
            value={set.id}
          />
          <div className="drawer-set-actions">
            <button
              className="text-link"
              onClick={() => {
                setNameDraft(set.name);
                setIsRenaming(true);
              }}
              type="button"
            >
              Rename
            </button>
            <button className="text-link" onClick={() => onDuplicate(set.id)} type="button">
              Duplicate
            </button>
            <button className="text-link" onClick={() => onDelete(set.id)} type="button">
              Delete
            </button>
          </div>
        </div>
        <input
          aria-label="Search paints"
          className="drawer-search"
          onChange={(event) => setPaintQuery(event.target.value)}
          placeholder="Search paints"
          value={paintQuery}
        />
        <p className="micro">
          {set.paintIds.length} of {liquitexBasics.length} in this set · approximate colors
        </p>
        {filteredPaints.length > 0 ? (
          <ul className="paint-list">
            {filteredPaints.map((paint) => (
              <li key={paint.id}>
                <label className="paint-row">
                  <span aria-hidden className="mini-swatch" style={{ backgroundColor: paint.hex }} />
                  <span className="paint-name">{paint.name}</span>
                  <input
                    checked={set.paintIds.includes(paint.id)}
                    onChange={() => onTogglePaint(set.id, paint.id)}
                    type="checkbox"
                  />
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No paints match "{paintQuery}".</p>
        )}
      </aside>
    </div>
  );
}
```

Note the drawer's picker passes `onCreateNew={() => onSelectSet(set.id)}` — creating from *inside* the drawer is intentionally a no-op re-select (creation lives in the workspace picker and the tab; a nested create here would race the parent's drawer-open state for no gain). The drawer picker gets no `onManage`, so that option doesn't render.

- [ ] **Step 3: Integrate in WorkspacePage**

In `src/pages/WorkspacePage.tsx`:

1. Add to the props type and destructure:

```ts
  paintSets: PaintSet[];
  workingSetId: string;
  onSelectSet: (id: string) => void;
  onCreateSet: () => void;
  onRenameSet: (setId: string, name: string) => void;
  onDuplicateSet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onTogglePaintInSet: (setId: string, paintId: string) => void;
```

with imports `import type { PaintSet } from '../lib/paintSets';`, `import { PaintSetPicker } from '../components/PaintSetPicker';`, `import { PaintSetDrawer } from '../components/PaintSetDrawer';`.

2. Replace the Closest BASICS panel-head button (`<button className="text-button" onClick={() => setIsInventoryOpen(true)} ...>Edit paints · {ownedPaintIds.length}</button>`) with:

```tsx
                <div className="panel-head-actions">
                  <PaintSetPicker
                    onCreateNew={() => {
                      onCreateSet();
                      setIsInventoryOpen(true);
                    }}
                    onManage={() => {
                      window.location.hash = '#/palettes/sets';
                    }}
                    onSelect={onSelectSet}
                    sets={paintSets}
                    value={workingSetId}
                  />
                  <button
                    className="text-button"
                    onClick={() => setIsInventoryOpen(true)}
                    type="button"
                  >
                    Edit · {ownedPaintIds.length}
                  </button>
                </div>
```

3. Replace the whole inventory-drawer block (`{isInventoryOpen ? (<div className="drawer-backdrop" ...>...</div>) : null}`) with:

```tsx
      {isInventoryOpen ? (
        <PaintSetDrawer
          onClose={() => setIsInventoryOpen(false)}
          onDelete={onDeleteSet}
          onDuplicate={onDuplicateSet}
          onRename={onRenameSet}
          onSelectSet={onSelectSet}
          onTogglePaint={onTogglePaintInSet}
          setId={workingSetId}
          sets={paintSets}
        />
      ) : null}
```

4. Delete the now-unused drawer internals from WorkspacePage: the `paintQuery` state, the `filteredPaints` memo, and the `liquitexBasics` **drawer** usages — but keep the `liquitexBasics` import (the matches memo still uses it). Update the no-owned-paints empty state string from `Mark the paints you own ("Edit my paints" above) to get starter mixes.` to `Add paints to this set ("Edit" above) to get starter mixes.`

5. In `src/App.tsx`, add the new props to the `WorkspacePage` call:

```tsx
            paintSets={paintSets}
            workingSetId={workingSetId}
            onSelectSet={selectWorkingSet}
            onCreateSet={createWorkingSet}
            onRenameSet={renameSetById}
            onDuplicateSet={duplicateSetById}
            onDeleteSet={deleteSetById}
            onTogglePaintInSet={togglePaintInSet}
```

- [ ] **Step 4: Styles**

Append to `src/styles.css`, immediately before the `/* ---------- responsive ---------- */` section:

```css
/* ---------- paint sets ---------- */

.set-picker {
  max-width: 150px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 5px 10px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  font-size: 0.8rem;
}

.set-picker:focus {
  outline: none;
  border-color: var(--accent);
}

.panel-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.drawer-set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.drawer-set-actions {
  display: flex;
  gap: 12px;
  flex: none;
}

.rename-form input {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 6px 12px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
}
```

(`.rename-form input` **already exists** in styles.css for the palette-detail rename — verified — so do NOT re-add that rule; append only `.set-picker`, `.set-picker:focus`, `.panel-head-actions`, `.drawer-set-row`, and `.drawer-set-actions`.)

- [ ] **Step 5: Gates and smoke check**

Run: `npx tsc -b` — clean; `npm test` — all 109 pass.
Dev server: picker shows in the Closest BASICS header; switching sets changes matches/mixes; "＋ New set" creates + opens the drawer; drawer rename/duplicate/delete work; "Manage sets…" navigates to `#/palettes/sets` (blank until Task 6 — the gallery renders, tab appears in Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/components/PaintSetPicker.tsx src/components/PaintSetDrawer.tsx src/pages/WorkspacePage.tsx src/App.tsx src/styles.css
git commit -m "Paint sets: picker + set-aware drawer in the workspace"
```

---

### Task 5: Palette detail page — per-palette set picker

**Files:**
- Modify: `src/pages/PaletteDetailPage.tsx` (picker in `.sheet-actions`; new props)
- Modify: `src/App.tsx` (pass props)

**Interfaces:**
- Consumes: `PaintSetPicker` (Task 4); App handlers `setPaletteSet`, `createSetForPalette` (Task 3).
- Produces new PaletteDetailPage props: `paintSets: PaintSet[]`, `onSetPaintSet: (setId: string) => void`, `onCreateSetForPalette: () => void`. The displayed value is `resolveSetId(paintSets, palette.paintSetId)` so a dangling id shows its fallback honestly.

- [ ] **Step 1: Add the picker**

In `src/pages/PaletteDetailPage.tsx`:

1. Imports: `import { PaintSetPicker } from '../components/PaintSetPicker';`, `import { resolveSetId } from '../lib/paintSets';`, `import type { PaintSet } from '../lib/paintSets';`.
2. Props type + destructure: `paintSets: PaintSet[]`, `onSetPaintSet: (setId: string) => void`, `onCreateSetForPalette: () => void`.
3. In the `.sheet-actions` div, insert **before** the "Mix sheet" button:

```tsx
            <PaintSetPicker
              onCreateNew={onCreateSetForPalette}
              onManage={() => {
                window.location.hash = '#/palettes/sets';
              }}
              onSelect={onSetPaintSet}
              sets={paintSets}
              value={resolveSetId(paintSets, palette.paintSetId)}
            />
```

- [ ] **Step 2: Wire in App**

In the `PaletteDetailPage` render case add:

```tsx
            paintSets={paintSets}
            onSetPaintSet={(setId) => setPaletteSet(route.paletteId, setId)}
            onCreateSetForPalette={() => createSetForPalette(route.paletteId)}
```

- [ ] **Step 3: Gates and smoke check**

Run: `npx tsc -b` — clean; `npm test` — all pass.
Dev server: on a saved palette, switching the picker instantly changes the suggested mixes/usage; the change survives reload (debounced palette persistence); "Mix sheet" reflects the same set.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PaletteDetailPage.tsx src/App.tsx
git commit -m "Paint sets: per-palette set picker on the detail page"
```

---

### Task 6: Saved palettes page — tabs + Paint sets management hub

**Files:**
- Modify: `src/App.tsx` (route union + `routeFromHash` + render case)
- Modify: `src/pages/PalettesPage.tsx` (tabs; sets grid; drawer reuse)
- Modify: `src/styles.css` (tabs + set cards)

**Interfaces:**
- Consumes: `PaintSetDrawer` (Task 4); App handlers by id (Task 3); `liquitexBasics` for swatch previews.
- Produces: route case `{ page: 'palettes'; tab: 'palettes' | 'sets' }`; new PalettesPage props: `paintSets: PaintSet[]`, `tab: 'palettes' | 'sets'`, `onCreateSet: () => void`, `onRenameSet`, `onDuplicateSet`, `onDeleteSet`, `onTogglePaintInSet` (same signatures as Task 4's WorkspacePage props).

- [ ] **Step 1: Route**

In `src/App.tsx`:

1. Route union: replace `{ page: Page }` usage for palettes — change the union to:

```ts
type Route =
  | { page: 'start' }
  | { page: 'workspace' }
  | { page: 'palettes'; tab: 'palettes' | 'sets' }
  | { page: 'palette'; paletteId: string }
  | { page: 'sheet'; paletteId: string }
  | { page: 'shared'; encoded: string };
```

2. In `routeFromHash`, replace the `if (hash === 'workspace' || hash === 'palettes')` branch with:

```ts
  if (hash === 'workspace') {
    return { page: 'workspace' };
  }

  if (hash === 'palettes') {
    return { page: 'palettes', tab: 'palettes' };
  }

  // Must run before the detail regex, which would swallow 'palettes/sets'.
  if (hash === 'palettes/sets') {
    return { page: 'palettes', tab: 'sets' };
  }
```

(Keep this above the existing sheet/detail regex checks. Palette ids are UUIDs, so `'sets'` cannot collide.)

4. **Required (tab is now a mandatory field):** `routeFromHash` has two pre-existing malformed-link fallbacks inside the sheet-regex and detail-regex `catch` blocks that read `return { page: 'palettes' };` — both must become:

```ts
      return { page: 'palettes', tab: 'palettes' };
```

(A malformed link lands on the Palettes tab. Without this, `tsc` fails with TS2322 "Property 'tab' is missing" at both sites.)

3. Render case:

```tsx
        {route.page === 'palettes' ? (
          <PalettesPage
            onCreateSet={createWorkingSet}
            onDeleteSet={deleteSetById}
            onDuplicateSet={duplicateSetById}
            onRenameSet={renameSetById}
            onTogglePaintInSet={togglePaintInSet}
            paintSets={paintSets}
            palettes={savedPalettes}
            tab={route.tab}
          />
        ) : null}
```

(`createWorkingSet` also selects the new set as working — acceptable: creating a set makes it the one you're about to fill.)

- [ ] **Step 2: Rebuild PalettesPage with tabs**

Replace `src/pages/PalettesPage.tsx` with:

```tsx
import { useState } from 'react';
import { liquitexBasics } from '../data/liquitexBasics';
import { formatPaletteMeta } from '../lib/format';
import { PaintSetDrawer } from '../components/PaintSetDrawer';
import type { PaintSet } from '../lib/paintSets';
import type { SavedPalette } from '../types/palette';

const paintHexById = new Map(liquitexBasics.map((paint) => [paint.id, paint.hex]));

type PalettesPageProps = {
  palettes: SavedPalette[];
  paintSets: PaintSet[];
  tab: 'palettes' | 'sets';
  onCreateSet: () => void;
  onRenameSet: (setId: string, name: string) => void;
  onDuplicateSet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onTogglePaintInSet: (setId: string, paintId: string) => void;
};

export function PalettesPage({
  palettes,
  paintSets,
  tab,
  onCreateSet,
  onRenameSet,
  onDuplicateSet,
  onDeleteSet,
  onTogglePaintInSet,
}: PalettesPageProps) {
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const editingSet = editingSetId
    ? paintSets.find((set) => set.id === editingSetId) ?? null
    : null;

  return (
    <div className="page">
      <nav aria-label="Saved palettes sections" className="page-tabs">
        <a aria-current={tab === 'palettes' ? 'page' : undefined} href="#/palettes">
          Palettes
        </a>
        <a aria-current={tab === 'sets' ? 'page' : undefined} href="#/palettes/sets">
          Paint sets
        </a>
      </nav>

      {tab === 'palettes' ? (
        palettes.length === 0 ? (
          <p className="empty-state page-empty">
            No saved palettes yet. Build one in the <a href="#/workspace">workspace</a>.
          </p>
        ) : (
          <ul className="palette-gallery">
            {palettes.map((palette) => (
              <li key={palette.id}>
                <a className="gallery-card" href={`#/palettes/${palette.id}`}>
                  {palette.artwork ? (
                    <img alt="" className="gallery-thumb" src={palette.artwork.thumbnailDataUrl} />
                  ) : null}
                  <span aria-hidden className="gallery-strip">
                    {palette.colors.map((color) => (
                      <span key={color.id} style={{ backgroundColor: color.hex }} />
                    ))}
                  </span>
                  <span className="gallery-head">
                    <span className="gallery-name">{palette.name}</span>
                    <span className="gallery-meta">{formatPaletteMeta(palette)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="set-cards">
          {paintSets.map((set) => (
            <li className="set-card" key={set.id}>
              <div className="set-card-head">
                <span className="set-card-name">{set.name}</span>
                <span className="micro">
                  {set.paintIds.length} paint{set.paintIds.length === 1 ? '' : 's'}
                  {set.isPreset ? ' · preset' : ''}
                </span>
              </div>
              <div aria-hidden className="set-card-strip">
                {set.paintIds.slice(0, 6).map((paintId) => (
                  <span key={paintId} style={{ backgroundColor: paintHexById.get(paintId) ?? '#EEE' }} />
                ))}
                {set.paintIds.length === 0 ? <span className="empty" /> : null}
              </div>
              <div className="set-card-actions">
                <button className="text-link" onClick={() => setEditingSetId(set.id)} type="button">
                  Edit
                </button>
                <button className="text-link" onClick={() => onDuplicateSet(set.id)} type="button">
                  Duplicate
                </button>
                <button
                  className="text-link danger"
                  onClick={() => {
                    if (editingSetId === set.id) {
                      setEditingSetId(null);
                    }
                    onDeleteSet(set.id);
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          <li>
            <button className="set-new-card" onClick={onCreateSet} type="button">
              ＋ New paint set
            </button>
          </li>
        </ul>
      )}

      {editingSet ? (
        <PaintSetDrawer
          onClose={() => setEditingSetId(null)}
          onDelete={(setId) => {
            setEditingSetId(null);
            onDeleteSet(setId);
          }}
          onDuplicate={onDuplicateSet}
          onRename={onRenameSet}
          onSelectSet={setEditingSetId}
          onTogglePaint={onTogglePaintInSet}
          setId={editingSet.id}
          sets={paintSets}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Styles**

Append to `src/styles.css` inside the paint-sets block (after `.rename-form input`):

```css
.page-tabs {
  display: flex;
  gap: 22px;
  align-items: baseline;
  border-bottom: 1px solid var(--line);
  margin-bottom: 22px;
}

.page-tabs a {
  padding-bottom: 10px;
  color: var(--ink-faint);
  font-size: 1.05rem;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.page-tabs a:hover {
  color: var(--ink);
}

.page-tabs a[aria-current='page'] {
  color: var(--ink);
  border-bottom-color: var(--ink);
}

.set-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.set-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px 18px;
  background: var(--card);
}

.set-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.set-card-name {
  font-size: 1.15rem;
}

.set-card-strip {
  display: flex;
  gap: 4px;
  margin: 12px 0 14px;
  min-height: 26px;
}

.set-card-strip span {
  flex: 1;
  height: 26px;
  border-radius: 5px;
  border: 1px solid rgba(47, 50, 53, 0.06);
}

.set-card-strip .empty {
  border: 1.5px dashed var(--line);
  background: transparent;
}

.set-card-actions {
  display: flex;
  gap: 16px;
}

.text-link.danger {
  color: var(--danger);
}

.set-new-card {
  width: 100%;
  min-height: 120px;
  border: 1.5px dashed var(--ink-faint);
  border-radius: 16px;
  background: transparent;
  color: var(--ink-faint);
  font: inherit;
  font-style: italic;
  font-size: 0.95rem;
}

.set-new-card:hover {
  border-color: var(--accent);
  color: var(--ink-soft);
  background: var(--accent-wash);
}
```

- [ ] **Step 4: Gates and smoke check**

Run: `npx tsc -b` — clean; `npm test` — all pass.
Dev server: `#/palettes` shows the Palettes tab with the existing gallery; `#/palettes/sets` shows set cards (Starter tagged "preset"); Edit opens the drawer on this page; Duplicate/Delete work; deleting the last set re-seeds Starter; "＋ New paint set" adds a card; nav highlight stays on Saved palettes for both tabs.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/PalettesPage.tsx src/styles.css
git commit -m "Paint sets: Palettes/Paint sets tabs and management hub"
```

---

### Task 7: Browser verification pass

**Files:** none (verification only; fix-and-recommit anything found).

- [ ] **Step 1: Migration identity.** Clear `paintbridge.paintSets.v1`, seed `paintbridge.ownedPaints.v1` with a known list and a saved palette (no `paintSetId`) whose colors have no preferredRecipe; load the app. Verify: sets = [Starter (preset), My paints (the seeded ids)]; the palette detail page's suggested mixes are **identical** to the same fixture on the pre-feature build (spot-check one color's mix line), and the old owned-paints key is unchanged in storage.
- [ ] **Step 2: Workspace flow.** Picker in the Closest BASICS header; switching sets changes matches + starter mixes; "＋ New set" creates, selects, opens the drawer; ticking paints updates mixes live; rename/duplicate/delete from the drawer; deleting the working set falls back and the UI follows.
- [ ] **Step 3: Per-palette sets.** Save a palette under set A; switch workspace to set B → saved palette detail still mixes from A; change its picker to B → mixes change and survive reload; "Edit in workspace" adopts B as working; the mix sheet uses the palette's set; a shared link still opens (recipes baked).
- [ ] **Step 4: Tab hub.** `#/palettes/sets` from "Manage sets…"; cards show counts/preset tag/previews; Edit/Duplicate/Delete; delete-last re-seeds Starter; back button returns to the Palettes tab.
- [ ] **Step 5: Edges.** Empty set shows the existing "no mixes" empty states everywhere; empty rename rejected; malformed `paintSets.v1` (hand-write garbage) re-seeds instead of crashing; localStorage keys after a full session: `paintSets.v1` present, `ownedPaints.v1` byte-identical to seed.
- [ ] **Step 6: Mobile 375px** — picker, drawer, tabs, and set cards fit; no horizontal scroll. Console clean throughout.
- [ ] **Step 7: Final gates** `npx tsc -b` + `npm test`; commit any fixes separately; **STOP for Diane's UAT** — no PR (one per phase).

---

## Self-review notes (already applied)

- Spec coverage: model/key/migration → Tasks 1–2; resolution seam + per-palette stamping + edit-adopts-set → Task 3; workspace picker + set-aware drawer (rename/duplicate/delete, "N of 72 in this set") → Task 4; detail-page picker → Task 5; tabs + cards + delete-last-reseeds + `#/palettes/sets` → Task 6; identity-migration + edge verification → Task 7. Non-goals untouched (no backend, no set sharing).
- Naming consistency: `resolveSetId`/`resolvePaintIds`/`togglePaintInSet`/`onTogglePaint(setId, paintId)` used identically across tasks; WorkspacePage's existing `ownedPaintIds`/`onToggleOwnedPaint` props are kept (drawer checkboxes now call `onTogglePaint` directly, so `onToggleOwnedPaint` remains only for any other callers — after Task 4 it is actually unused by the drawer; it stays passed for the matches "owned" tags which read `ownedPaintIds` only).
- The `.js`-suffix rule is stated in the header and applied in Task 2's storage imports (`./paintSets.js` for values); components/pages/App use suffix-free imports (not in the test config).
- `sanitizeSavedPalettes` change is covered by a test that a numeric `paintSetId` is dropped (the old spread would have kept it).
