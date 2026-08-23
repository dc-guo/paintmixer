import { useMemo, useState } from 'react';
import { liquitexBasics } from '../data/liquitexBasics';
import type { PaintSet } from '../lib/paintSets';
import { PaintSetPicker } from './PaintSetPicker';

type PaintSetDrawerProps = {
  sets: PaintSet[];
  setId: string;
  onSelectSet: (id: string) => void;
  onTogglePaint: (setId: string, paintId: string) => void;
  onRename: (setId: string, name: string) => void;
  onDuplicate: (setId: string) => void;
  onDelete: (setId: string) => void;
  onClose: () => void;
};

/** The paints drawer, set-aware: pick/rename/duplicate/delete a set up top,
 * tick its paints below. Used from the workspace and the Paint sets tab. */
export function PaintSetDrawer({
  sets,
  setId,
  onSelectSet,
  onTogglePaint,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: PaintSetDrawerProps) {
  const [paintQuery, setPaintQuery] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const set = sets.find((candidate) => candidate.id === setId) ?? sets[0];

  const filteredPaints = useMemo(() => {
    const query = paintQuery.trim().toLowerCase();
    return query
      ? liquitexBasics.filter((paint) => paint.name.toLowerCase().includes(query))
      : liquitexBasics;
  }, [paintQuery]);

  if (!set) {
    return null;
  }

  const commitRename = () => {
    onRename(set.id, nameDraft);
    setIsRenaming(false);
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        aria-label="Paint set"
        className="drawer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="drawer-head">
          {isRenaming ? (
            <form
              className="rename-form"
              onSubmit={(event) => {
                event.preventDefault();
                commitRename();
              }}
            >
              <input
                aria-label="Set name"
                autoFocus
                onBlur={commitRename}
                onChange={(event) => setNameDraft(event.target.value)}
                value={nameDraft}
              />
            </form>
          ) : (
            <h2>{set.name}</h2>
          )}
          <button className="secondary-button" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="drawer-set-row">
          <PaintSetPicker onSelect={onSelectSet} sets={sets} value={set.id} />
          <div className="drawer-set-actions">
            <button
              className="text-link"
              onClick={() => {
                setNameDraft(set.name);
                setIsRenaming(true);
              }}
              type="button"
            >
              Rename
            </button>
            <button className="text-link" onClick={() => onDuplicate(set.id)} type="button">
              Duplicate
            </button>
            <button className="text-link" onClick={() => onDelete(set.id)} type="button">
              Delete
            </button>
          </div>
        </div>
        <input
          aria-label="Search paints"
          className="drawer-search"
          onChange={(event) => setPaintQuery(event.target.value)}
          placeholder="Search paints"
          value={paintQuery}
        />
        <p className="micro">
          {set.paintIds.length} of {liquitexBasics.length} in this set · approximate colors
        </p>
        {filteredPaints.length > 0 ? (
          <ul className="paint-list">
            {filteredPaints.map((paint) => (
              <li key={paint.id}>
                <label className="paint-row">
                  <span aria-hidden className="mini-swatch" style={{ backgroundColor: paint.hex }} />
                  <span className="paint-name">{paint.name}</span>
                  <input
                    checked={set.paintIds.includes(paint.id)}
                    onChange={() => onTogglePaint(set.id, paint.id)}
                    type="checkbox"
                  />
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No paints match "{paintQuery}".</p>
        )}
      </aside>
    </div>
  );
}
