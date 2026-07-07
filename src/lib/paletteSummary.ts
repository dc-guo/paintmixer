import type { MixRecipe } from '../types/paint';
import type { SampledColor, SavedPalette } from '../types/palette';
import type { PaintUsage } from './paintUsage.js';

export type SummaryItem = {
  color: SampledColor;
  recipe: MixRecipe | null;
};

function describeMix(recipe: MixRecipe): string {
  const sorted = [...recipe.ingredients].sort((a, b) => b.parts - a.parts);

  const mix =
    sorted.length === 1
      ? `${sorted[0].paintName} straight from the tube`
      : sorted
          .map(
            (ingredient) =>
              `${ingredient.parts} part${ingredient.parts === 1 ? '' : 's'} ${ingredient.paintName}`,
          )
          .join(' + ');

  // "Straight from the tube." is already covered by the phrasing above.
  const notes = recipe.notes.filter((note) => note !== 'Straight from the tube.');
  return notes.length > 0 ? `${mix}. ${notes.join(' ')}` : `${mix}.`;
}

/**
 * Plain-English, copy-ready summary of a saved palette: one line per color
 * with its starter mix, plus a shopping-style list of paints and relative
 * amounts (plan §9E.6). No hex-free jargon — no deltaE, no CMYK.
 */
export function buildPaletteSummary(
  palette: SavedPalette,
  items: SummaryItem[],
  usage: PaintUsage[],
): string {
  const lines: string[] = [];

  lines.push(`${palette.name} — PaintBridge palette`);

  const date = new Date(palette.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const source = palette.artwork ? ` · from ${palette.artwork.name}` : '';
  lines.push(`${date} · ${items.length} color${items.length === 1 ? '' : 's'}${source}`);

  lines.push('');
  lines.push('Colors & starter mixes');

  items.forEach(({ color, recipe }, index) => {
    lines.push(
      recipe ? `${index + 1}. ${color.hex} — ${describeMix(recipe)}` : `${index + 1}. ${color.hex}`,
    );
  });

  lines.push('');

  if (usage.length > 0) {
    lines.push('Paints to have on hand');
    usage.forEach((entry, index) => {
      lines.push(
        `- ${entry.paintName} — about ${entry.percentage}%${
          index === 0 ? ' of the total mix volume' : ''
        }`,
      );
    });
    lines.push('');
  } else if (!items.some((item) => item.recipe)) {
    lines.push('Mark the paints you own in PaintBridge to get starter mixes.');
    lines.push('');
  }

  lines.push('Approximations, not formulas. Test a swatch first.');
  return lines.join('\n');
}
