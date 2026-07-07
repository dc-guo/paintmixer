import type { MixRecipe } from '../types/paint';

type MixComparisonProps = {
  recipe: MixRecipe;
};

/** Target vs likely-mix swatch strip with the recipe's adjustment notes. */
export function MixComparison({ recipe }: MixComparisonProps) {
  return (
    <>
      <div className="mix-compare">
        <span
          aria-label={`Target color ${recipe.targetHex}`}
          className="half"
          style={{ backgroundColor: recipe.targetHex }}
        />
        <span aria-hidden className="arrow">
          →
        </span>
        <span
          aria-label={`Likely mixed color ${recipe.estimatedHex}`}
          className="half"
          style={{ backgroundColor: recipe.estimatedHex }}
        />
      </div>
      <div className="mix-labels">
        <span className="micro">Target</span>
        <span className="micro">Likely mix</span>
      </div>
      {recipe.notes.length > 0 ? <p className="quiet-note">{recipe.notes.join(' ')}</p> : null}
    </>
  );
}
