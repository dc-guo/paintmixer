import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
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
  const listRef = useRef<HTMLUListElement | null>(null);

  if (colors.length === 0) {
    return <p className="empty-state">Re-generate from the artwork or add a color by hex.</p>;
  }

  const activeIndex = colors.findIndex((color) => color.id === activeColorId);
  // Roving tabindex: the active swatch is the tab stop; when nothing is
  // active (e.g. previewing), the first swatch takes its place.
  const tabStopIndex = activeIndex === -1 ? 0 : activeIndex;

  const focusSwatchAt = (index: number) => {
    const target = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-color-id="${colors[index].id}"]`,
    );
    target?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = Math.max(0, index - 1);
        break;
      case 'ArrowRight':
        nextIndex = Math.min(colors.length - 1, index + 1);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = colors.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();

    if (nextIndex !== index) {
      onSelect(colors[nextIndex].id);
    }

    focusSwatchAt(nextIndex);
  };

  return (
    <ul aria-label="Working palette" className="swatch-grid" ref={listRef} role="listbox">
      {colors.map((color, index) => {
        const rgb = hexToRgb(color.hex);
        const light = rgb ? isLightColor(rgb) : true;
        const isActive = color.id === activeColorId;

        return (
          <li key={color.id}>
            <button
              aria-selected={isActive}
              className={isActive ? 'swatch active' : 'swatch'}
              data-color-id={color.id}
              onClick={() => onSelect(color.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              role="option"
              style={{ backgroundColor: color.hex }}
              tabIndex={index === tabStopIndex ? 0 : -1}
              type="button"
            >
              <span className={light ? 'on-light' : 'on-dark'}>
                <span className="swatch-hex">{color.hex}</span>
                {color.label ? <span className="swatch-label">{color.label}</span> : null}
              </span>
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
