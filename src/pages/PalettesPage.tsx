import { hexToRgb, isLightColor, rgbToCmyk } from '../lib/color';
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
  if (palettes.length === 0) {
    return (
      <div className="page">
        <p className="empty-state page-empty">
          No saved palettes yet. Build one in the <a href="#/workspace">workspace</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="sheets">
        {palettes.map((palette) => (
          <section className="panel" key={palette.id}>
            <div className="sheet-head">
              <div>
                <h2 className="sheet-title">{palette.name}</h2>
                <p className="sheet-meta">
                  {new Date(palette.createdAt).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  · {palette.colors.length} color{palette.colors.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="sheet-actions">
                <button
                  className="secondary-button"
                  onClick={() => exportPaletteAsJson(palette)}
                  type="button"
                >
                  Export
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

            <ul className="color-blocks">
              {palette.colors.map((color) => {
                const rgb = hexToRgb(color.hex);
                const cmyk = rgb ? rgbToCmyk(rgb) : null;
                const light = rgb ? isLightColor(rgb) : true;

                return (
                  <li
                    className={light ? 'block on-light' : 'block on-dark'}
                    key={color.id}
                    style={{ backgroundColor: color.hex }}
                  >
                    <div className="specs">
                      {rgb ? (
                        <div className="spec">
                          <span className="k">RGB</span>
                          <span className="v">{`${rgb.r} · ${rgb.g} · ${rgb.b}`}</span>
                        </div>
                      ) : null}
                      {cmyk ? (
                        <div className="spec">
                          <span className="k">CMYK</span>
                          <span className="v">{`${cmyk.c} · ${cmyk.m} · ${cmyk.y} · ${cmyk.k}`}</span>
                        </div>
                      ) : null}
                    </div>
                    <span className="bname">{color.hex}</span>
                  </li>
                );
              })}
            </ul>

            <p className="quiet-note">Paint usage chart arrives with the mix engine.</p>
          </section>
        ))}
      </div>
    </div>
  );
}
