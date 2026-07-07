import { useState } from 'react';
import type { FormEvent } from 'react';
import { ImageColorPicker } from '../components/ImageColorPicker';
import { ImageUploader } from '../components/ImageUploader';
import { ManualColorInput } from '../components/ManualColorInput';
import { WorkingPaletteStrip } from '../components/WorkingPaletteStrip';
import { formatCmyk, formatRgb, getPrintViability, hexToRgb, rgbToCmyk } from '../lib/color';
import type { ColorSource, SampledColor } from '../types/palette';

type Artwork = {
  dataUrl: string;
  name: string;
};

type WorkspacePageProps = {
  artwork: Artwork | null;
  colors: SampledColor[];
  activeColorId: string | null;
  onArtworkSelected: (dataUrl: string, name: string) => void;
  onAutoGenerate: () => Promise<number>;
  onAddColor: (hex: string, source: ColorSource) => void;
  onSelectColor: (id: string) => void;
  onRemoveColor: (id: string) => void;
  onSavePalette: (name: string) => boolean;
};

export function WorkspacePage({
  artwork,
  colors,
  activeColorId,
  onArtworkSelected,
  onAutoGenerate,
  onAddColor,
  onSelectColor,
  onRemoveColor,
  onSavePalette,
}: WorkspacePageProps) {
  const [paletteName, setPaletteName] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  const handleAutoGenerate = async () => {
    setIsAutoGenerating(true);
    const added = await onAutoGenerate();
    setIsAutoGenerating(false);
    setAutoMessage(
      added > 0
        ? `Added ${added} color${added === 1 ? '' : 's'} from your artwork.`
        : 'No new colors found — the dominant colors are already in your palette.',
    );
  };

  const activeColor = colors.find((color) => color.id === activeColorId) ?? null;
  const activeRgb = activeColor ? hexToRgb(activeColor.hex) : null;
  const activeCmyk = activeRgb ? rgbToCmyk(activeRgb) : null;
  const viability = activeRgb ? getPrintViability(activeRgb) : null;

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const saved = onSavePalette(paletteName.trim() || 'Untitled palette');

    if (saved) {
      setSaveMessage('Palette saved.');
      setPaletteName('');
    }
  };

  return (
    <div className="page">
      <div className="workspace-columns">
        <section className="workspace-column" aria-label="Artwork and working palette">
          <article className="panel">
            <p className="eyebrow">Artwork</p>
            {artwork ? (
              <>
                <h2 className="artwork-title">{artwork.name}</h2>
                <p className="field-help">
                  Click or tap an area of the artwork to sample its color.
                </p>
                <ImageColorPicker
                  dataUrl={artwork.dataUrl}
                  onSample={(hex) => onAddColor(hex, 'image')}
                />
              </>
            ) : (
              <>
                <h2>No artwork yet</h2>
                <p className="field-help">
                  Upload an image to sample colors from it, or add colors by hex below.
                </p>
                <ImageUploader onSelect={onArtworkSelected} />
              </>
            )}
          </article>

          <article className="panel">
            <p className="eyebrow">Working palette</p>
            <h2>Sampled colors</h2>
            <WorkingPaletteStrip
              activeColorId={activeColorId}
              colors={colors}
              onRemove={onRemoveColor}
              onSelect={onSelectColor}
            />
            {artwork ? (
              <>
                <button
                  className="secondary-button"
                  disabled={isAutoGenerating}
                  onClick={() => void handleAutoGenerate()}
                  type="button"
                >
                  {isAutoGenerating ? 'Generating…' : 'Auto-generate palette from artwork'}
                </button>
                {autoMessage ? (
                  <p className="field-help" role="status">
                    {autoMessage}
                  </p>
                ) : null}
              </>
            ) : null}
            <details className="manual-add">
              <summary>Add a color by hex</summary>
              <ManualColorInput onSubmit={(hex) => onAddColor(hex, 'manual')} />
            </details>
          </article>
        </section>

        <aside className="workspace-column" aria-label="Color inspector">
          <article className="panel">
            <p className="eyebrow">Selected color</p>
            <h2>Target color details</h2>
            {activeColor && activeRgb ? (
              <>
                <div
                  aria-label={`Selected color ${activeColor.hex}`}
                  className="active-swatch"
                  style={{ backgroundColor: activeColor.hex }}
                />
                <dl className="color-values">
                  <div>
                    <dt>Hex</dt>
                    <dd>{activeColor.hex}</dd>
                  </div>
                  <div>
                    <dt>RGB</dt>
                    <dd>{formatRgb(activeRgb)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="empty-state">
                Sample a color from the artwork (or select one in the working palette) to inspect
                it.
              </p>
            )}
          </article>

          <article className="panel">
            <p className="eyebrow">Approximate conversion</p>
            <h2>RGB/CMYK viability</h2>
            {activeCmyk && viability ? (
              <>
                <dl className="color-values">
                  <div>
                    <dt>Approximate CMYK</dt>
                    <dd>{formatCmyk(activeCmyk)}</dd>
                  </div>
                  <div>
                    <dt>Print/paint outlook</dt>
                    <dd>{viability.status}</dd>
                  </div>
                </dl>
                <p className="viability-note">{viability.explanation}</p>
              </>
            ) : (
              <p className="empty-state">Select a color to see approximate CMYK values.</p>
            )}
          </article>

          <article className="panel">
            <p className="eyebrow">Paint suggestions</p>
            <h2>Liquitex BASICS matches</h2>
            <p className="empty-state">
              Closest paint matches arrive with the paint library (next milestone).
            </p>
            <button
              className="secondary-button"
              onClick={() => setIsInventoryOpen(true)}
              type="button"
            >
              Edit my paints
            </button>
          </article>

          <article className="panel">
            <p className="eyebrow">First attempt</p>
            <h2>Starter mix</h2>
            <p className="empty-state">
              Approximate starter mixes will use your owned paints once the mix engine lands.
            </p>
          </article>

          <article className="panel">
            <p className="eyebrow">Project record</p>
            <h2>Save this palette</h2>
            <form className="save-form" onSubmit={handleSave}>
              <label className="field-label" htmlFor="palette-name">
                Palette name
              </label>
              <input
                id="palette-name"
                onChange={(event) => setPaletteName(event.target.value)}
                placeholder="e.g. Sunset study"
                value={paletteName}
              />
              <button className="primary-button" disabled={colors.length === 0} type="submit">
                Save palette
              </button>
            </form>
            {colors.length === 0 ? (
              <p className="field-help">Add at least one color to save a palette.</p>
            ) : null}
            {saveMessage ? (
              <p className="field-help" role="status">
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
            <p className="empty-state">
              The Liquitex BASICS paint library lands in the next milestone. You will mark the
              paints you own here, and matches and starter mixes will use only those paints.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
