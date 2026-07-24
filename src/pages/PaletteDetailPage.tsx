import { useMemo, useRef, useState } from 'react';
import { MixEditor } from '../components/MixEditor';
import { liquitexBasics } from '../data/liquitexBasics';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { hexToRgb, isLightColor } from '../lib/color';
import { formatPaletteMeta } from '../lib/format';
import { CONFIDENCE_LABEL } from '../lib/paintMatching';
import { aggregatePaintUsage } from '../lib/paintUsage';
import type { PaintUsage } from '../lib/paintUsage';
import { buildPaletteSummary } from '../lib/paletteSummary';
import { suggestMixes } from '../lib/recipeEngine';
import type { MixRecipe } from '../types/paint';
import type { SampledColor, SavedPalette } from '../types/palette';

type PaletteDetailPageProps = {
  palette: SavedPalette | null;
  ownedPaintIds: string[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onEdit: (palette: SavedPalette) => void;
  onSetColorRecipe: (paletteId: string, colorId: string, recipe: MixRecipe | null) => void;
};

type PaletteItem = {
  color: SampledColor;
  recipe: MixRecipe | null;
};

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be unavailable (permissions, insecure context);
    // fall back to the legacy selection approach.
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }
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

export function PaletteDetailPage({
  palette,
  ownedPaintIds,
  onDelete,
  onDuplicate,
  onRename,
  onEdit,
  onSetColorRecipe,
}: PaletteDetailPageProps) {
  const [mixColorId, setMixColorId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const ownedPaints = useMemo(
    () => liquitexBasics.filter((paint) => ownedPaintIds.includes(paint.id)),
    [ownedPaintIds],
  );

  // suggestMixes is expensive (a full combinatorial search per color). The
  // palette object gets a new identity on every recipe edit (parts steppers,
  // alt-mix picks, reset in the MixEditor modal), which would otherwise
  // recompute suggestions for every OTHER color on each click. Cache results
  // keyed on (hex, owned-paint set): edits to one color's preferredRecipe
  // don't change the cache key for the rest, so they hit the cache instead
  // of re-searching. A bounded palette keeps the map small; entries made
  // stale by an owned-paints change are simply never looked up again.
  const suggestionCache = useRef(new Map<string, MixRecipe | null>());

  const items = useMemo<PaletteItem[]>(() => {
    const ownedKey = ownedPaintIds.join(',');

    return (palette?.colors ?? []).map((color) => {
      if (color.preferredRecipe) {
        return { color, recipe: color.preferredRecipe };
      }

      const cacheKey = `${color.hex}|${ownedKey}`;
      const cache = suggestionCache.current;

      if (cache.has(cacheKey)) {
        return { color, recipe: cache.get(cacheKey) ?? null };
      }

      const rgb = hexToRgb(color.hex);
      const recipe =
        rgb && ownedPaints.length > 0 ? suggestMixes(rgb, ownedPaints, 1)[0] ?? null : null;
      cache.set(cacheKey, recipe);
      return { color, recipe };
    });
  }, [palette, ownedPaints, ownedPaintIds]);

  const usage = useMemo(
    () =>
      aggregatePaintUsage(
        items.flatMap((item) => (item.recipe ? [item.recipe] : [])),
        liquitexBasics,
      ),
    [items],
  );

  const activeItem = items.find((item) => item.color.id === mixColorId) ?? null;

  useEscapeKey(Boolean(activeItem), () => setMixColorId(null));

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
            {isRenaming ? (
              <form
                className="rename-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = nameDraft.trim();

                  if (trimmed) {
                    onRename(palette.id, trimmed);
                  }

                  setIsRenaming(false);
                }}
              >
                <input
                  aria-label="Palette name"
                  autoFocus
                  onChange={(event) => setNameDraft(event.target.value)}
                  value={nameDraft}
                />
                <button className="secondary-button" type="submit">
                  Save
                </button>
              </form>
            ) : (
              <h2 className="sheet-title">
                {palette.name}{' '}
                <button
                  className="text-link"
                  onClick={() => {
                    setNameDraft(palette.name);
                    setIsRenaming(true);
                  }}
                  type="button"
                >
                  Rename
                </button>
              </h2>
            )}
            <p className="sheet-meta">{formatPaletteMeta(palette)}</p>
          </div>
          <div className="sheet-actions">
            {copyState !== 'idle' ? (
              <span className="save-confirm" role="status">
                {copyState === 'copied' ? '✓ Copied' : 'Copy failed'}
              </span>
            ) : null}
            <button
              className="secondary-button"
              onClick={() => {
                void (async () => {
                  const copied = await copyTextToClipboard(
                    buildPaletteSummary(palette, items, usage),
                  );
                  setCopyState(copied ? 'copied' : 'failed');
                  window.setTimeout(() => setCopyState('idle'), 2500);
                })();
              }}
              type="button"
            >
              Copy summary
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                window.location.hash = `#/palettes/${encodeURIComponent(palette.id)}/sheet`;
              }}
              type="button"
            >
              Mix sheet
            </button>
            <button className="secondary-button" onClick={() => onEdit(palette)} type="button">
              Edit in workspace
            </button>
            <button
              className="secondary-button"
              onClick={() => onDuplicate(palette.id)}
              type="button"
            >
              Duplicate
            </button>
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
                  <span className="bname">
                    {color.hex}
                    {color.label ? <span className="bname-label">{color.label}</span> : null}
                  </span>
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
                        <span className="mix-row-hex">
                          {color.label ? `${color.label} · ${color.hex}` : color.hex}
                        </span>
                        <span className="mix-row-recipe">
                          {recipe
                            ? recipe.ingredients
                                .map((ingredient) => `${ingredient.parts} ${ingredient.paintName}`)
                                .join(' · ') + (color.preferredRecipe ? ' · your mix' : '')
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
                  {activeItem.color.notes ? (
                    <p className="quiet-note">{activeItem.color.notes}</p>
                  ) : null}
                </div>
              </div>
              <button
                autoFocus
                className="secondary-button"
                onClick={() => setMixColorId(null)}
                type="button"
              >
                Close
              </button>
            </header>

            {ownedPaints.length > 0 ? (
              <MixEditor
                footnote="Approximate starter mix · test a swatch first"
                onPreferredChange={(recipe) =>
                  onSetColorRecipe(palette.id, activeItem.color.id, recipe)
                }
                ownedPaints={ownedPaints}
                preferred={activeItem.color.preferredRecipe ?? null}
                showSteps
                targetHex={activeItem.color.hex}
              />
            ) : (
              <p className="empty-state">
                Mark the paints you own in the <a href="#/workspace">workspace</a> to get a mix for
                this color.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
