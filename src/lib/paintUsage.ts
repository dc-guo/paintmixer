import type { MixRecipe, Paint } from '../types/paint';

export type PaintUsage = {
  paintId: string;
  paintName: string;
  hex: string;
  percentage: number;
};

/**
 * Aggregate how much of each base paint a set of recipes needs, as relative
 * percentages. Each recipe is normalized first so every palette color
 * contributes equally regardless of its ratio total. This is a planning
 * estimate, not a physical volume calculation (plan §9E).
 */
export function aggregatePaintUsage(recipes: MixRecipe[], paints: Paint[]): PaintUsage[] {
  const shares = new Map<string, number>();

  for (const recipe of recipes) {
    const total = recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.parts, 0);

    if (total === 0) {
      continue;
    }

    for (const ingredient of recipe.ingredients) {
      shares.set(
        ingredient.paintId,
        (shares.get(ingredient.paintId) ?? 0) + ingredient.parts / total,
      );
    }
  }

  const grandTotal = [...shares.values()].reduce((sum, share) => sum + share, 0);

  if (grandTotal === 0) {
    return [];
  }

  const paintById = new Map(paints.map((paint) => [paint.id, paint]));

  return [...shares.entries()]
    .map(([paintId, share]) => ({
      paintId,
      paintName: paintById.get(paintId)?.name ?? paintId,
      hex: paintById.get(paintId)?.hex ?? '#000000',
      percentage: Math.round((share / grandTotal) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}
