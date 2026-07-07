import type { SavedPalette } from '../types/palette';

type PalettesPageProps = {
  palettes: SavedPalette[];
};

export function PalettesPage({ palettes }: PalettesPageProps) {
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
      <ul className="palette-gallery">
        {palettes.map((palette) => (
          <li key={palette.id}>
            <a className="gallery-card" href={`#/palettes/${palette.id}`}>
              {palette.artwork ? (
                <img alt="" className="gallery-thumb" src={palette.artwork.thumbnailDataUrl} />
              ) : null}
              <span aria-hidden className="gallery-strip">
                {palette.colors.map((color) => (
                  <span key={color.id} style={{ backgroundColor: color.hex }} />
                ))}
              </span>
              <span className="gallery-head">
                <span className="gallery-name">{palette.name}</span>
                <span className="gallery-meta">
                  {new Date(palette.createdAt).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  · {palette.colors.length} color{palette.colors.length === 1 ? '' : 's'}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
