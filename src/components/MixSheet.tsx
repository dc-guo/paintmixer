import { hexToRgb, isLightColor } from '../lib/color';
import { aggregateMixUsage, formatMixLine } from '../lib/mixSheetModel';
import type { MixSheetModel } from '../lib/mixSheetModel';

/**
 * The poster: title, artwork (or a color bar) beside the paint-ratio list, one
 * card per color with name/hex/mix, approximation footer. Pure render — both
 * the owner's sheet view and the shared read-only view feed it a model.
 */
export function MixSheet({ model }: { model: MixSheetModel }) {
  const usage = aggregateMixUsage(model.colors);

  return (
    <article aria-label={`Mix sheet for ${model.name}`} className="mixsheet">
      <header className="mixsheet-head">
        <p className="eyebrow">Color palette</p>
        <h1 className="mixsheet-title">{model.name}</h1>
      </header>

      <div className={model.artworkDataUrl ? 'mixsheet-hero' : 'mixsheet-hero no-art'}>
        {model.artworkDataUrl ? (
          <img alt="" className="mixsheet-art" src={model.artworkDataUrl} />
        ) : (
          <div aria-hidden className="mixsheet-colorbar">
            {model.colors.map((color, index) => (
              <div className="mixsheet-colorband" key={index} style={{ backgroundColor: color.hex }} />
            ))}
          </div>
        )}
        <div className="mixsheet-ratios">
          <p className="eyebrow">Paints to have on hand</p>
          {usage.length > 0 ? (
            <ul className="ratio-list">
              {usage.map((share, index) => (
                <li className="ratio-row" key={index}>
                  <span className="ratio-name">{share.paintName}</span>
                  <span className="ratio-pct">{share.percentage}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ratio-empty">Mark the paints you own to see mix ratios.</p>
          )}
        </div>
      </div>

      <ul className="mixsheet-cards">
        {model.colors.map((color, index) => {
          const rgb = hexToRgb(color.hex);
          const light = rgb ? isLightColor(rgb) : true;
          const line = formatMixLine(color.mix);
          return (
            <li
              className={light ? 'mixsheet-card on-light' : 'mixsheet-card on-dark'}
              key={index}
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
