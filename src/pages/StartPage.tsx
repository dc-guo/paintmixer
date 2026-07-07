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
      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">PaintBridge</p>
          <h1 id="page-title">Turn your digital colors into paint you can actually mix.</h1>
          <p className="hero-copy">
            Upload artwork, sample the colors that matter, and get approximate Liquitex BASICS
            matches and starter mixes from the paints you already own. Everything runs locally in
            your browser.
          </p>
        </div>
        <aside className="disclaimer" aria-label="Approximation disclaimer">
          <strong>Approximation note</strong>
          <p>
            PaintBridge does not provide exact paint formulas or guaranteed color matches. RGB,
            CMYK, paint matching, and starter mixes are planning approximations — test a small
            swatch first.
          </p>
        </aside>
      </section>

      <section className="start-actions" aria-label="Start a project">
        <article className="panel">
          <p className="eyebrow">Start here</p>
          <h2>Upload your artwork</h2>
          <p>The image stays in your browser — nothing is uploaded to a server.</p>
          <ImageUploader onSelect={onArtworkSelected} />
        </article>
        <article className="panel">
          <p className="eyebrow">No image handy?</p>
          <h2>Start from a hex color</h2>
          <p>Add a color directly and jump straight into the workspace.</p>
          <ManualColorInput onSubmit={onManualColor} submitLabel="Open in workspace" />
        </article>
      </section>

      <section className="panel recent-panel" aria-label="Recent palettes">
        <p className="eyebrow">Pick up where you left off</p>
        <h2>Recent palettes</h2>
        {recentPalettes.length > 0 ? (
          <ul className="recent-list">
            {recentPalettes.map((palette) => (
              <li key={palette.id}>
                <a href="#/palettes">
                  <span aria-hidden className="recent-swatches">
                    {palette.colors.slice(0, 6).map((color) => (
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
        ) : (
          <p className="empty-state">
            Palettes you save from the workspace will appear here for quick access.
          </p>
        )}
      </section>
    </div>
  );
}
