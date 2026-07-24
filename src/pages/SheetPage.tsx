import { useMemo } from 'react';
import { MixSheet } from '../components/MixSheet';
import { liquitexBasics } from '../data/liquitexBasics';
import { hexToRgb } from '../lib/color';
import { buildSheetModel } from '../lib/mixSheetModel';
import { suggestMixes } from '../lib/recipeEngine';
import type { SavedPalette } from '../types/palette';

type SheetPageProps = {
  palette: SavedPalette | null;
  ownedPaintIds: string[];
};

/**
 * The owner's mix-sheet view: resolves recipes the same way the detail page
 * does (preferred recipe wins, else one live suggestion from owned paints),
 * then hands a self-contained model to the poster.
 */
export function SheetPage({ palette, ownedPaintIds }: SheetPageProps) {
  const ownedPaints = useMemo(
    () => liquitexBasics.filter((paint) => ownedPaintIds.includes(paint.id)),
    [ownedPaintIds],
  );

  const model = useMemo(() => {
    if (!palette) {
      return null;
    }

    const items = palette.colors.map((color) => {
      if (color.preferredRecipe) {
        return { color, recipe: color.preferredRecipe };
      }

      const rgb = hexToRgb(color.hex);
      const recipe =
        rgb && ownedPaints.length > 0 ? suggestMixes(rgb, ownedPaints, 1)[0] ?? null : null;
      return { color, recipe };
    });

    return buildSheetModel(palette, items);
  }, [palette, ownedPaints]);

  if (!palette || !model) {
    return (
      <div className="page">
        <a className="back-link" href="#/palettes">
          ← Saved palettes
        </a>
        <p className="empty-state page-empty">This palette no longer exists.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="mixsheet-toolbar">
        <a className="back-link" href={`#/palettes/${encodeURIComponent(palette.id)}`}>
          ← {palette.name}
        </a>
        <div className="actions">
          <button className="secondary-button" onClick={() => window.print()} type="button">
            Save as PDF
          </button>
        </div>
      </div>
      <MixSheet model={model} />
    </div>
  );
}
