import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ImageColorPicker } from '../components/ImageColorPicker';
import { ImageUploader } from '../components/ImageUploader';
import { ManualColorInput } from '../components/ManualColorInput';
import { MixComparison } from '../components/MixComparison';
import { MixEditor } from '../components/MixEditor';
import { PaintSetDrawer } from '../components/PaintSetDrawer';
import { PaintSetPicker } from '../components/PaintSetPicker';
import { SwatchCheckModal } from '../components/SwatchCheckModal';
import { WorkingPaletteStrip } from '../components/WorkingPaletteStrip';
import { liquitexBasics } from '../data/liquitexBasics';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { getPrintViability, hexToRgb } from '../lib/color';
import { CONFIDENCE_LABEL, matchPaints } from '../lib/paintMatching';
import type { PaintSet } from '../lib/paintSets';
import { normalizeLabel } from '../lib/paletteEdits';
import { suggestMixes } from '../lib/recipeEngine';
import { MAX_PALETTE_SIZE, MIN_PALETTE_SIZE } from '../lib/storage';
import type { MixRecipe } from '../types/paint';
import type { ColorSource, SampledColor } from '../types/palette';

type Artwork = {
  dataUrl: string;
  name: string;
};

type Preview = {
  hex: string;
  position: { x: number; y: number };
};

type WorkspacePageProps = {
  artwork: Artwork | null;
  colors: SampledColor[];
  activeColorId: string | null;
  /** Name of the saved palette being edited, or null when starting fresh. */
  editingPaletteName: string | null;
  onArtworkSelected: (dataUrl: string, name: string) => void;
  /** Resolves with the number of colors added, or null when extraction failed. */
  onAutoGenerate: () => Promise<number | null>;
  onAddColor: (
    hex: string,
    source: ColorSource,
    position?: SampledColor['position'],
  ) => void;
  onUpdateColor: (id: string, hex: string, position?: SampledColor['position']) => void;
  onSelectColor: (id: string) => void;
  onRemoveColor: (id: string) => void;
  onSavePalette: (name: string) => Promise<boolean>;
  onSetColorRecipe: (colorId: string, recipe: MixRecipe | null) => void;
  ownedPaintIds: string[];
  onToggleOwnedPaint: (id: string) => void;
  paletteSize: number;
  onPaletteSizeChange: (next: number) => void;
  onSetColorLabel: (id: string, label: string) => void;
  onSetColorNotes: (id: string, notes: string) => void;
  onMoveColor: (id: string, delta: number) => void;
  paintSets: PaintSet[];
  workingSetId: string;
  onSelectSet: (id: string) => void;
  onCreateSet: () => void;
  onRenameSet: (setId: string, name: string) => void;
  onDuplicateSet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onTogglePaintInSet: (setId: string, paintId: string) => void;
};

export function WorkspacePage({
  artwork,
  colors,
  activeColorId,
  editingPaletteName,
  onArtworkSelected,
  onAutoGenerate,
  onAddColor,
  onUpdateColor,
  onSelectColor,
  onRemoveColor,
  onSavePalette,
  onSetColorRecipe,
  ownedPaintIds,
  onToggleOwnedPaint,
  paletteSize,
  onPaletteSizeChange,
  onSetColorLabel,
  onSetColorNotes,
  onMoveColor,
  paintSets,
  workingSetId,
  onSelectSet,
  onCreateSet,
  onRenameSet,
  onDuplicateSet,
  onDeleteSet,
  onTogglePaintInSet,
}: WorkspacePageProps) {
  const [paletteName, setPaletteName] = useState(editingPaletteName ?? '');
  const [justSaved, setJustSaved] = useState<'saved' | 'updated' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Ref, not state: rapid double-submits land before React re-renders, so a
  // state flag would still read false in both handlers' closures.
  const isSavingRef = useRef(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [isSwatchCheckOpen, setIsSwatchCheckOpen] = useState(false);
  // Roving-focus targets for the compact reorder arrows (finding n=9): after a
  // move, focus must land on a usable control, never on a disabled one or body.
  const moveLeftRef = useRef<HTMLButtonElement | null>(null);
  const moveRightRef = useRef<HTMLButtonElement | null>(null);

  const activeColor = colors.find((color) => color.id === activeColorId) ?? null;
  const inspectedHex = preview ? preview.hex : activeColor?.hex ?? null;
  const inspectedRgb = inspectedHex ? hexToRgb(inspectedHex) : null;
  const viability = inspectedRgb ? getPrintViability(inspectedRgb) : null;

  // Matching and mix search are expensive; defer them so marker drags stay
  // smooth and only the settled color pays for the computation.
  const deferredHex = useDeferredValue(inspectedHex);

  const matches = useMemo(() => {
    const rgb = deferredHex ? hexToRgb(deferredHex) : null;
    return rgb ? matchPaints(rgb, liquitexBasics, 3) : [];
  }, [deferredHex]);

  const ownedPaints = useMemo(
    () => liquitexBasics.filter((paint) => ownedPaintIds.includes(paint.id)),
    [ownedPaintIds],
  );

  // Preview colors aren't in the palette yet, so they get a read-only
  // suggestion; palette colors get the full editor. Same deferral pattern as
  // deferredHex above: key the search on a deferred value so the marker and
  // panel paint immediately on every click and the (expensive) search lands
  // in the deferred pass, not the urgent one. Position isn't needed here.
  const deferredPreviewHex = useDeferredValue(preview?.hex ?? null);

  const previewRecipe = useMemo(() => {
    const rgb = deferredPreviewHex ? hexToRgb(deferredPreviewHex) : null;
    return rgb && ownedPaints.length > 0 ? suggestMixes(rgb, ownedPaints, 1)[0] ?? null : null;
  }, [deferredPreviewHex, ownedPaints]);

  // Mirrors the resolution MixEditor uses: preferred recipe wins, else fall
  // back to one live suggestion from owned paints.
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

  const inspectedLabel = preview
    ? 'previewing — not in palette'
    : activeColor?.source === 'manual'
      ? 'entered by hex'
      : 'from artwork';

  const selectColor = (id: string) => {
    setPreview(null);
    onSelectColor(id);
  };

  const addPreviewToPalette = () => {
    if (!preview) {
      return;
    }

    onAddColor(preview.hex, 'image', preview.position);
    setPreview(null);
  };

  const handleAutoGenerate = async () => {
    setIsAutoGenerating(true);
    const added = await onAutoGenerate();
    setIsAutoGenerating(false);
    setAutoMessage(
      added === null
        ? 'Could not read the artwork.'
        : added > 0
          ? // Count is the true inserted count: App's gen-guard already rules
            // out the stale-extraction race that could otherwise overstate it.
            `Regenerated ${added} color${added === 1 ? '' : 's'} from the artwork.`
          : // added === 0 means extraction succeeded but every extracted hex
            // was already kept — not that the artwork has no readable colors.
            'Those colors are already in your palette.',
    );
  };

  // The confirmation describes the palette as saved, so clear it as soon as
  // the working palette diverges from what was saved.
  useEffect(() => {
    setJustSaved(null);
  }, [colors]);

  useEscapeKey(isInventoryOpen, () => setIsInventoryOpen(false));

  // Keep the name field in step with the editing session (cleared when a new
  // upload starts a fresh project while this page stays mounted).
  useEffect(() => {
    setPaletteName(editingPaletteName ?? '');
  }, [editingPaletteName]);

  // Reseed the label field only when the *selected color* changes — deliberately
  // not when its label changes. The field autosaves as you type; our own write
  // updates activeColor.label, and reseeding on that would echo the normalized
  // (trimmed) value straight back into the box and eat trailing spaces mid-word.
  // Keying on id alone also means a focused field is never yanked out from under
  // the user, so no focus-tracking ref is needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLabelDraft(activeColor?.label ?? '');
  }, [activeColor?.id]);

  // Autosave the name. Debounced so a rename is one storage write, not one per
  // keystroke; blur still saves immediately. The comparison is against the
  // normalized draft because that is what gets stored — comparing raw text would
  // re-fire forever on any name the normalizer trims.
  useEffect(() => {
    if (!activeColorId || normalizeLabel(labelDraft) === activeColor?.label) {
      return;
    }

    const timer = setTimeout(() => onSetColorLabel(activeColorId, labelDraft), 400);
    return () => clearTimeout(timer);
  }, [labelDraft, activeColorId, activeColor?.label, onSetColorLabel]);

  // Reseed the notes field when the selected color changes.
  useEffect(() => {
    setNotesDraft(activeColor?.notes ?? '');
  }, [activeColor?.id, activeColor?.notes]);

  const isFirstColor = activeColor ? colors[0]?.id === activeColor.id : false;
  const isLastColor = activeColor ? colors[colors.length - 1]?.id === activeColor.id : false;

  // The chip arrows step the selection to the previous/next color. They use
  // aria-disabled (not the disabled attribute) so they stay focusable — a real
  // disabled attribute drops focus to <body> the instant the button disables
  // itself under the user's own click. On reaching an end, hand focus to the
  // still-usable sibling arrow so keyboard stepping can continue.
  const navigateColor = (delta: number) => {
    if (!activeColor) {
      return;
    }

    const atEnd = delta < 0 ? isFirstColor : isLastColor;
    if (atEnd) {
      return;
    }

    const currentIndex = colors.findIndex((color) => color.id === activeColor.id);
    const nextIndex = Math.min(colors.length - 1, Math.max(0, currentIndex + delta));
    selectColor(colors[nextIndex].id);

    const clickedRef = delta < 0 ? moveLeftRef : moveRightRef;
    const siblingRef = delta < 0 ? moveRightRef : moveLeftRef;
    const clickedStillUsable = delta < 0 ? nextIndex > 0 : nextIndex < colors.length - 1;
    (clickedStillUsable ? clickedRef : siblingRef).current?.focus();
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const wasUpdate = Boolean(editingPaletteName);
      const saved = await onSavePalette(
        paletteName.trim() || editingPaletteName || 'Untitled palette',
      );

      if (saved) {
        setJustSaved(wasUpdate ? 'updated' : 'saved');
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="workspace-columns">
        <section className="workspace-column" aria-label="Artwork and working palette">
          {artwork ? (
            <ImageColorPicker
              dataUrl={artwork.dataUrl}
              markers={colors
                .filter((color) => color.position)
                .map((color) => ({
                  id: color.id,
                  hex: color.hex,
                  x: color.position?.x ?? 0,
                  y: color.position?.y ?? 0,
                  active: !preview && color.id === activeColorId,
                }))}
              onMarkerDrag={onUpdateColor}
              onMarkerSelect={selectColor}
              onPreview={(hex, position) => setPreview({ hex, position })}
              preview={preview?.position ?? null}
            />
          ) : (
            <div className="artwork-empty">
              <p className="eyebrow">Artwork</p>
              <ImageUploader onSelect={onArtworkSelected} />
            </div>
          )}

          <div>
            <WorkingPaletteStrip
              activeColorId={preview ? null : activeColorId}
              colors={colors}
              onMove={onMoveColor}
              onRemove={onRemoveColor}
              onSelect={selectColor}
            />
            <div className="strip-caption">
              <span className="micro">
                Working palette · {colors.length}
              </span>
              {artwork ? (
                <div className="strip-actions">
                  <span
                    aria-label="Number of colors to extract"
                    className="palette-size"
                    role="group"
                  >
                    <button
                      aria-label="Fewer colors"
                      className="parts-step"
                      disabled={paletteSize <= MIN_PALETTE_SIZE}
                      onClick={() => {
                        const next = paletteSize - 1;
                        onPaletteSizeChange(next);
                        setAutoMessage(`Updating palette to ${next} colors…`);
                      }}
                      type="button"
                    >
                      −
                    </button>
                    <span aria-live="polite" className="palette-size-value">
                      {paletteSize}
                    </span>
                    <button
                      aria-label="More colors"
                      className="parts-step"
                      disabled={paletteSize >= MAX_PALETTE_SIZE}
                      onClick={() => {
                        const next = paletteSize + 1;
                        onPaletteSizeChange(next);
                        setAutoMessage(`Updating palette to ${next} colors…`);
                      }}
                      type="button"
                    >
                      +
                    </button>
                  </span>
                  <button
                    className="text-link"
                    disabled={isAutoGenerating}
                    onClick={() => void handleAutoGenerate()}
                    type="button"
                  >
                    {isAutoGenerating ? 'Generating…' : 'Re-generate'}
                  </button>
                </div>
              ) : null}
            </div>
            {autoMessage ? (
              <p className="quiet-note" role="status">
                {autoMessage}
              </p>
            ) : null}
            <details className="manual-add">
              <summary>Add a color by hex</summary>
              <ManualColorInput onSubmit={(hex) => onAddColor(hex, 'manual')} />
            </details>
          </div>

          <article className="panel">
            <p className="eyebrow">Project record</p>
            <form className="save-form" onSubmit={(event) => void handleSave(event)}>
              <input
                aria-label="Palette name"
                onChange={(event) => setPaletteName(event.target.value)}
                placeholder="Palette name"
                value={paletteName}
              />
              <div className="save-row">
                <button
                  className="primary-button"
                  disabled={colors.length === 0 || isSaving}
                  type="submit"
                >
                  {isSaving ? 'Saving…' : editingPaletteName ? 'Update palette' : 'Save palette'}
                </button>
                {justSaved ? (
                  <span className="save-confirm" role="status">
                    ✓ {justSaved === 'updated' ? 'Updated' : 'Saved'} — <a href="#/palettes">view</a>
                  </span>
                ) : null}
              </div>
            </form>
            {editingPaletteName && !justSaved ? (
              <p className="quiet-note">Editing "{editingPaletteName}" — saving updates it.</p>
            ) : null}
          </article>
        </section>

        <aside className="workspace-column" aria-label="Color inspector">
          <div className="inspector-top">
            <article className="panel">
              <div className="panel-head">
                <p className="eyebrow">Selected color</p>
                {activeColor && !preview ? (
                  <div className="inspector-arrows">
                    <button
                      aria-disabled={isFirstColor}
                      aria-label="Previous color"
                      className={isFirstColor ? 'parts-step inert' : 'parts-step'}
                      onClick={() => navigateColor(-1)}
                      ref={moveLeftRef}
                      type="button"
                    >
                      ←
                    </button>
                    <button
                      aria-disabled={isLastColor}
                      aria-label="Next color"
                      className={isLastColor ? 'parts-step inert' : 'parts-step'}
                      onClick={() => navigateColor(1)}
                      ref={moveRightRef}
                      type="button"
                    >
                      →
                    </button>
                  </div>
                ) : null}
              </div>
              {inspectedHex && inspectedRgb && viability ? (
                <>
                  <div className="target-head">
                    <div
                      aria-label={`Selected color ${inspectedHex}`}
                      className="target-chip"
                      style={{ backgroundColor: inspectedHex }}
                    />
                    <div className="target-info">
                      {activeColor && !preview ? (
                        <input
                          aria-label="Color name"
                          className="target-name-field"
                          onBlur={() => {
                            onSetColorLabel(activeColor.id, labelDraft);
                            // Settle the field to what was actually stored.
                            setLabelDraft(normalizeLabel(labelDraft) ?? '');
                          }}
                          onChange={(event) => setLabelDraft(event.target.value)}
                          placeholder="name…"
                          value={labelDraft}
                        />
                      ) : (
                        <h2 className="target-name">{inspectedHex}</h2>
                      )}
                      <p className="target-from">
                        {activeColor && !preview
                          ? `${inspectedHex} · ${inspectedLabel}`
                          : inspectedLabel}
                      </p>
                    </div>
                  </div>
                  <p className="viability-note">{viability}</p>
                  {preview ? (
                    <div>
                      <button
                        className="secondary-button"
                        onClick={addPreviewToPalette}
                        type="button"
                      >
                        Add to palette
                      </button>
                    </div>
                  ) : null}
                  {activeColor && !preview ? (
                    <div className="color-tools">
                      <label className="field-label" htmlFor="active-color-notes">
                        Notes
                      </label>
                      <textarea
                        className="color-notes-input"
                        id="active-color-notes"
                        onBlur={() => onSetColorNotes(activeColor.id, notesDraft)}
                        onChange={(event) => setNotesDraft(event.target.value)}
                        placeholder="anything to remember — where it's used, how it mixed, what to tweak…"
                        value={notesDraft}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="empty-state">
                  Click the artwork to preview a color, or drag a marker to re-sample one.
                </p>
              )}
            </article>

            <article className="panel">
              <div className="panel-head">
                <p className="eyebrow">Closest Liquitex BASICS</p>
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
              </div>
              {matches.length > 0 ? (
                <ul className="match-list">
                  {matches.map((match) => (
                    <li className="match-row" key={match.paint.id}>
                      <span
                        aria-hidden
                        className="match-dot"
                        style={{ backgroundColor: match.paint.hex }}
                      />
                      <span className="match-name">
                        <span className="n">{match.paint.name}</span>
                        <span className="d">
                          {ownedPaintIds.includes(match.paint.id) ? (
                            <span className="owned-mark">owned</span>
                          ) : (
                            'not owned'
                          )}
                        </span>
                      </span>
                      <span className={`match-tag ${CONFIDENCE_LABEL[match.confidence]}`}>
                        {CONFIDENCE_LABEL[match.confidence]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state">Select a color to see the closest paints.</p>
              )}
            </article>
          </div>

          <article className="panel">
            <p className="eyebrow">Starter mix</p>
            {!inspectedHex ? (
              <p className="empty-state">Select a color first.</p>
            ) : ownedPaints.length === 0 ? (
              <p className="empty-state">
                Add paints to this set ("Edit" above) to get starter mixes.
              </p>
            ) : preview ? (
              !previewRecipe ? (
                <p className="empty-state">No workable mix from your paints.</p>
              ) : (
                <>
                  <div className="mix-pills">
                    {previewRecipe.ingredients.map((ingredient) => (
                      <span className="mix-pill" key={ingredient.paintId}>
                        <span className="parts">{ingredient.parts}</span>
                        {ingredient.paintName}
                      </span>
                    ))}
                  </div>
                  <MixComparison recipe={previewRecipe} />
                  <p className="quiet-note">Add the color to your palette to adjust this mix.</p>
                  <span className="micro mix-foot">Approximate · test a swatch first</span>
                </>
              )
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
          </article>

        </aside>
      </div>

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

      {isSwatchCheckOpen && activeColor ? (
        <SwatchCheckModal
          onClose={() => setIsSwatchCheckOpen(false)}
          recipe={activeRecipe}
          targetHex={activeColor.hex}
        />
      ) : null}
    </div>
  );
}
