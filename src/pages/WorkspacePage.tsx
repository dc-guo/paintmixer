import { useState } from 'react';
import type { FormEvent } from 'react';
import { ImageColorPicker } from '../components/ImageColorPicker';
import { ImageUploader } from '../components/ImageUploader';
import { ManualColorInput } from '../components/ManualColorInput';
import { WorkingPaletteStrip } from '../components/WorkingPaletteStrip';
import { getPrintViability, hexToRgb, rgbToCmyk } from '../lib/color';
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

  const activeColor = colors.find((color) => color.id === activeColorId) ?? null;
  const activeRgb = activeColor ? hexToRgb(activeColor.hex) : null;
  const activeCmyk = activeRgb ? rgbToCmyk(activeRgb) : null;
  const viability = activeRgb ? getPrintViability(activeRgb) : null;

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
              onSample={(hex) => onAddColor(hex, 'image')}
            />
          ) : (
            <div className="panel">
              <p className="eyebrow">Artwork</p>
              <ImageUploader onSelect={onArtworkSelected} />
            </div>
          )}

          <div>
            <WorkingPaletteStrip
              activeColorId={activeColorId}
              colors={colors}
              onRemove={onRemoveColor}
              onSelect={onSelectColor}
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
            {activeColor && activeRgb && activeCmyk && viability ? (
              <>
                <div className="target-head">
                  <div
                    aria-label={`Selected color ${activeColor.hex}`}
                    className="target-chip"
                    style={{ backgroundColor: activeColor.hex }}
                  />
                  <div>
                    <h2 className="target-name">{activeColor.hex}</h2>
                    <p className="target-from">
                      {activeColor.source === 'manual' ? 'entered by hex' : 'from artwork'}
                    </p>
                  </div>
                </div>
                <dl className="color-values">
                  <div>
                    <dt>RGB</dt>
                    <dd>{`${activeRgb.r} · ${activeRgb.g} · ${activeRgb.b}`}</dd>
                  </div>
                  <div>
                    <dt>CMYK ≈</dt>
                    <dd>{`${activeCmyk.c} · ${activeCmyk.m} · ${activeCmyk.y} · ${activeCmyk.k}`}</dd>
                  </div>
                </dl>
                <span className="outlook">{viability.status}</span>
              </>
            ) : (
              <p className="empty-state">Sample the artwork or add a hex color.</p>
            )}
          </article>

          <article className="panel">
            <p className="eyebrow">Closest Liquitex BASICS</p>
            <p className="empty-state">Matches arrive with the paint library.</p>
            <button
              className="secondary-button"
              onClick={() => setIsInventoryOpen(true)}
              type="button"
            >
              Edit my paints
            </button>
          </article>

          <article className="panel">
            <p className="eyebrow">Starter mix</p>
            <p className="empty-state">Mixes will use your owned paints once the engine lands.</p>
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
            <p className="empty-state">
              The Liquitex BASICS library lands next. You will mark owned paints here; matches and
              mixes will use only those.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
