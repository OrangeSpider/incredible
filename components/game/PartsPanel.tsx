import { GADGET_CATALOG } from "@/engine/gadget-catalog";
import type { InventoryEntry, PlaceableGadgetType } from "@/engine/types";

type PartsPanelProps = {
  inventory: InventoryEntry[];
  selected: PlaceableGadgetType | null;
  running: boolean;
  tip: string;
  remaining: (entry: InventoryEntry) => number;
  onSelect: (type: PlaceableGadgetType) => void;
};

export default function PartsPanel({ inventory, selected, running, tip, remaining, onSelect }: PartsPanelProps) {
  return (
    <aside aria-label="Bauteile">
      <h2>BAUTEILE</h2>
      {inventory.map((entry) => {
        const gadget = GADGET_CATALOG[entry.type];
        const count = remaining(entry);
        return (
          <button
            key={entry.type}
            className={selected === entry.type ? "selected" : ""}
            onClick={() => onSelect(entry.type)}
            disabled={running || (count === 0 && !(entry.type === "rope" && selected === "rope"))}
            title={gadget.description}
          >
            <span className={`part ${entry.type}`}>{gadget.icon}</span>
            <label>{gadget.displayName}</label>
            <b>{count}</b>
          </button>
        );
      })}
      <div className="tip"><b>💡 TIPP</b><p>{tip}</p></div>
    </aside>
  );
}
