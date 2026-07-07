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
    return (
      <p className="empty-state">
        Click the artwork (or add a hex color) to start building a palette.
      </p>
    );
  }

  return (
    <ul className="palette-strip">
      {colors.map((color) => (
        <li
          className={color.id === activeColorId ? 'palette-chip active' : 'palette-chip'}
          key={color.id}
        >
          <button
            aria-pressed={color.id === activeColorId}
            className="palette-chip-body"
            onClick={() => onSelect(color.id)}
            type="button"
          >
            <span aria-hidden className="mini-swatch" style={{ backgroundColor: color.hex }} />
            <span className="palette-chip-hex">{color.hex}</span>
          </button>
          <button
            aria-label={`Remove ${color.hex} from working palette`}
            className="palette-chip-remove"
            onClick={() => onRemove(color.id)}
            type="button"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
