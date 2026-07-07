import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { normalizeHex } from '../lib/color';

type ManualColorInputProps = {
  onSubmit: (hex: string) => void;
  submitLabel?: string;
};

export function ManualColorInput({ onSubmit, submitLabel = 'Add color' }: ManualColorInputProps) {
  const inputId = useId();
  const [value, setValue] = useState('#386D5F');
  const [showError, setShowError] = useState(false);
  const normalized = normalizeHex(value);
  const hasError = !normalized && showError;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!normalized) {
      setShowError(true);
      return;
    }

    setShowError(false);
    onSubmit(normalized);
  };

  return (
    <form className="manual-color-form" onSubmit={handleSubmit}>
      <label className="field-label" htmlFor={inputId}>
        Hex color
      </label>
      <div className="hex-input-row">
        <input
          aria-describedby={hasError ? `${inputId}-help` : undefined}
          id={inputId}
          onChange={(event) => {
            setValue(event.target.value);
            setShowError(false);
          }}
          placeholder="#386D5F"
          spellCheck="false"
          value={value}
        />
        <div
          aria-label={normalized ? `Color preview ${normalized}` : 'Invalid color preview'}
          className="color-swatch"
          style={{ backgroundColor: normalized ?? '#F4F4F2' }}
        />
      </div>
      {hasError ? (
        <p className="field-help error" id={`${inputId}-help`}>
          Enter a 3- or 6-digit hex color, like #386D5F.
        </p>
      ) : null}
      <button className="primary-button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
