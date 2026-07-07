import { useDeferredValue, useMemo } from 'react';
import { liquitexBasics } from '../data/liquitexBasics';
import { hexToRgb } from '../lib/color';
import { CONFIDENCE_LABEL } from '../lib/paintMatching';
import { mixSteps } from '../lib/paletteSummary';
import { buildRecipe, suggestMixes } from '../lib/recipeEngine';
import type { MixRecipe, Paint } from '../types/paint';
import { MixComparison } from './MixComparison';

type MixEditorProps = {
  targetHex: string;
  ownedPaints: Paint[];
  /** The stored user choice; null means "follow the live suggestion". */
  preferred: MixRecipe | null;
  onPreferredChange: (recipe: MixRecipe | null) => void;
  footnote: string;
  showSteps?: boolean;
};

const paintById = new Map(liquitexBasics.map((paint) => [paint.id, paint]));

function recipeKey(recipe: MixRecipe) {
  return recipe.ingredients
    .map((ingredient) => `${ingredient.paintId}:${ingredient.parts}`)
    .sort()
    .join('|');
}

export function MixEditor({
  targetHex,
  ownedPaints,
  preferred,
  onPreferredChange,
  footnote,
  showSteps = false,
}: MixEditorProps) {
  // The suggestion search is expensive; defer it so marker drags stay smooth.
  const deferredHex = useDeferredValue(targetHex);

  const suggestions = useMemo(() => {
    const rgb = hexToRgb(deferredHex);
    return rgb && ownedPaints.length > 0 ? suggestMixes(rgb, ownedPaints, 3) : [];
  }, [deferredHex, ownedPaints]);

  const current = preferred ?? suggestions[0] ?? null;

  if (!current) {
    return <p className="empty-state">No workable mix from your paints.</p>;
  }

  const currentKey = recipeKey(current);

  const adjustParts = (paintId: string, delta: number) => {
    const rgb = hexToRgb(targetHex);

    if (!rgb) {
      return;
    }

    const ingredients = current.ingredients.flatMap((ingredient) => {
      const paint = paintById.get(ingredient.paintId);
      return paint
        ? [
            {
              paint,
              parts:
                ingredient.paintId === paintId
                  ? Math.min(12, Math.max(1, ingredient.parts + delta))
                  : ingredient.parts,
            },
          ]
        : [];
    });

    // A paint missing from the library (shouldn't happen) — leave untouched.
    if (ingredients.length !== current.ingredients.length) {
      return;
    }

    onPreferredChange(buildRecipe(rgb, ingredients));
  };

  return (
    <div className="mix-editor">
      {suggestions.length > 1 ? (
        <ul className="alt-mixes">
          {suggestions.map((suggestion, index) => {
            const key = recipeKey(suggestion);
            return (
              <li key={key}>
                <button
                  aria-pressed={key === currentKey}
                  className={key === currentKey ? 'alt-mix selected' : 'alt-mix'}
                  onClick={() => onPreferredChange(index === 0 ? null : suggestion)}
                  type="button"
                >
                  <span className="alt-mix-names">
                    {suggestion.ingredients
                      .map((ingredient) => ingredient.paintName)
                      .join(' + ')}
                  </span>
                  <span className={`match-tag ${CONFIDENCE_LABEL[suggestion.confidence]}`}>
                    {CONFIDENCE_LABEL[suggestion.confidence]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mix-pills">
        {current.ingredients.map((ingredient) => (
          <span className="mix-pill" key={ingredient.paintId}>
            <button
              aria-label={`One part less ${ingredient.paintName}`}
              className="parts-step"
              onClick={() => adjustParts(ingredient.paintId, -1)}
              type="button"
            >
              −
            </button>
            <span className="parts">{ingredient.parts}</span>
            <button
              aria-label={`One part more ${ingredient.paintName}`}
              className="parts-step"
              onClick={() => adjustParts(ingredient.paintId, 1)}
              type="button"
            >
              +
            </button>
            {ingredient.paintName}
          </span>
        ))}
      </div>

      {preferred ? (
        <p className="quiet-note" role="status">
          Your mix ·{' '}
          <button className="text-link" onClick={() => onPreferredChange(null)} type="button">
            Reset to suggested
          </button>
        </p>
      ) : null}

      {showSteps ? (
        <ol className="mix-steps">
          {mixSteps(current).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      <MixComparison recipe={current} />
      <span className="micro mix-foot">{footnote}</span>
    </div>
  );
}
