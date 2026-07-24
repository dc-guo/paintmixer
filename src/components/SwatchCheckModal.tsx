import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { hexToRgb, rgbToHex } from '../lib/color';
import { averagePatch, correctForPaper, nudgeLine, swatchVerdict } from '../lib/swatchCheck';
import type { PaperResult } from '../lib/swatchCheck';
import type { MixRecipe } from '../types/paint';
import type { RGB } from '../types/color';
import { useEscapeKey } from '../hooks/useEscapeKey';

type Phase = 'swatch' | 'paper' | 'result';
type Point = { x: number; y: number };

type SwatchCheckModalProps = {
  targetHex: string;
  recipe: MixRecipe | null;
  onClose: () => void;
};

const PROMPT: Record<Phase, string> = {
  swatch: 'Tap your painted swatch.',
  paper: 'Tap a clean bit of the paper.',
  result: '',
};

export function SwatchCheckModal({ targetHex, recipe, onClose }: SwatchCheckModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('swatch');
  const [swatchPoint, setSwatchPoint] = useState<Point | null>(null);
  const [paperPoint, setPaperPoint] = useState<Point | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEscapeKey(true, onClose);

  const targetRgb = hexToRgb(targetHex);

  const loadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(typeof reader.result === 'string' ? reader.result : null);
      setPhase('swatch');
      setSwatchPoint(null);
      setPaperPoint(null);
    };
    reader.readAsDataURL(file);
  };

  const drawImage = (url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const image = new Image();
    image.onload = () => {
      const maxW = 460;
      const scale = Math.min(1, maxW / image.naturalWidth);
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = url;
  };

  useEffect(() => {
    if (imageUrl) {
      drawImage(imageUrl);
    }
    // drawImage reads canvasRef.current, which is attached before effects run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const sampleAt = (point: Point): RGB | null => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return null;
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return averagePatch(data, canvas.width, canvas.height, Math.round(point.x), Math.round(point.y), 5);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || phase === 'result') {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
    if (phase === 'swatch') {
      setSwatchPoint(point);
      setPhase('paper');
    } else if (phase === 'paper') {
      setPaperPoint(point);
      setPhase('result');
    }
  };

  // Result is derived on render from the two sample points.
  let paper: PaperResult | null = null;
  let verdict: 'close' | 'fair' | 'far' | null = null;
  let correctedHex: string | null = null;
  let nudge: string | null = null;

  if (phase === 'result' && swatchPoint && paperPoint && targetRgb) {
    const swatchRgb = sampleAt(swatchPoint);
    const paperRgb = sampleAt(paperPoint);
    if (swatchRgb && paperRgb) {
      paper = correctForPaper(swatchRgb, paperRgb);
      if (paper.ok) {
        verdict = swatchVerdict(paper.corrected, targetRgb);
        correctedHex = rgbToHex(paper.corrected);
        nudge = nudgeLine(paper.corrected, targetRgb, recipe);
      }
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        aria-label="Check a painted swatch"
        className="swatch-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="swatch-modal-head">
          <p className="eyebrow">Check a painted swatch</p>
          <button className="secondary-button" onClick={onClose} type="button">
            Close
          </button>
        </header>

        {!imageUrl ? (
          <label className="swatch-pick">
            <span>Take or choose a photo of your painted swatch on white paper.</span>
            <input accept="image/*" capture="environment" onChange={loadFile} type="file" />
          </label>
        ) : (
          <>
            {phase !== 'result' ? <p className="swatch-prompt">{PROMPT[phase]}</p> : null}
            <div className="swatch-canvas-wrap">
              <canvas
                className="swatch-canvas"
                onClick={handleCanvasClick}
                ref={canvasRef}
              />
            </div>

            {phase === 'result' ? (
              <div className="swatch-result">
                {!targetRgb ? (
                  <p className="empty-state">Select a color first.</p>
                ) : paper && !paper.ok ? (
                  <p className="quiet-note">
                    That doesn't look like white paper — <button className="text-link" onClick={() => setPhase('paper')} type="button">tap a cleaner spot</button>.
                  </p>
                ) : verdict && correctedHex ? (
                  <>
                    <div className="mix-compare">
                      <span aria-label={`Target color ${targetHex}`} className="half" style={{ backgroundColor: targetHex }} />
                      <span aria-hidden className="arrow">→</span>
                      <span aria-label="Your swatch, corrected" className="half" style={{ backgroundColor: correctedHex }} />
                    </div>
                    <div className="mix-labels">
                      <span className="micro">Target</span>
                      <span className="micro">Your swatch</span>
                    </div>
                    <p className={`swatch-verdict ${verdict}`}>{verdict}</p>
                    {nudge ? <p className="quiet-note">{nudge}</p> : null}
                  </>
                ) : null}

                <div className="swatch-adjust">
                  <button className="text-link" onClick={() => setPhase('swatch')} type="button">Adjust swatch</button>
                  <button className="text-link" onClick={() => setPhase('paper')} type="button">Adjust paper</button>
                  <button className="text-link" onClick={() => setImageUrl(null)} type="button">Check another</button>
                </div>
              </div>
            ) : null}

            <p className="swatch-foot micro">Approximate — lighting still matters. The photo stays on your device.</p>
          </>
        )}
      </aside>
    </div>
  );
}
