import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { validateLevel } from "@/levels/catalog";
import { GADGET_CATALOG, PALETTE_GROUPS } from "@/engine/gadget-catalog";
import { resizeGadget, resizeHandles } from "@/engine/gadget-geometry";
import GadgetSelection from "./GadgetSelection";
import type { GadgetConnection, GadgetInstanceConfig, GadgetType, GoalSelector, LevelDefinition } from "@/engine/types";
import { combineGoals, goalList, hitGadget, newLevel, rectangleGoal, redo, remember, removeGadget, STATE_LABELS, undo, updateGadget, type LevelHistory } from "@/levels/authoring";
import { downloadLevel, pickLevelDirectory, readLevelDirectory, readLevelFiles, supportsLevelFolders, writeLevelFile, type LevelDirectory, type LevelFile } from "@/levels/file-storage";
import { connectPorts, connectionPorts, gadgetPortKey, distanceToPath, gadgetPorts, type GadgetPort } from "@/game/gadget-connections";
import { advanceRopeDraft, ropePorts, type PendingControlRope } from "@/game/control-ropes";
import GameCanvas from "./GameCanvas";
import GoalEditor from "./GoalEditor";
import GoalOverlay from "./GoalOverlay";
import { placedConfigId, type PlacedGadget } from "./types";

const LOCAL_DRAFT_KEY = "machine-level-editor-draft";
const EMPTY: never[] = [];
const NO_WIN = () => {};

function editableLevel(level: LevelDefinition, placed: PlacedGadget[], connections: GadgetConnection[]) {
  const initialPlacements: GadgetInstanceConfig[] = placed.map(gadget => ({
    id: placedConfigId(gadget), type: gadget.type, x: gadget.x, y: gadget.y, rotation: gadget.rotation, flipX: gadget.flipX, flipY: gadget.flipY,
    collisionLabel: gadget.collisionLabel, physics: gadget.physics, properties: gadget.properties, role: gadget.role, tags: gadget.tags?.filter(tag => tag !== "player-part"), state: gadget.state,
  }));
  return structuredClone({ ...level, initialPlacements, connections });
}

type LevelEditorProps = {
  level: LevelDefinition; placed: PlacedGadget[]; connections: GadgetConnection[];
  onApply: (level: LevelDefinition) => void; onClose: (draft: LevelDefinition) => void;
  savedLevel?: LevelDefinition | null;
  renderTest: (level: LevelDefinition, onClose: () => void) => ReactNode;
};

export default function LevelEditor({ level, placed, connections, onApply, onClose, renderTest, savedLevel }: LevelEditorProps) {
  const [history, setHistory] = useState<LevelHistory>(() => ({ past: [], present: savedLevel ? structuredClone(savedLevel) : editableLevel(level, placed, connections), future: [] }));
  const draft = history.present;
  const [tool, setTool] = useState<GadgetType | null>(null);
  const [placement, setPlacement] = useState<"fixedGadgets" | "initialPlacements">("fixedGadgets");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<GadgetPort | null>(null);
  const [pendingRope, setPendingRope] = useState<PendingControlRope | null>(null);
  const [selectedRope, setSelectedRope] = useState<string | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [areaSelector, setAreaSelector] = useState<GoalSelector | null>(null);
  const [areaDrag, setAreaDrag] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; before: LevelDefinition; resize?: { config: GadgetInstanceConfig; end: 0 | 1 } } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Wähle ein Bauteil und klicke auf das Spielfeld. Die Zahl rechts legt das zusätzliche Spielerinventar fest.");
  const [directory, setDirectory] = useState<LevelDirectory | null>(null);
  const [files, setFiles] = useState<LevelFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [json, setJson] = useState<string | null>(null);
  const [testLevel, setTestLevel] = useState<LevelDefinition | null>(null);
  const [savedDraft] = useState(() => { try { return typeof window === "undefined" ? null : localStorage.getItem(LOCAL_DRAFT_KEY); } catch { return null; } });
  const fileInput = useRef<HTMLInputElement>(null), folderInput = useRef<HTMLInputElement>(null);
  const gadgets = useMemo(() => [...draft.fixedGadgets, ...(draft.initialPlacements ?? [])], [draft]);
  const selected = gadgets.find(gadget => gadget.id === selectedId);
  const preview = useMemo(() => ({ ...draft, fixedGadgets: gadgets, initialPlacements: [] }), [draft, gadgets]);
  const change = useCallback((next: LevelDefinition) => setHistory(current => remember(current, next)), []);
  const resetTools = () => { setSelectedId(null); setSelectedConnection(null); setSelectedRope(null); setPendingConnection(null); setPendingRope(null); setAreaSelector(null); setAreaDrag(null); drag.current = null; };
  const stepBack = useCallback(() => { setHistory(undo); setSelectedId(null); setSelectedConnection(null); setSelectedRope(null); setPendingConnection(null); setPendingRope(null); setAreaSelector(null); setAreaDrag(null); drag.current = null; }, []);
  const stepForward = useCallback(() => { setHistory(redo); setSelectedId(null); setSelectedConnection(null); setSelectedRope(null); setPendingConnection(null); setPendingRope(null); }, []);

  useEffect(() => {
    if (testLevel) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft)); }
      catch { setMessage("Der Browserentwurf konnte nicht gespeichert werden. Speichere das Level als Datei."); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, testLevel]);

  const remove = useCallback(() => {
    if (selectedId) change(removeGadget(draft, selectedId));
    else if (selectedConnection) change({ ...draft, connections: (draft.connections ?? []).filter(connection => connection.id !== selectedConnection) });
    else if (selectedRope) change({ ...draft, controlRopes: (draft.controlRopes ?? []).filter(rope => rope.targetId !== selectedRope) });
    setSelectedId(null); setSelectedConnection(null); setSelectedRope(null);
  }, [change, draft, selectedId, selectedConnection, selectedRope]);
  useEffect(() => {
    if (testLevel) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) stepForward(); else stepBack(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); stepForward(); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); remove(); }
      else if (event.key === "Escape") {
        if (drag.current) { const before = drag.current.before; setHistory(current => ({ ...current, present: before })); }
        setTool(null); resetTools();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [testLevel, remove, stepBack, stepForward]);

  const point = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = event.currentTarget.querySelector("canvas")!;
    const bounds = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(900, (event.clientX - bounds.left) / bounds.width * 900)), y: Math.max(0, Math.min(520, (event.clientY - bounds.top) / bounds.height * 520)) };
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const at = point(event);
    if (selected && !tool && !showGoals) {
      const end = resizeHandles(selected).findIndex(handle => Math.hypot(at.x - handle.x, at.y - handle.y) <= 14);
      if (end >= 0) { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: selected.id, dx: 0, dy: 0, before: draft, resize: { config: selected, end: end as 0 | 1 } }; return; }
    }
    if (areaSelector) { event.currentTarget.setPointerCapture(event.pointerId); setAreaDrag({ start: at, end: at }); return; }
    if (tool === "rope") {
      const port = ropePorts(gadgets).find(port => Math.hypot(at.x - port.x, at.y - port.y) < 26);
      if (!port) { setMessage("Klicke einen Griff, optional Umlenkrollen und zuletzt einen Zugpunkt."); return; }
      const next = advanceRopeDraft(pendingRope, port, draft.controlRopes ?? [], Infinity);
      setPendingRope(next.pending);
      if (next.connection) { change({ ...draft, systems: [...new Set([...draft.systems, "tension-rope"])], controlRopes: [...(draft.controlRopes ?? []), next.connection] }); setSelectedRope(next.connection.targetId); if (!event.shiftKey) setTool(null); }
      return;
    }
    if (tool === "wire" || tool === "belt") {
      const port = gadgetPorts(gadgets).filter(port => tool === "wire" ? port.kind !== "drive" : port.kind === "drive").find(port => Math.hypot(at.x - port.x, at.y - port.y) < 26);
      if (!port) { setMessage(tool === "wire" ? "Verbinde STROM am Generator mit STECKDOSE am Verbraucher." : "Verbinde zwei ANTRIEB-Anschlüsse."); return; }
      if (!pendingConnection) setPendingConnection(port);
      else {
        const connection = connectPorts(pendingConnection, port, tool, draft.connections ?? [], `connection-${crypto.randomUUID()}`);
        if (connection) { change({ ...draft, connections: [...(draft.connections ?? []), connection] }); setPendingConnection(null); setSelectedConnection(connection.id); if (!event.shiftKey) setTool(null); }
        else { setPendingConnection(null); setMessage("Diese Anschlüsse können nicht verbunden werden."); }
      }
      return;
    }
    if (tool && !showGoals) {
      const definition = GADGET_CATALOG[tool], id = `${tool}-${crypto.randomUUID().slice(0, 8)}`;
      const gadget: GadgetInstanceConfig = { id, type: tool, ...at, rotation: definition.defaultRotation ?? 0,
        ...(["candle", "cat", "mouse", "fish", "fishBowl"].includes(tool) ? { properties: { standalone: true } } : {}), ...(tool === "fish" ? { state: "flopping" } : {}) };
      change({ ...draft, [placement]: [...(draft[placement] ?? []), gadget] }); setSelectedId(id); setSelectedConnection(null); setSelectedRope(null); if (!event.shiftKey) setTool(null); return;
    }
    const gadget = hitGadget(gadgets, at);
    setSelectedId(gadget?.id ?? null); setSelectedConnection(null); setSelectedRope(null);
    if (gadget) {
      if (!showGoals) { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: gadget.id, dx: gadget.x - at.x, dy: gadget.y - at.y, before: draft }; }
      return;
    }
    const ports = gadgetPorts(gadgets);
    const connection = (draft.connections ?? []).find(connection => distanceToPath(at, connectionPorts(connection, ports)) < 12);
    if (connection) setSelectedConnection(connection.id);
    const rope = (draft.controlRopes ?? []).find(rope => {
      const path = [rope.targetId, ...rope.guides, rope.source.gadgetId].flatMap(id => gadgets.filter(item => item.id === id));
      return distanceToPath(at, path) < 12;
    });
    if (rope) { setSelectedRope(rope.targetId); setSelectedConnection(null); }
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const at = point(event);
    if (areaDrag) setAreaDrag({ ...areaDrag, end: at });
    if (drag.current) {
      const moving = drag.current;
      const update = moving.resize ? resizeGadget(moving.resize.config, moving.resize.end, at) : { x: Math.max(0, Math.min(900, at.x + moving.dx)), y: Math.max(0, Math.min(520, at.y + moving.dy)) };
      setHistory(current => ({ ...current, present: updateGadget(current.present, moving.id, update) }));
    }
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (areaDrag && areaSelector) {
      const goal = rectangleGoal(areaSelector, areaDrag.start, point(event));
      if (goal.kind === "area" && goal.width >= 5 && goal.height >= 5) { change({ ...draft, schemaVersion: 2, goal: combineGoals([...goalList(draft.goal), goal], "kind" in draft.goal && draft.goal.kind === "any" ? "any" : "all") }); setAreaSelector(null); }
      else setMessage("Der Zielbereich muss mindestens 5 × 5 Pixel groß sein.");
      setAreaDrag(null);
    }
    if (drag.current) { const before = drag.current.before; setHistory(current => remember({ ...current, present: before }, current.present)); drag.current = null; }
  };

  const tryAction = (action: () => void | Promise<void>) => {
    Promise.resolve().then(action).catch(error => { if (error?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "Die Aktion konnte nicht abgeschlossen werden."); });
  };
  const load = (next: LevelDefinition) => { change(next); resetTools(); setTool(null); setJson(null); };
  const openFolder = () => {
    if (!supportsLevelFolders()) { folderInput.current?.click(); return; }
    tryAction(async () => {
      const folder = await pickLevelDirectory("readwrite");
      setDirectory(folder);
      try { const imported = await readLevelDirectory(folder); setFiles(imported); load(imported[0].level); setMessage(`${imported.length} Levels aus „${folder.name}“ geladen.`); }
      catch (error) { setFiles([]); setMessage(error instanceof Error ? error.message : "Leerer Ordner ausgewählt."); }
    });
  };
  const save = () => tryAction(async () => {
    const parsed = validateLevel(draft);
    if (!goalList(parsed.goal).length) throw new Error("Definiere zuerst mindestens ein Goal.");
    if (!directory && !supportsLevelFolders()) { downloadLevel(parsed); setMessage("Level-JSON wurde heruntergeladen. Lege die Datei in deinem Levelordner ab."); return; }
    const folder = directory ?? await pickLevelDirectory("readwrite");
    setDirectory(folder); setBusy(true);
    try {
      const path = await writeLevelFile(folder, parsed, files.find(file => file.level.id === parsed.id)?.path);
      setFiles(current => [...current.filter(file => file.level.id !== parsed.id), { level: parsed, path }].sort((a, b) => a.level.number - b.level.number));
      setMessage(`„${folder.name}/${path}“ gespeichert.`);
    } finally { setBusy(false); }
  });
  const loadFile = (file?: File) => tryAction(async () => { if (file) { const [imported] = await readLevelFiles([file]); load(imported.level); setMessage(`${file.name} geladen.`); } });

  if (testLevel) return renderTest(testLevel, () => setTestLevel(null));
  const catalog = Object.values(GADGET_CATALOG).filter(gadget => `${gadget.displayName} ${gadget.type} ${gadget.description}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="game-shell visual-editor">
    <header className="editor-header"><div><small>WERKSTATT</small><h1>Level-Editor</h1></div><div className="editor-actions">
      <button onClick={() => { load(newLevel(Math.max(draft.number, ...files.map(file => file.level.number)) + 1)); setMessage("Neues leeres Level angelegt."); }}>+ Neues Level</button>
      <button onClick={openFolder}>Ordner öffnen</button><button onClick={save} disabled={busy}>{busy ? "Speichert…" : "Im Ordner speichern"}</button>
      <button onClick={() => tryAction(() => { const parsed = validateLevel(draft); if (!goalList(parsed.goal).length) throw new Error("Definiere zuerst mindestens ein Goal."); setTool(null); resetTools(); setTestLevel(parsed); })}>▶ Im Spiel testen</button>
      <button onClick={() => tryAction(() => { onApply(validateLevel(draft)); onClose(draft); })}>Level übernehmen</button><button onClick={() => onClose(draft)}>Zurück zum Spiel</button>
    </div></header>
    <section className="editor-metadata" aria-label="Levelbeschreibung">
      <label>Levelname<input value={draft.title} onChange={event => change({ ...draft, title: event.target.value })} /></label>
      <label>Nummer<input type="number" min="1" value={draft.number} onChange={event => change({ ...draft, number: Math.max(1, Math.trunc(Number(event.target.value))) })} /></label>
      <label className="editor-objective">Zielbeschreibung<input value={draft.objective} onChange={event => change({ ...draft, objective: event.target.value })} /></label>
      {files.length > 0 && <label>Levels im Ordner<select value={files.some(file => file.level.id === draft.id) ? draft.id : ""} onChange={event => { const file = files.find(file => file.level.id === event.target.value); if (file) load(file.level); }}><option value="">Neues / anderes Level</option>{files.map(file => <option key={file.level.id} value={file.level.id}>{file.level.number} · {file.level.title}</option>)}</select></label>}
    </section>
    <div className="editor-controls editor-actions">
      <button onClick={() => { setTool(null); resetTools(); setShowGoals(false); }} aria-pressed={tool === null && !showGoals}>↖ Bearbeiten</button>
      <label>Neue Bauteile<select value={placement} onChange={event => setPlacement(event.target.value as typeof placement)}><option value="fixedGadgets">Fest vorgegeben</option><option value="initialPlacements">Verschiebbarer Startaufbau</option></select></label>
      <button onClick={stepBack} disabled={!history.past.length}>↶ Undo</button><button onClick={stepForward} disabled={!history.future.length}>↷ Redo</button>
      <button onClick={remove} disabled={!selectedId && !selectedConnection && !selectedRope}>× Entfernen</button>
      <button onClick={() => { setShowGoals(value => !value); setTool(null); setPendingConnection(null); setPendingRope(null); setAreaSelector(null); }} aria-pressed={showGoals}>◎ Goal</button>
      <label className="editor-checkbox"><input type="checkbox" checked={draft.floor !== false} onChange={event => change({ ...draft, floor: event.target.checked })} />Boden</label>
      <span>{directory ? `Ordner: ${directory.name}` : "Entwurf im Browser"} · {gadgets.length} gesetzte Bauteile</span>
    </div>
    <div className="workspace editor-workspace">
      <section className="board-wrap">
        <div className="board" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { if (drag.current) { const before = drag.current.before; setHistory(current => ({ ...current, present: before })); } drag.current = null; setAreaDrag(null); }}>
          <GameCanvas level={preview} placed={EMPTY} ropePath={EMPTY} scissorRopes={draft.controlRopes ?? EMPTY} pendingScissor={pendingRope} ropeMode={tool === "rope"} selectedTool={tool} selectedId={null} connections={draft.connections ?? EMPTY} selectedConnection={selectedConnection} pendingConnection={pendingConnection ? gadgetPortKey(pendingConnection) : null} selectedRope={selectedRope} running={false} attempt={0} onWin={NO_WIN} />
          <GoalOverlay goal={draft.goal} />
          {selected && !showGoals && <GadgetSelection gadget={selected} resizable />}
          <svg className="editor-overlay" viewBox="0 0 900 520" aria-hidden="true">

            {areaDrag && <rect className="area-draft" x={Math.min(areaDrag.start.x, areaDrag.end.x)} y={Math.min(areaDrag.start.y, areaDrag.end.y)} width={Math.abs(areaDrag.start.x - areaDrag.end.x)} height={Math.abs(areaDrag.start.y - areaDrag.end.y)} />}
          </svg>
        </div>
        <p className="editor-message" role="status">{message}</p>
        {selected && !showGoals && <div className="gadget-properties">
          <b>{GADGET_CATALOG[selected.type].displayName} · {selected.id}</b>
          {GADGET_CATALOG[selected.type].rotatable && <><button aria-label="Links drehen" onClick={() => change(updateGadget(draft, selected.id, { rotation: (selected.rotation ?? 0) - Math.PI / 12 }))}>↶ Links drehen</button><button aria-label="Rechts drehen" onClick={() => change(updateGadget(draft, selected.id, { rotation: (selected.rotation ?? 0) + Math.PI / 12 }))}>↷ Rechts drehen</button></>}
          {GADGET_CATALOG[selected.type].flippable && <><button aria-pressed={!!selected.flipX} onClick={() => change(updateGadget(draft, selected.id, { flipX: !selected.flipX }))}>↔ Horizontal spiegeln</button><button aria-pressed={!!selected.flipY} onClick={() => change(updateGadget(draft, selected.id, { flipY: !selected.flipY }))}>↕ Vertikal spiegeln</button></>}
          <label>Ablage<select value={draft.fixedGadgets.some(gadget => gadget.id === selected.id) ? "fixedGadgets" : "initialPlacements"} onChange={event => {
            const group = event.target.value as typeof placement;
            change({ ...draft, fixedGadgets: draft.fixedGadgets.filter(gadget => gadget.id !== selected.id), initialPlacements: (draft.initialPlacements ?? []).filter(gadget => gadget.id !== selected.id), [group]: [...(draft[group] ?? []).filter(gadget => gadget.id !== selected.id), selected] });
          }}><option value="fixedGadgets">Fest vorgegeben</option><option value="initialPlacements">Verschiebbarer Startaufbau</option></select></label>
          <label>Startstatus<select value={selected.state ?? GADGET_CATALOG[selected.type].defaultState} onChange={event => change(updateGadget(draft, selected.id, { state: event.target.value }))}>{[...new Set([selected.state ?? GADGET_CATALOG[selected.type].defaultState, ...Object.keys(GADGET_CATALOG[selected.type].animations)])].map(state => <option key={state} value={state}>{STATE_LABELS[state] ?? state}</option>)}</select></label>
          <label>Drehung °<input type="number" step="15" value={Math.round((selected.rotation ?? 0) * 180 / Math.PI)} onChange={event => change(updateGadget(draft, selected.id, { rotation: Number(event.target.value) * Math.PI / 180 }))} /></label>
          {(["x", "y"] as const).map(axis => <label key={axis}>{axis.toUpperCase()}<input type="number" value={Math.round(selected[axis])} onChange={event => change(updateGadget(draft, selected.id, { [axis]: Number(event.target.value) }))} /></label>)}
        </div>}
        <details className="editor-advanced"><summary>Dateien, Hinweise und JSON</summary><div className="editor-actions">
          <button onClick={() => tryAction(() => { downloadLevel(draft); setMessage("Level-JSON heruntergeladen."); })}>JSON herunterladen</button><button onClick={() => fileInput.current?.click()}>JSON einlesen</button>
          <button onClick={() => tryAction(() => { const saved = savedDraft ?? localStorage.getItem(LOCAL_DRAFT_KEY); if (!saved) throw new Error("Kein lokaler Entwurf vorhanden."); load(validateLevel(JSON.parse(saved))); setMessage("Lokaler Entwurf geladen."); })}>Entwurf laden</button>
          <button onClick={() => setJson(JSON.stringify(draft, null, 2))}>JSON bearbeiten</button>
        </div><label>Tipp<input value={draft.hint} onChange={event => change({ ...draft, hint: event.target.value })} /></label><label>Erfolgstext<input value={draft.successText} onChange={event => change({ ...draft, successText: event.target.value })} /></label></details>
      </section>
      <aside className="editor-palette" aria-label="Bauteile und Spielerinventar"><h2>BAUTEILE</h2>
        {showGoals && <GoalEditor level={draft} selectedId={selectedId} onChange={change} drawing={areaSelector !== null} onDrawArea={selector => { setAreaSelector(selector); setTool(null); }} />}
        <label>Bauteil suchen<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Kugel, Katze, Steckdose…" /></label>
        <p className="inventory-help">Bauteil anklicken: einmal setzen, dann bearbeiten. Shift: mehrfach setzen. Anzahl: zusätzliche frei platzierbare Bauteile für den Spieler.</p>
        <div className="editor-categories">{PALETTE_GROUPS.map(group => { const entries = catalog.filter(gadget => gadget.paletteGroup === group); const open = !!search.trim() || !collapsed.has(group); return entries.length > 0 && <section className="palette-group" key={group}><button className="palette-category" aria-expanded={open} onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(group)) next.delete(group); else next.add(group); return next; })}>{open ? "▾" : "▸"} {group} <small>{entries.length}</small></button>{open && <div className="editor-part-list">{entries.map(gadget => <div className="editor-part-row" key={gadget.type}>
          <button className={tool === gadget.type ? "selected" : ""} title={gadget.description} aria-label={`${gadget.displayName} platzieren`} aria-pressed={tool === gadget.type} onClick={() => { setTool(gadget.type); setShowGoals(false); resetTools(); }}><span className={`part ${gadget.type}`}>{gadget.icon}</span><span>{gadget.displayName}</span></button>
          <input type="number" min="0" step="1" aria-label={`Spielerinventar ${gadget.displayName}`} title="Zusätzliche frei platzierbare Bauteile" value={draft.inventory.find(entry => entry.type === gadget.type)?.count ?? 0} onChange={event => {
            const count = Math.max(0, Math.trunc(Number(event.target.value)));
            const inventory = draft.inventory.filter(entry => entry.type !== gadget.type);
            change({ ...draft, inventory: count > 0 ? [...inventory, { type: gadget.type, count }] : inventory });
          }} />
        </div>)}</div>}</section>; })}{catalog.length === 0 && <p>Keine Bauteile gefunden.</p>}</div>
      </aside>
    </div>
    <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={event => { loadFile(event.target.files?.[0]); event.target.value = ""; }} />
    <input ref={folderInput} type="file" {...{ webkitdirectory: "", directory: "" }} multiple hidden onChange={event => { const selectedFiles = Array.from(event.target.files ?? []); event.target.value = ""; tryAction(async () => { const imported = await readLevelFiles(selectedFiles); setDirectory(null); setFiles(imported); load(imported[0].level); setMessage(`${imported.length} Levels geladen. Speichern über JSON herunterladen.`); }); }} />
    {json !== null && <div className="modal editor-modal"><section><button className="close" aria-label="JSON schließen" onClick={() => setJson(null)}>×</button><h2>Level JSON</h2><textarea aria-label="Level JSON" value={json} onChange={event => setJson(event.target.value)} spellCheck={false} /><p role="status">{message}</p><div className="editor-actions"><button onClick={() => tryAction(() => { load(validateLevel(JSON.parse(json))); setMessage("JSON übernommen."); })}>JSON übernehmen</button><button onClick={() => setJson(null)}>Abbrechen</button></div></section></div>}
  </main>;
}
