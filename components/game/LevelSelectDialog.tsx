import type { LevelDefinition } from "@/engine/types";
import { useRef, useState } from "react";
import { pickLevelDirectory, readLevelDirectory, readLevelFiles, supportsLevelFolders } from "@/levels/file-storage";

type LevelSelectDialogProps = {
  levels: LevelDefinition[];
  current: LevelDefinition;
  customLevelId?: string;
  onSelect: (level: LevelDefinition) => void;
  onClose: () => void;
  folderName?: string | null;
  onLoadFolder?: (levels: LevelDefinition[], folder: string) => void;
  onBuiltinLevels?: () => void;
};

export default function LevelSelectDialog({ levels, current, customLevelId, onSelect, onClose, folderName, onLoadFolder, onBuiltinLevels }: LevelSelectDialogProps) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const openFolder = async () => {
    if (!supportsLevelFolders()) { input.current?.click(); return; }
    setBusy(true);
    try {
      const directory = await pickLevelDirectory("read");
      const imported = await readLevelDirectory(directory);
      onLoadFolder?.(imported.map(file => file.level), directory.name);
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "Ordner konnte nicht geladen werden."); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <section className="level-dialog" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <p className="eyebrow">{folderName ? `LEVELORDNER · ${folderName}` : "LEVELSAMMLUNG"}</p>
        <h2>Level wählen</h2>
        {onLoadFolder && <div className="editor-actions"><button disabled={busy} onClick={() => void openFolder()}>{busy ? "Lädt…" : "Ordner zum Spielen auswählen"}</button>{folderName && <button onClick={onBuiltinLevels}>Mitgelieferte Levels</button>}</div>}
        {onLoadFolder && <p className="editor-help folder-help">Ein Level pro JSON-Datei. Die Reihenfolge richtet sich nach der Levelnummer, danach nach dem Dateinamen. Nach einem Erfolg geht es mit „Nächstes Level“ weiter.</p>}
        <p className="editor-message" role="status">{message}</p>
        <div className="level-grid">
          {levels.map((level) => (
            <button key={`${level.id}-${level === current ? "current" : "catalog"}`} className={level === current ? "current" : ""} onClick={() => onSelect(level)}>
              <b>{String(level.number).padStart(2, "0")}</b>
              <span>{level.title}{level.id === customLevelId ? " · Entwurf" : ""}</span>
              <small>{level.objective}</small>
            </button>
          ))}
        </div>
        <input ref={input} type="file" {...{ webkitdirectory: "", directory: "" }} multiple hidden onChange={event => {
          const files = Array.from(event.target.files ?? []), folder = files[0]?.webkitRelativePath.split("/")[0] ?? "Levelordner";
          event.target.value = ""; setBusy(true);
          void readLevelFiles(files).then(imported => onLoadFolder?.(imported.map(file => file.level), folder)).catch(error => setMessage(error instanceof Error ? error.message : "Ordner konnte nicht geladen werden.")).finally(() => setBusy(false));
        }} />
      </section>
    </div>
  );
}
