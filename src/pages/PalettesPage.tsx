import { useMemo } from 'react';
import { liquitexBasics } from '../data/liquitexBasics';
import { hexToRgb, isLightColor, rgbToCmyk } from '../lib/color';
import { aggregatePaintUsage } from '../lib/paintUsage';
import type { PaintUsage } from '../lib/paintUsage';
import { suggestMixes } from '../lib/recipeEngine';
import type { MixRecipe } from '../types/paint';
import type { SampledColor, SavedPalette } from '../types/palette';

type PalettesPageProps = {
  palettes: SavedPalette[];
  ownedPaintIds: string[];
  onDelete: (id: string) => void;
};

type PaletteAnalysis = {
  items: Array<{ color: SampledColor; recipe: MixRecipe | null }>;
  usage: PaintUsage[];
};

function exportPaletteAsJson(palette: SavedPalette, analysis: PaletteAnalysis | undefined) {
  const payload = {
    ...palette,
    recipes: analysis?.items
      .filter((item) => item.recipe)
      .map((item) => ({ colorHex: item.color.hex, ...item.recipe })),
    paintUsage: analysis?.usage,
    note: 'All matches, mixes, and usage figures are planning approximations.',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${palette.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'palette'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function UsageDonut({ usage }: { usage: PaintUsage[] }) {
  const segments: Array<PaintUsage & { offset: number }> = [];
  let cumulative = 0;

  for (const entry of usage) {
    segments.push({ ...entry, offset: 25 - cumulative });
    cumulative += entry.percentage;
  }

  return (
    <svg aria-label="Approximate paint usage" height="120" role="img" viewBox="0 0 42 42" width="120">
      <circle cx="21" cy="21" fill="none" r="15.9" stroke="#F1F0EE" strokeWidth="7" />
      {segments.map((segment) => (
        <circle
          cx="21"
          cy="21"
          fill="none"
          key={segment.paintId}
          r="15.9"
          stroke={segment.hex}
          strokeDasharray={`${segment.percentage} ${100 - segment.percentage}`}
          strokeDashoffset={segment.offset}
          strokeWidth="7"
        />
      ))}
    </svg>
  );
}

export function PalettesPage({ palettes, ownedPaintIds, onDelete }: PalettesPageProps) {
  const ownedPaints = useMemo(
    () => liquitexBasics.filter((paint) => ownedPaintIds.includes(paint.id)),
    [ownedPaintIds],
  );

  const analyses = useMemo(() => {
    const result = new Map<string, PaletteAnalysis>();

    for (const palette of palettes) {
      const items = palette.colors.map((color) => {
        const rgb = hexToRgb(color.hex);
        const recipe =
          rgb && ownedPaints.length > 0 ? suggestMixes(rgb, ownedPaints, 1)[0] ?? null : null;
        return { color, recipe };
      });
      const usage = aggregatePaintUsage(
        items.flatMap((item) => (item.recipe ? [item.recipe] : [])),
        liquitexBasics,
      );
      result.set(palette.id, { items, usage });
    }

    return result;
  }, [palettes, ownedPaints]);

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
        {palettes.map((palette) => {
          const analysis = analyses.get(palette.id);

          return (
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
                    onClick={() => exportPaletteAsJson(palette, analysis)}
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

              {ownedPaints.length === 0 ? (
                <p className="quiet-note">
                  Mark the paints you own in the <a href="#/workspace">workspace</a> to see starter
                  mixes and paint usage here.
                </p>
              ) : (
                <div className="palette-lower">
                  <div>
                    <p className="eyebrow">Target → likely mix</p>
                    <div className="outputs">
                      {analysis?.items.map(({ color, recipe }) =>
                        recipe ? (
                          <div key={color.id}>
                            <div className="output-pair">
                              <span
                                aria-label={`Target ${color.hex}`}
                                className="half"
                                style={{ backgroundColor: color.hex }}
                              />
                              <span aria-hidden className="arrow">
                                →
                              </span>
                              <span
                                aria-label={`Likely mix ${recipe.estimatedHex}`}
                                className="half"
                                style={{ backgroundColor: recipe.estimatedHex }}
                              />
                            </div>
                            <div className="output-labels">
                              <span className="micro">{color.hex}</span>
                              <span className="micro">
                                {recipe.ingredients
                                  .map((ingredient) => `${ingredient.parts} ${ingredient.paintName}`)
                                  .join(' · ')}
                              </span>
                            </div>
                          </div>
                        ) : null,
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow">Paint usage ≈</p>
                    {analysis && analysis.usage.length > 0 ? (
                      <div className="usage-card">
                        <UsageDonut usage={analysis.usage} />
                        <div className="legend">
                          {analysis.usage.map((entry) => (
                            <div className="legend-row" key={entry.paintId}>
                              <span
                                aria-hidden
                                className="sw"
                                style={{ backgroundColor: entry.hex }}
                              />
                              {entry.paintName}
                              <span className="pct">{entry.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="empty-state">No mixes available for this palette.</p>
                    )}
                  </div>
                </div>
              )}

              <span className="micro mix-foot">
                Relative planning estimate · not physical volumes
              </span>
            </section>
          );
        })}
      </div>
    </div>
  );
}
