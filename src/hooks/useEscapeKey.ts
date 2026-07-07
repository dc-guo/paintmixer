import { useEffect } from 'react';

/** Calls onClose when Escape is pressed while `active` is true. */
export function useEscapeKey(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onClose]);
}
