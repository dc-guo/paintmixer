import { useEffect, useMemo, useState } from 'react';
import { liquitexBasics } from '../data/liquitexBasics';
import { hexToRgb, isLightColor } from '../lib/color';
import { aggregatePaintUsage } from '../lib/paintUsage';
import type { PaintUsage } from '../lib/paintUsage';
import { suggestMixes } from '../lib/recipeEngine';
import type { MixRecipe } from '../types/paint';
import type { SampledColor, SavedPalette } from '../types/palette';

type PaletteDetailPageProps = {
  palette: SavedPalette | null;
  ownedPaintIds: string[];
  onDelete: (id: string) => void;
};

type PaletteItem = {
  color: SampledColor;
  recipe: MixRecipe | null;
};

const CONFIDENCE_LABEL = { high: 'close', medium: 'fair', low: 'far' } as const;

function mixSteps(recipe: MixRecipe): string[] {
  const sorted = [...recipe.ingredients].sort((a, b) => b.parts - a.parts);

  if (sorted.length === 1) {
    return [`Use ${sorted[0].paintName} straight from the tube.`];
  }

  return sorted.map((ingredient, index) => {
    const parts = `${ingredient.parts} part${ingredient.parts === 1 ? '' : 's'}`;
    return index === 0
      ? `Start with ${parts} ${ingredient.paintName}.`
      : `Work in ${parts} ${ingredient.paintName}, a little at a time.`;
  });
}

function exportPaletteAsJson(palette: SavedPalette, items: PaletteItem[], usage: PaintUsage[]) {
  const payload = {
    ...palette,
    recipes: items
      .filter((item) => item.recipe)
      .map((item) => ({ colorHex: item.color.hex, ...item.recipe })),
    paintUsage: usage,
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

export function PaletteDetailPage({ palette, ownedPaintIds, onDelete }: PaletteDetailPageProps) {
  const [mixColorId, setMixColorId] = useState<string | null>(null);

  const ownedPaints = useMemo(
    () => liquitexBasics.filter((paint) => ownedPaintIds.includes(paint.id)),
    [ownedPaintIds],
  );

  const items = useMemo<PaletteItem[]>(
    () =>
      (palette?.colors ?? []).map((color) => {
        const rgb = hexToRgb(color.hex);
        const recipe =
          rgb && ownedPaints.length > 0 ? suggestMixes(rgb, ownedPaints, 1)[0] ?? null : null;
        return { color, recipe };
      }),
    [palette, ownedPaints],
  );

  const usage = useMemo(
    () =>
      aggregatePaintUsage(
        items.flatMap((item) => (item.recipe ? [item.recipe] : [])),
        liquitexBasics,
      ),
    [items],
  );

  const activeItem = items.find((item) => item.color.id === mixColorId) ?? null;

  useEffect(() => {
    if (!activeItem) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMixColorId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem]);

  if (!palette) {
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
      <a className="back-link" href="#/palettes">
        ← Saved palettes
      </a>

      <section className="panel">
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
              onClick={() => exportPaletteAsJson(palette, items, usage)}
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

        {palette.artwork ? (
          <img
            alt={`Source artwork: ${palette.artwork.name}`}
            className="detail-artwork"
            src={palette.artwork.thumbnailDataUrl}
          />
        ) : null}

        <ul className="color-blocks">
          {items.map(({ color }) => {
            const rgb = hexToRgb(color.hex);
            const light = rgb ? isLightColor(rgb) : true;

            return (
              <li key={color.id}>
                <button
                  className={light ? 'block on-light' : 'block on-dark'}
                  onClick={() => setMixColorId(color.id)}
                  style={{ backgroundColor: color.hex }}
                  type="button"
                >
                  <span className="specs">
                    {rgb ? (
                      <span className="spec">
                        <span className="k">RGB</span>
                        <span className="v">{`${rgb.r} · ${rgb.g} · ${rgb.b}`}</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="bname">{color.hex}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="palette-lower">
          <div>
            <p className="eyebrow">Colors & mixes</p>
            {ownedPaints.length === 0 ? (
              <p className="empty-state">
                Mark the paints you own in the <a href="#/workspace">workspace</a> to get mixes.
              </p>
            ) : (
              <ul className="mix-rows">
                {items.map(({ color, recipe }) => (
                  <li key={color.id}>
                    <button className="mix-row" onClick={() => setMixColorId(color.id)} type="button">
                      <span
                        aria-hidden
                        className="mini-swatch large"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="mix-row-main">
                        <span className="mix-row-hex">{color.hex}</span>
                        <span className="mix-row-recipe">
                          {recipe
                            ? recipe.ingredients
                                .map((ingredient) => `${ingredient.parts} ${ingredient.paintName}`)
                                .join(' · ')
                            : 'no workable mix'}
                        </span>
                      </span>
                      {recipe ? (
                        <span className={`match-tag ${CONFIDENCE_LABEL[recipe.confidence]}`}>
                          {CONFIDENCE_LABEL[recipe.confidence]}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="eyebrow">Paint usage ≈</p>
            {usage.length > 0 ? (
              <div className="usage-card">
                <UsageDonut usage={usage} />
                <div className="legend">
                  {usage.map((entry) => (
                    <div className="legend-row" key={entry.paintId}>
                      <span aria-hidden className="sw" style={{ backgroundColor: entry.hex }} />
                      {entry.paintName}
                      <span className="pct">{entry.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="empty-state">No mixes available yet.</p>
            )}
          </div>
        </div>

        <span className="micro mix-foot">Relative planning estimate · not physical volumes</span>
      </section>

      {activeItem ? (
        <div className="modal-backdrop" onClick={() => setMixColorId(null)}>
          <div
            aria-label={`How to mix ${activeItem.color.hex}`}
            className="modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="modal-head">
              <div className="target-head">
                <div
                  aria-hidden
                  className="target-chip"
                  style={{ backgroundColor: activeItem.color.hex }}
                />
                <div>
                  <h2 className="target-name">{activeItem.color.hex}</h2>
                </div>
              </div>
              <button
                className="secondary-button"
                onClick={() => setMixColorId(null)}
                type="button"
              >
                Close
              </button>
            </header>

            {activeItem.recipe ? (
              <>
                <ol className="mix-steps">
                  {mixSteps(activeItem.recipe).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className="mix-compare">
                  <span
                    aria-label={`Target color ${activeItem.recipe.targetHex}`}
                    className="half"
                    style={{ backgroundColor: activeItem.recipe.targetHex }}
                  />
                  <span aria-hidden className="arrow">
                    →
                  </span>
                  <span
                    aria-label={`Likely mixed color ${activeItem.recipe.estimatedHex}`}
                    className="half"
                    style={{ backgroundColor: activeItem.recipe.estimatedHex }}
                  />
                </div>
                <div className="mix-labels">
                  <span className="micro">Target</span>
                  <span className="micro">Likely mix</span>
                </div>
                {activeItem.recipe.notes.length > 0 ? (
                  <p className="quiet-note">{activeItem.recipe.notes.join(' ')}</p>
                ) : null}
                <span className="micro mix-foot">Approximate starter mix · test a swatch first</span>
              </>
            ) : (
              <p className="empty-state">
                No workable mix from your current paints. Mark more owned paints in the{' '}
                <a href="#/workspace">workspace</a>.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
