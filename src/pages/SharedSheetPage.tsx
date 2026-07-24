import { useMemo } from 'react';
import { MixSheet } from '../components/MixSheet';
import { decodeSheet } from '../lib/mixSheetCodec';

/**
 * Read-only view behind a share link. The palette lives entirely in the URL
 * hash — nothing is fetched and nothing is saved. A payload that fails strict
 * decoding gets a friendly dead end, mirroring routeFromHash's fail-safe.
 */
export function SharedSheetPage({ encoded }: { encoded: string }) {
  const model = useMemo(() => decodeSheet(encoded), [encoded]);

  if (!model) {
    return (
      <div className="page">
        <p className="empty-state page-empty">
          This link couldn't be read — it may have been cut short in sending.{' '}
          <a href="#/">Open PaintBridge</a>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <MixSheet model={model} />
    </div>
  );
}
