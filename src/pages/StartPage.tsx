import { ImageUploader } from '../components/ImageUploader';
import { ManualColorInput } from '../components/ManualColorInput';
import type { SavedPalette } from '../types/palette';

type StartPageProps = {
  savedPalettes: SavedPalette[];
  onArtworkSelected: (dataUrl: string, name: string) => void;
  onManualColor: (hex: string) => void;
};

export function StartPage({ savedPalettes, onArtworkSelected, onManualColor }: StartPageProps) {
  const recentPalettes = savedPalettes.slice(0, 4);

  return (
    <div className="page">
      <section className="start-hero" aria-labelledby="page-title">
        <p className="eyebrow">Digital color · Acrylic paint</p>
        <h1 id="page-title">
          From screen to <em>mixable</em> paint.
        </h1>
        <p className="sub">
          Match your artwork's colors to Liquitex BASICS and mix from paints you own.
        </p>

        <div className="upload-wrap">
          <ImageUploader onSelect={onArtworkSelected} />
        </div>

        <details className="start-alt">
          <summary>Or start from a hex color</summary>
          <div className="start-manual">
            <ManualColorInput onSubmit={onManualColor} submitLabel="Open workspace" />
          </div>
        </details>

        <p className="disclaimer-line">Approximations, not formulas. Test a swatch first.</p>
      </section>

      {recentPalettes.length > 0 ? (
        <section className="recent" aria-label="Recent palettes">
          <p className="micro">Recent palettes</p>
          <ul className="recent-list">
            {recentPalettes.map((palette) => (
              <li key={palette.id}>
                <a href={`#/palettes/${palette.id}`}>
                  <span aria-hidden className="recent-swatches">
                    {palette.colors.slice(0, 5).map((color) => (
                      <span
                        className="mini-swatch"
                        key={color.id}
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </span>
                  {palette.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
