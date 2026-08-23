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
