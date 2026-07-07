import { useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { rgbToHex } from '../lib/color';

export type MarkerInfo = {
  id: string;
  hex: string;
  x: number;
  y: number;
  active: boolean;
};

type Sample = {
  hex: string;
  position: { x: number; y: number };
};

type ImageColorPickerProps = {
  dataUrl: string;
  markers: MarkerInfo[];
  preview: { x: number; y: number } | null;
  onPreview: (hex: string, position: { x: number; y: number }) => void;
  onMarkerSelect: (id: string) => void;
  onMarkerDrag: (id: string, hex: string, position: { x: number; y: number }) => void;
};

function clampFraction(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function ImageColorPicker({
  dataUrl,
  markers,
  preview,
  onPreview,
  onMarkerSelect,
  onMarkerDrag,
}: ImageColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !context) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
    };
    image.src = dataUrl;
  }, [dataUrl]);

  const sampleAtFraction = (fx: number, fy: number): Sample | null => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !context || canvas.width === 0 || canvas.height === 0) {
      return null;
    }

    const x = Math.min(canvas.width - 1, Math.floor(fx * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor(fy * canvas.height));
    const [r = 0, g = 0, b = 0] = context.getImageData(x, y, 1, 1).data;

    return { hex: rgbToHex({ r, g, b }), position: { x: fx, y: fy } };
  };

  const sampleAtPoint = (clientX: number, clientY: number): Sample | null => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    return sampleAtFraction(
      clampFraction((clientX - rect.left) / rect.width),
      clampFraction((clientY - rect.top) / rect.height),
    );
  };

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const sample = sampleAtPoint(event.clientX, event.clientY);

    if (sample) {
      onPreview(sample.hex, sample.position);
    }
  };

  const handleMarkerPointerDown = (id: string) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    draggingIdRef.current = id;
    onMarkerSelect(id);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail for synthetic events; dragging still works
      // while the pointer stays over the marker.
    }
  };

  const handleMarkerPointerMove = (id: string) => (event: PointerEvent<HTMLButtonElement>) => {
    if (draggingIdRef.current !== id) {
      return;
    }

    const sample = sampleAtPoint(event.clientX, event.clientY);

    if (sample) {
      onMarkerDrag(id, sample.hex, sample.position);
    }
  };

  const handleMarkerPointerEnd = (id: string) => (event: PointerEvent<HTMLButtonElement>) => {
    if (draggingIdRef.current !== id) {
      return;
    }

    draggingIdRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore: capture may never have been acquired.
    }
  };

  const handleMarkerKeyDown = (marker: MarkerInfo) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];

    if (!delta) {
      return;
    }

    event.preventDefault();
    const sample = sampleAtFraction(
      clampFraction(marker.x + delta[0]),
      clampFraction(marker.y + delta[1]),
    );

    if (sample) {
      onMarkerDrag(marker.id, sample.hex, sample.position);
    }
  };

  return (
    <div className="artwork-frame">
      <canvas
        aria-label="Uploaded artwork. Click or tap to preview a color; drag a marker to change a palette color."
        className="artwork-canvas"
        onClick={handleCanvasClick}
        ref={canvasRef}
        role="img"
      />
      {markers.map((marker) => (
        <button
          aria-label={`Color marker ${marker.hex}. Drag, or use arrow keys to re-sample from the artwork.`}
          className={marker.active ? 'marker draggable active' : 'marker draggable'}
          key={marker.id}
          onFocus={() => onMarkerSelect(marker.id)}
          onKeyDown={handleMarkerKeyDown(marker)}
          onPointerCancel={handleMarkerPointerEnd(marker.id)}
          onPointerDown={handleMarkerPointerDown(marker.id)}
          onPointerMove={handleMarkerPointerMove(marker.id)}
          onPointerUp={handleMarkerPointerEnd(marker.id)}
          style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
          type="button"
        />
      ))}
      {preview ? (
        <span
          aria-hidden
          className="marker preview"
          style={{ left: `${preview.x * 100}%`, top: `${preview.y * 100}%` }}
        />
      ) : null}
    </div>
  );
}
