import { hexToRgb, isLightColor } from '../lib/color';
import { formatMixLine } from '../lib/mixSheetModel';
import type { MixSheetModel } from '../lib/mixSheetModel';

/**
 * The poster: title, artwork (or color strip) + vertical hex strip, one card
 * per color with name/hex/mix, approximation footer. Pure render — both the
 * owner's sheet view and the shared read-only view feed it a model.
 */
export function MixSheet({ model }: { model: MixSheetModel }) {
  return (
    <article aria-label={`Mix sheet for ${model.name}`} className="mixsheet">
      <header className="mixsheet-head">
        <p className="eyebrow">Color palette</p>
        <h1 className="mixsheet-title">{model.name}</h1>
      </header>

      <div className={model.artworkDataUrl ? 'mixsheet-hero' : 'mixsheet-hero no-art'}>
        {model.artworkDataUrl ? (
          <img alt="" className="mixsheet-art" src={model.artworkDataUrl} />
        ) : null}
        <div aria-hidden className="mixsheet-strip">
          {model.colors.map((color) => {
            const rgb = hexToRgb(color.hex);
            const light = rgb ? isLightColor(rgb) : true;
            return (
              <div
                className="mixsheet-band"
                key={color.hex + (color.label ?? '')}
                style={{ backgroundColor: color.hex }}
              >
                <span className={light ? 'on-light' : 'on-dark'}>{color.hex}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mixsheet-cards">
        {model.colors.map((color) => {
          const rgb = hexToRgb(color.hex);
          const light = rgb ? isLightColor(rgb) : true;
          const line = formatMixLine(color.mix);
          return (
            <li
              className={light ? 'mixsheet-card on-light' : 'mixsheet-card on-dark'}
              key={color.hex + (color.label ?? '')}
              style={{ backgroundColor: color.hex }}
            >
              <p className="card-name">{color.label ?? color.hex}</p>
              {color.label ? <p className="card-hex">{color.hex}</p> : null}
              {color.notes ? <p className="card-notes">{color.notes}</p> : null}
              <p className="card-mix">{line || 'No mix from owned paints yet.'}</p>
            </li>
          );
        })}
      </ul>

      <p className="mixsheet-foot">Approximations, not formulas. Test a swatch first.</p>
    </article>
  );
}
