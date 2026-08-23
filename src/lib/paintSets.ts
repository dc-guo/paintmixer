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
