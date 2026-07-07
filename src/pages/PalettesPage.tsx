import type { SavedPalette } from '../types/palette';

type PalettesPageProps = {
  palettes: SavedPalette[];
  onDelete: (id: string) => void;
};

function exportPaletteAsJson(palette: SavedPalette) {
  const blob = new Blob([JSON.stringify(palette, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${palette.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'palette'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PalettesPage({ palettes, onDelete }: PalettesPageProps) {
  return (
    <div className="page">
      <section className="panel usage-panel" aria-label="Paint usage overview">
        <p className="eyebrow">Mixing overview</p>
        <h2>Paint usage chart</h2>
        <p className="empty-state">
          Once starter mixes exist, this chart will show approximately how much of each Liquitex
          BASICS paint you need to mix everything in a palette, plus ideal final output previews.
        </p>
      </section>

      <section aria-label="Saved palettes">
        {palettes.length > 0 ? (
          <ul className="saved-palette-list">
            {palettes.map((palette) => (
              <li className="panel saved-palette-card" key={palette.id}>
                <div className="saved-palette-head">
                  <div>
                    <h2>{palette.name}</h2>
                    <p className="field-help">
                      Saved {new Date(palette.createdAt).toLocaleDateString()} ·{' '}
                      {palette.colors.length} color{palette.colors.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="saved-palette-actions">
                    <button
                      className="secondary-button"
                      onClick={() => exportPaletteAsJson(palette)}
                      type="button"
                    >
                      Export JSON
                    </button>
                    <button
                      className="secondary-button danger"
                      onClick={() => onDelete(palette.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <ul className="saved-swatch-row">
                  {palette.colors.map((color) => (
                    <li key={color.id}>
                      <span
                        aria-hidden
                        className="mini-swatch large"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="palette-chip-hex">{color.hex}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel">
            <p className="empty-state">
              No saved palettes yet. Build one in the <a href="#/workspace">workspace</a> and save
              it to see it here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
