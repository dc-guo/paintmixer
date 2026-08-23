import { useState } from 'react';
import { liquitexBasics } from '../data/liquitexBasics';
import { formatPaletteMeta } from '../lib/format';
import { PaintSetDrawer } from '../components/PaintSetDrawer';
import type { PaintSet } from '../lib/paintSets';
import type { SavedPalette } from '../types/palette';

const paintHexById = new Map(liquitexBasics.map((paint) => [paint.id, paint.hex]));

type PalettesPageProps = {
  palettes: SavedPalette[];
  paintSets: PaintSet[];
  tab: 'palettes' | 'sets';
  onCreateSet: () => void;
  onRenameSet: (setId: string, name: string) => void;
  onDuplicateSet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onTogglePaintInSet: (setId: string, paintId: string) => void;
};

export function PalettesPage({
  palettes,
  paintSets,
  tab,
  onCreateSet,
  onRenameSet,
  onDuplicateSet,
  onDeleteSet,
  onTogglePaintInSet,
}: PalettesPageProps) {
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const editingSet = editingSetId
    ? paintSets.find((set) => set.id === editingSetId) ?? null
    : null;

  return (
    <div className="page">
      <nav aria-label="Saved palettes sections" className="page-tabs">
        <a aria-current={tab === 'palettes' ? 'page' : undefined} href="#/palettes">
          Palettes
        </a>
        <a aria-current={tab === 'sets' ? 'page' : undefined} href="#/palettes/sets">
          Paint sets
        </a>
      </nav>

      {tab === 'palettes' ? (
        palettes.length === 0 ? (
          <p className="empty-state page-empty">
            No saved palettes yet. Build one in the <a href="#/workspace">workspace</a>.
          </p>
        ) : (
          <ul className="palette-gallery">
            {palettes.map((palette) => (
              <li key={palette.id}>
                <a className="gallery-card" href={`#/palettes/${palette.id}`}>
                  {palette.artwork ? (
                    <img alt="" className="gallery-thumb" src={palette.artwork.thumbnailDataUrl} />
                  ) : null}
                  <span aria-hidden className="gallery-strip">
                    {palette.colors.map((color) => (
                      <span key={color.id} style={{ backgroundColor: color.hex }} />
                    ))}
                  </span>
                  <span className="gallery-head">
                    <span className="gallery-name">{palette.name}</span>
                    <span className="gallery-meta">{formatPaletteMeta(palette)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="set-cards">
          {paintSets.map((set) => (
            <li className="set-card" key={set.id}>
              <div className="set-card-head">
                <span className="set-card-name">{set.name}</span>
                <span className="micro">
                  {set.paintIds.length} paint{set.paintIds.length === 1 ? '' : 's'}
                  {set.isPreset ? ' · preset' : ''}
                </span>
              </div>
              <div aria-hidden className="set-card-strip">
                {set.paintIds.slice(0, 6).map((paintId) => (
                  <span key={paintId} style={{ backgroundColor: paintHexById.get(paintId) ?? '#EEE' }} />
                ))}
                {set.paintIds.length === 0 ? <span className="empty" /> : null}
              </div>
              <div className="set-card-actions">
                <button className="text-link" onClick={() => setEditingSetId(set.id)} type="button">
                  Edit
                </button>
                <button className="text-link" onClick={() => onDuplicateSet(set.id)} type="button">
                  Duplicate
                </button>
                <button
                  className="text-link danger"
                  onClick={() => {
                    if (editingSetId === set.id) {
                      setEditingSetId(null);
                    }
                    onDeleteSet(set.id);
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          <li>
            <button className="set-new-card" onClick={onCreateSet} type="button">
              ＋ New paint set
            </button>
          </li>
        </ul>
      )}

      {editingSet ? (
        <PaintSetDrawer
          onClose={() => setEditingSetId(null)}
          onDelete={(setId) => {
            setEditingSetId(null);
            onDeleteSet(setId);
          }}
          onDuplicate={onDuplicateSet}
          onRename={onRenameSet}
          onSelectSet={setEditingSetId}
          onTogglePaint={onTogglePaintInSet}
          setId={editingSet.id}
          sets={paintSets}
        />
      ) : null}
    </div>
  );
}
