import type { PaintSet } from '../lib/paintSets';

const NEW_SENTINEL = '__new__';
const MANAGE_SENTINEL = '__manage__';

type PaintSetPickerProps = {
  sets: PaintSet[];
  value: string;
  onSelect: (id: string) => void;
  onCreateNew?: () => void;
  onManage?: () => void;
};

/** Per-image paint-set dropdown: pick a set, spin up a new one, or jump to
 * the management tab. A native select keeps it keyboard/touch-correct. */
export function PaintSetPicker({ sets, value, onSelect, onCreateNew, onManage }: PaintSetPickerProps) {
  const hasActions = Boolean(onCreateNew) || Boolean(onManage);

  return (
    <select
      aria-label="Paint set"
      className="set-picker"
      onChange={(event) => {
        const next = event.target.value;

        if (next === NEW_SENTINEL) {
          onCreateNew?.();
        } else if (next === MANAGE_SENTINEL) {
          onManage?.();
        } else {
          onSelect(next);
        }

        // Sentinel choices must not stick as the select's value.
        event.target.value = value;
      }}
      value={value}
    >
      {sets.map((set) => (
        <option key={set.id} value={set.id}>
          {set.name}
        </option>
      ))}
      {hasActions ? <option disabled>──</option> : null}
      {onCreateNew ? <option value={NEW_SENTINEL}>＋ New set</option> : null}
      {onManage ? <option value={MANAGE_SENTINEL}>Manage sets…</option> : null}
    </select>
  );
}
