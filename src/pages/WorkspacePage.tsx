import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ImageColorPicker } from '../components/ImageColorPicker';
import { ImageUploader } from '../components/ImageUploader';
import { ManualColorInput } from '../components/ManualColorInput';
import { MixComparison } from '../components/MixComparison';
import { MixEditor } from '../components/MixEditor';
import { WorkingPaletteStrip } from '../components/WorkingPaletteStrip';
import { liquitexBasics } from '../data/liquitexBasics';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { formatRgb, getPrintViability, hexToRgb } from '../lib/color';
import { CONFIDENCE_LABEL, matchPaints } from '../lib/paintMatching';
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
  onMoveColor: (id: string, delta: number) => void;
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
  onMoveColor,
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
  const [paintQuery, setPaintQuery] = useState('');
  const [labelDraft, setLabelDraft] = useState('');

  const activeColor = colors.find((color) => color.id === activeColorId) ?? null;
  const inspectedHex = preview ? preview.hex : activeColor?.hex ?? null;
  const inspectedRgb = inspectedHex ? hexToRgb(inspectedHex) : null;
  const viability = inspectedRgb ? getPrintViability(inspectedRgb) : null;

  // Matching and mix search are expensive; defer them so marker drags stay
  // smooth and only the settled color pays for the computation.
  const deferredHex = useDeferredValue(inspectedHex);

  const matches = useMemo(() => {
    const rgb = deferredHex ? hexToRgb(deferredHex) : null;
    return rgb ? matchPaints(rgb, liquitexBasics, 4) : [];
  }, [deferredHex]);

  const filteredPaints = useMemo(() => {
    const query = paintQuery.trim().toLowerCase();
    return query
      ? liquitexBasics.filter((paint) => paint.name.toLowerCase().includes(query))
      : liquitexBasics;
  }, [paintQuery]);

  const ownedPaints = useMemo(
    () => liquitexBasics.filter((paint) => ownedPaintIds.includes(paint.id)),
    [ownedPaintIds],
  );

  // Preview colors aren't in the palette yet, so they get a read-only
  // suggestion; palette colors get the full editor.
  const previewRecipe = useMemo(() => {
    const rgb = preview ? hexToRgb(preview.hex) : null;
    return rgb && ownedPaints.length > 0 ? suggestMixes(rgb, ownedPaints, 1)[0] ?? null : null;
  }, [preview, ownedPaints]);

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
          ? `Regenerated ${added} color${added === 1 ? '' : 's'} from the artwork.`
          : 'No colors found in the artwork.',
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

  // Reseed the label field when the selected color changes.
  useEffect(() => {
    setLabelDraft(activeColor?.label ?? '');
  }, [activeColor?.id, activeColor?.label]);

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
            <div className="panel">
              <p className="eyebrow">Artwork</p>
              <ImageUploader onSelect={onArtworkSelected} />
            </div>
          )}

          <div>
            <WorkingPaletteStrip
              activeColorId={preview ? null : activeColorId}
              colors={colors}
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
                      onClick={() => onPaletteSizeChange(paletteSize - 1)}
                      type="button"
                    >
                      −
                    </button>
                    <span className="palette-size-value">{paletteSize}</span>
                    <button
                      aria-label="More colors"
                      className="parts-step"
                      disabled={paletteSize >= MAX_PALETTE_SIZE}
                      onClick={() => onPaletteSizeChange(paletteSize + 1)}
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
        </section>

        <aside className="workspace-column" aria-label="Color inspector">
          <article className="panel">
            <p className="eyebrow">Selected color</p>
            {inspectedHex && inspectedRgb && viability ? (
              <>
                <div className="target-head">
                  <div
                    aria-label={`Selected color ${inspectedHex}`}
                    className="target-chip"
                    style={{ backgroundColor: inspectedHex }}
                  />
                  <div>
                    <h2 className="target-name">{inspectedHex}</h2>
                    <p className="target-from">{inspectedLabel}</p>
                  </div>
                </div>
                <dl className="color-values">
                  <div>
                    <dt>RGB</dt>
                    <dd>{formatRgb(inspectedRgb)}</dd>
                  </div>
                </dl>
                <span className="outlook">{viability}</span>
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
                    <label className="field-label" htmlFor="active-color-label">
                      Name
                    </label>
                    <input
                      className="color-label-input"
                      id="active-color-label"
                      onBlur={() => onSetColorLabel(activeColor.id, labelDraft)}
                      onChange={(event) => setLabelDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          onSetColorLabel(activeColor.id, labelDraft);
                          event.currentTarget.blur();
                        }
                      }}
                      placeholder="e.g. Sky"
                      value={labelDraft}
                    />
                    <div className="reorder-controls">
                      <button
                        className="secondary-button"
                        disabled={colors[0]?.id === activeColor.id}
                        onClick={() => onMoveColor(activeColor.id, -1)}
                        type="button"
                      >
                        ← Move left
                      </button>
                      <button
                        className="secondary-button"
                        disabled={colors[colors.length - 1]?.id === activeColor.id}
                        onClick={() => onMoveColor(activeColor.id, 1)}
                        type="button"
                      >
                        Move right →
                      </button>
                    </div>
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
            <p className="eyebrow">Closest Liquitex BASICS</p>
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
            <button
              className="secondary-button"
              onClick={() => setIsInventoryOpen(true)}
              type="button"
            >
              Edit my paints · {ownedPaintIds.length}
            </button>
          </article>

          <article className="panel">
            <p className="eyebrow">Starter mix</p>
            {!inspectedHex ? (
              <p className="empty-state">Select a color first.</p>
            ) : ownedPaints.length === 0 ? (
              <p className="empty-state">
                Mark the paints you own ("Edit my paints" above) to get starter mixes.
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
              <MixEditor
                footnote="Approximate · test a swatch first"
                onPreferredChange={(recipe) => onSetColorRecipe(activeColor.id, recipe)}
                ownedPaints={ownedPaints}
                preferred={activeColor.preferredRecipe ?? null}
                targetHex={activeColor.hex}
              />
            ) : null}
          </article>

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
        </aside>
      </div>

      {isInventoryOpen ? (
        <div className="drawer-backdrop" onClick={() => setIsInventoryOpen(false)}>
          <aside
            aria-label="Paint inventory"
            className="drawer"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="drawer-head">
              <h2>My paints</h2>
              <button
                className="secondary-button"
                onClick={() => setIsInventoryOpen(false)}
                type="button"
              >
                Close
              </button>
            </header>
            <input
              aria-label="Search paints"
              autoFocus
              className="drawer-search"
              onChange={(event) => setPaintQuery(event.target.value)}
              placeholder="Search paints"
              value={paintQuery}
            />
            <p className="micro">
              {ownedPaintIds.length} of {liquitexBasics.length} owned · approximate colors
            </p>
            {filteredPaints.length > 0 ? (
              <ul className="paint-list">
                {filteredPaints.map((paint) => (
                  <li key={paint.id}>
                    <label className="paint-row">
                      <span
                        aria-hidden
                        className="mini-swatch"
                        style={{ backgroundColor: paint.hex }}
                      />
                      <span className="paint-name">{paint.name}</span>
                      <input
                        checked={ownedPaintIds.includes(paint.id)}
                        onChange={() => onToggleOwnedPaint(paint.id)}
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
      ) : null}
    </div>
  );
}
