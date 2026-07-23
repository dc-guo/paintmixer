import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { hexToRgb, isLightColor } from '../lib/color';
import type { SampledColor } from '../types/palette';

type WorkingPaletteStripProps = {
  colors: SampledColor[];
  activeColorId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: number) => void;
};

export function WorkingPaletteStrip({
  colors,
  activeColorId,
  onSelect,
  onRemove,
  onMove,
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

        const isFirst = index === 0;
        const isLast = index === colors.length - 1;
        // The strip is a single tab stop (roving tabindex). The per-swatch
        // controls join the tab order only for the swatch that IS the stop,
        // so Tab doesn't wade through 3 controls on every colour.
        const controlTabIndex = index === tabStopIndex ? 0 : -1;

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
            {/* Reorder + remove stay hidden until the swatch is hovered or
                focused, so the strip reads as colours first, controls second. */}
            <div className="swatch-reorder">
              <button
                aria-disabled={isFirst}
                aria-label={`Move ${color.hex} earlier`}
                className="swatch-move"
                onClick={() => {
                  if (!isFirst) {
                    onMove(color.id, -1);
                  }
                }}
                tabIndex={controlTabIndex}
                type="button"
              >
                ‹
              </button>
              <button
                aria-disabled={isLast}
                aria-label={`Move ${color.hex} later`}
                className="swatch-move"
                onClick={() => {
                  if (!isLast) {
                    onMove(color.id, 1);
                  }
                }}
                tabIndex={controlTabIndex}
                type="button"
              >
                ›
              </button>
            </div>
            <button
              aria-label={`Remove ${color.hex}`}
              className="swatch-remove"
              onClick={() => onRemove(color.id)}
              tabIndex={controlTabIndex}
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
