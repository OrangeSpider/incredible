import { useRef, useState } from "react";
import { validateLevel } from "@/levels/catalog";
import type { GadgetInstanceConfig, LevelDefinition } from "@/engine/types";
import type { PlacedGadget } from "./types";

const LOCAL_DRAFT_KEY = "machine-level-editor-draft";

function editableLevel(level: LevelDefinition, placed: PlacedGadget[]) {
  const initialPlacements: GadgetInstanceConfig[] = placed.map((gadget) => ({
    id: `placed-${gadget.id}`,
    type: gadget.type,
    x: Math.round(gadget.x * 10) / 10,
    y: Math.round(gadget.y * 10) / 10,
    rotation: Math.round(gadget.rotation * 10000) / 10000,
  }));
  return { ...level, initialPlacements };
}

type LevelEditorProps = {
  level: LevelDefinition;
  placed: PlacedGadget[];
  onApply: (level: LevelDefinition) => void;
  onClose: () => void;
};

export default function LevelEditor({ level, placed, onApply, onClose }: LevelEditorProps) {
  const [json, setJson] = useState(() => JSON.stringify(editableLevel(level, placed), null, 2));
  const [message, setMessage] = useState("Die aktuell platzierten Gadgets sind unter initialPlacements enthalten.");
  const fileInput = useRef<HTMLInputElement>(null);

  const parse = () => {
    const parsed = validateLevel(JSON.parse(json));
    setMessage("JSON ist gültig.");
    return parsed;
  };

  const tryAction = (action: (parsed: LevelDefinition) => void) => {
    try { action(parse()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Ungültiges Level-JSON"); }
  };

  const download = () => tryAction((parsed) => {
    const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${parsed.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Level-JSON wurde heruntergeladen.");
  });

  const saveLocal = () => tryAction((parsed) => {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(parsed, null, 2));
    setMessage("Entwurf wurde in diesem Browser gespeichert.");
  });

  const loadLocal = () => {
    const draft = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!draft) { setMessage("Es gibt noch keinen lokalen Entwurf."); return; }
    setJson(draft);
    setMessage("Lokaler Entwurf geladen. Mit „Im Spiel testen“ anwenden.");
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      validateLevel(JSON.parse(text));
      setJson(text);
      setMessage(`${file.name} wurde geladen und geprüft.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Datei konnte nicht gelesen werden.");
    }
  };

  return (
    <div className="modal editor-modal" onClick={onClose}>
      <section onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <p className="eyebrow">LEVEL-EDITOR</p>
        <h2>{level.title}</h2>
        <p className="editor-help">Baue auf dem Spielfeld, öffne den Editor und speichere die Anordnung als JSON. Metadaten, Inventar, feste Gadgets, Systeme und Zielprüfung können hier direkt geändert werden.</p>
        <textarea aria-label="Level JSON" value={json} onChange={(event) => setJson(event.target.value)} spellCheck={false} />
        <p className="editor-message" role="status">{message}</p>
        <div className="editor-actions">
          <button onClick={() => tryAction((parsed) => { onApply(parsed); onClose(); })}>▶ Im Spiel testen</button>
          <button onClick={download}>⇩ JSON herunterladen</button>
          <button onClick={() => fileInput.current?.click()}>⇧ JSON einlesen</button>
          <button onClick={saveLocal}>Entwurf speichern</button>
          <button onClick={loadLocal}>Entwurf laden</button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void loadFile(event.target.files?.[0])} />
      </section>
    </div>
  );
}
