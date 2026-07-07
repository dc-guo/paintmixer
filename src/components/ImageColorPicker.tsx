import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { rgbToHex } from '../lib/color';

type ImageColorPickerProps = {
  dataUrl: string;
  onSample: (hex: string) => void;
};

export function ImageColorPicker({ dataUrl, onSample }: ImageColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !context || canvas.width === 0 || canvas.height === 0) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = Math.min(
      canvas.width - 1,
      Math.max(0, Math.round((event.clientX - rect.left) * (canvas.width / rect.width))),
    );
    const y = Math.min(
      canvas.height - 1,
      Math.max(0, Math.round((event.clientY - rect.top) * (canvas.height / rect.height))),
    );
    const [r = 0, g = 0, b = 0] = context.getImageData(x, y, 1, 1).data;

    onSample(rgbToHex({ r, g, b }));
  };

  return (
    <canvas
      aria-label="Uploaded artwork. Click or tap an area to sample its color. Keyboard users can add colors by hex instead."
      className="artwork-canvas"
      onClick={handleClick}
      ref={canvasRef}
      role="img"
    />
  );
}
