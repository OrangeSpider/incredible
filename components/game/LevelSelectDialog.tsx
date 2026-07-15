import type { LevelDefinition } from "@/engine/types";

type LevelSelectDialogProps = {
  levels: LevelDefinition[];
  current: LevelDefinition;
  customLevelId?: string;
  onSelect: (level: LevelDefinition) => void;
  onClose: () => void;
};

export default function LevelSelectDialog({ levels, current, customLevelId, onSelect, onClose }: LevelSelectDialogProps) {
  return (
    <div className="modal" onClick={onClose}>
      <section className="level-dialog" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <p className="eyebrow">ENTWICKLER-DIREKTZUGRIFF</p>
        <h2>Level wählen</h2>
        <div className="level-grid">
          {levels.map((level) => (
            <button key={`${level.id}-${level === current ? "current" : "catalog"}`} className={level === current ? "current" : ""} onClick={() => onSelect(level)}>
              <b>{String(level.number).padStart(2, "0")}</b>
              <span>{level.title}{level.id === customLevelId ? " · Entwurf" : ""}</span>
              <small>{level.objective}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
