import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type ImageUploaderProps = {
  onSelect: (dataUrl: string, name: string) => void;
};

export function ImageUploader({ onSelect }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a PNG, JPG, or WebP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setError(null);
        onSelect(reader.result, file.name);
      }
    };
    reader.onerror = () => setError('That file could not be read. Try another image.');
    reader.readAsDataURL(file);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    readFile(event.dataTransfer.files[0]);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    readFile(event.target.files?.[0]);
    event.target.value = '';
  };

  return (
    <div>
      <button
        className={isDragging ? 'dropzone dragging' : 'dropzone'}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={handleDrop}
        type="button"
      >
        <strong>Drop artwork here</strong>
        <span>or click to browse — PNG, JPG, or WebP</span>
      </button>
      <input
        accept={ACCEPTED_TYPES.join(',')}
        hidden
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      {error ? <p className="field-help error">{error}</p> : null}
    </div>
  );
}
