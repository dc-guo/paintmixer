import { hexToRgb, isLightColor } from '../lib/color';
import type { SampledColor } from '../types/palette';

type WorkingPaletteStripProps = {
  colors: SampledColor[];
  activeColorId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

export function WorkingPaletteStrip({
  colors,
  activeColorId,
  onSelect,
  onRemove,
}: WorkingPaletteStripProps) {
  if (colors.length === 0) {
    return <p className="empty-state">Re-generate from the artwork or add a color by hex.</p>;
  }

  return (
    <ul className="swatch-grid">
      {colors.map((color) => {
        const rgb = hexToRgb(color.hex);
        const light = rgb ? isLightColor(rgb) : true;

        return (
          <li key={color.id}>
            <button
              aria-pressed={color.id === activeColorId}
              className={color.id === activeColorId ? 'swatch active' : 'swatch'}
              onClick={() => onSelect(color.id)}
              style={{ backgroundColor: color.hex }}
              type="button"
            >
              <span className={light ? 'on-light' : 'on-dark'}>{color.hex}</span>
            </button>
            <button
              aria-label={`Remove ${color.hex}`}
              className="swatch-remove"
              onClick={() => onRemove(color.id)}
              type="button"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
