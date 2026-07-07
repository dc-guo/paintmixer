import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ImageColorPicker } from '../components/ImageColorPicker';
import { ImageUploader } from '../components/ImageUploader';
import { ManualColorInput } from '../components/ManualColorInput';
import { WorkingPaletteStrip } from '../components/WorkingPaletteStrip';
import { liquitexBasics } from '../data/liquitexBasics';
import { getPrintViability, hexToRgb, rgbToCmyk } from '../lib/color';
import { matchPaints } from '../lib/paintMatching';
import { suggestMixes } from '../lib/recipeEngine';
import type { ColorSource, SampledColor } from '../types/palette';

const CONFIDENCE_LABEL = { high: 'close', medium: 'fair', low: 'far' } as const;

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
  onArtworkSelected: (dataUrl: string, name: string) => void;
  onAutoGenerate: () => Promise<number>;
  onAddColor: (
    hex: string,
    source: ColorSource,
    position?: SampledColor['position'],
  ) => void;
  onUpdateColor: (id: string, hex: string, position?: SampledColor['position']) => void;
  onSelectColor: (id: string) => void;
  onRemoveColor: (id: string) => void;
  onSavePalette: (name: string) => boolean;
  ownedPaintIds: string[];
  onToggleOwnedPaint: (id: string) => void;
};

export function WorkspacePage({
  artwork,
  colors,
  activeColorId,
  onArtworkSelected,
  onAutoGenerate,
  onAddColor,
  onUpdateColor,
  onSelectColor,
  onRemoveColor,
  onSavePalette,
  ownedPaintIds,
  onToggleOwnedPaint,
}: WorkspacePageProps) {
  const [paletteName, setPaletteName] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [paintQuery, setPaintQuery] = useState('');

  const activeColor = colors.find((color) => color.id === activeColorId) ?? null;
  const inspectedHex = preview ? preview.hex : activeColor?.hex ?? null;
  const inspectedRgb = inspectedHex ? hexToRgb(inspectedHex) : null;
  const inspectedCmyk = inspectedRgb ? rgbToCmyk(inspectedRgb) : null;
  const viability = inspectedRgb ? getPrintViability(inspectedRgb) : null;

  const matches = useMemo(
    () => (inspectedRgb ? matchPaints(inspectedRgb, liquitexBasics, 4) : []),
    [inspectedHex],
  );

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

  const bestRecipe = useMemo(
    () =>
      inspectedRgb && ownedPaints.length > 0
        ? suggestMixes(inspectedRgb, ownedPaints, 1)[0] ?? null
        : null,
    [inspectedHex, ownedPaints],
  );

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
      added > 0
        ? `Added ${added} color${added === 1 ? '' : 's'}.`
        : 'The dominant colors are already here.',
    );
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const saved = onSavePalette(paletteName.trim() || 'Untitled palette');

    if (saved) {
      setSaveMessage('Saved.');
      setPaletteName('');
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
                <button
                  className="text-link"
                  disabled={isAutoGenerating}
                  onClick={() => void handleAutoGenerate()}
                  type="button"
                >
                  {isAutoGenerating ? 'Generating…' : 'Re-generate'}
                </button>
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
            {inspectedHex && inspectedRgb && inspectedCmyk && viability ? (
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
                    <dd>{`${inspectedRgb.r} · ${inspectedRgb.g} · ${inspectedRgb.b}`}</dd>
                  </div>
                  <div>
                    <dt>CMYK ≈</dt>
                    <dd>{`${inspectedCmyk.c} · ${inspectedCmyk.m} · ${inspectedCmyk.y} · ${inspectedCmyk.k}`}</dd>
                  </div>
                </dl>
                <span className="outlook">{viability.status}</span>
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
                        ΔE ≈ {Math.round(match.deltaE)} ·{' '}
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
            ) : !bestRecipe ? (
              <p className="empty-state">No workable mix from your paints.</p>
            ) : (
              <>
                <div className="mix-pills">
                  {bestRecipe.ingredients.map((ingredient) => (
                    <span className="mix-pill" key={ingredient.paintId}>
                      <span className="parts">{ingredient.parts}</span>
                      {ingredient.paintName}
                    </span>
                  ))}
                </div>
                <div className="mix-compare">
                  <span
                    aria-label={`Target color ${bestRecipe.targetHex}`}
                    className="half"
                    style={{ backgroundColor: bestRecipe.targetHex }}
                  />
                  <span aria-hidden className="arrow">
                    →
                  </span>
                  <span
                    aria-label={`Likely mixed color ${bestRecipe.estimatedHex}`}
                    className="half"
                    style={{ backgroundColor: bestRecipe.estimatedHex }}
                  />
                </div>
                <div className="mix-labels">
                  <span className="micro">Target</span>
                  <span className="micro">Likely mix · ΔE ≈ {Math.round(bestRecipe.deltaE)}</span>
                </div>
                {bestRecipe.notes.length > 0 ? (
                  <p className="quiet-note">{bestRecipe.notes.join(' ')}</p>
                ) : null}
                <span className="micro mix-foot">Approximate · test a swatch first</span>
              </>
            )}
          </article>

          <article className="panel">
            <p className="eyebrow">Project record</p>
            <form className="save-form" onSubmit={handleSave}>
              <input
                aria-label="Palette name"
                onChange={(event) => setPaletteName(event.target.value)}
                placeholder="Palette name"
                value={paletteName}
              />
              <button className="primary-button" disabled={colors.length === 0} type="submit">
                Save palette
              </button>
            </form>
            {saveMessage ? (
              <p className="quiet-note" role="status">
                {saveMessage} <a href="#/palettes">View saved palettes</a>
              </p>
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
