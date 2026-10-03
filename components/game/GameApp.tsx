"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { GADGET_CATALOG } from "@/engine/gadget-catalog";
import type { GadgetConnection, InventoryEntry, LevelDefinition, PlaceableGadgetType } from "@/engine/types";
import { LEVELS } from "@/levels/catalog";
import { analyzePulleyRoute, type PulleyRouteKind } from "@/game/pulley";
import { advanceRopeDraft, ropePorts, ropeUsesGadget, ropeConfigPoints, controlRopeKey, type PendingControlRope } from "@/game/control-ropes";
import { gadgetPorts, connectPorts, connectionPorts, gadgetPortKey, distanceToPath, type GadgetPort } from "@/game/gadget-connections";
import GameCanvas from "./GameCanvas";
import { routeKindForPart } from "@/game/simulation-setup";
import GameHeader from "./GameHeader";
import GameToolbar from "./GameToolbar";
import LevelEditor from "./LevelEditor";
import LevelSelectDialog from "./LevelSelectDialog";
import LoginScreen from "./LoginScreen";
import MissionPanel from "./MissionPanel";
import PartsPanel from "./PartsPanel";
import PhysicsHandbook from "./PhysicsHandbook";
import ScoreDialog, { type ScoreEntry } from "./ScoreDialog";
import type { PlacedGadget, RopeNode, ScissorRope } from "./types";
import { placedConfigId } from "./types";
import GoalOverlay from "./GoalOverlay";
import GadgetSelection from "./GadgetSelection";
import { hitGadget } from "@/levels/authoring";
import { initialPlacements, initialConnections, remainingInventory } from "./placements";



function readScores(): ScoreEntry[] {
  try { return JSON.parse(localStorage.getItem("machine-scores") || "[]") as ScoreEntry[]; }
  catch { return []; }
}

function defaultRotation(type: PlaceableGadgetType) {
  return GADGET_CATALOG[type].defaultRotation ?? 0;
}

export default function GameApp({ initialLevel = LEVELS[0], onExitTest }: { initialLevel?: LevelDefinition; onExitTest?: () => void } = {}) {
  const [name, setName] = useState(onExitTest ? "Level-Test" : "");
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState<LevelDefinition>(initialLevel);
  const ROPE_ANCHOR = level.loadRope?.anchor ?? {x:0,y:0};
  const [folderLevels, setFolderLevels] = useState<LevelDefinition[] | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [customLevel, setCustomLevel] = useState<LevelDefinition | null>(null);
  const [selected, setSelected] = useState<PlaceableGadgetType | null>(initialLevel.inventory[0]?.type ?? null);
  const [placed, setPlaced] = useState<PlacedGadget[]>(() => initialPlacements(initialLevel));
  const [ropePath, setRopePath] = useState<RopeNode[]>([]);
  const [scissorRopes, setScissorRopes] = useState<ScissorRope[]>(() => structuredClone(initialLevel.controlRopes ?? []));
  const [pendingScissor, setPendingScissor] = useState<PendingControlRope | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [connections, setConnections] = useState<GadgetConnection[]>(() => initialConnections(initialLevel));
  const [pendingConnection, setPendingConnection] = useState<GadgetPort | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [selectedRope, setSelectedRope] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [showScores, setShowScores] = useState(false);
  const [showPhysics, setShowPhysics] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorDraft, setEditorDraft] = useState<LevelDefinition | null>(null);
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number } | null>(null);

  const transformDrag = useRef<{ before: PlacedGadget } | null>(null);

  useEffect(() => {
    if (onExitTest) return;
    const timer = window.setTimeout(() => setName(localStorage.getItem("machine-user") || ""), 0);
    return () => window.clearTimeout(timer);
  }, [onExitTest]);

  useEffect(() => {
    if (showEditor) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPendingScissor(null); setPendingConnection(null); setSelected(null); setDrag(null); if (transformDrag.current) { const before = transformDrag.current.before; setPlaced(items => items.map(item => item.id === before.id ? before : item)); transformDrag.current = null; } }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [showEditor]);

  const availableLevels = useMemo(() => {
    const source = onExitTest ? [initialLevel] : folderLevels ?? LEVELS;
    if (!customLevel) return source;
    const withoutSameId = source.filter((item) => item.id !== customLevel.id);
    return [...withoutSameId, customLevel].sort((a, b) => a.number - b.number);
  }, [customLevel, folderLevels, onExitTest, initialLevel]);
  const levelPosition = Math.max(0, availableLevels.indexOf(level)) + 1;

  const clearAttempt = (nextLevel: LevelDefinition, bumpAttempt = false) => {
    setRunning(false);
    setPlaced(initialPlacements(nextLevel));
    setRopePath([]);
    setScissorRopes(structuredClone(nextLevel.controlRopes ?? []));
    setPendingScissor(null);
    setSelectedId(null);
    setConnections(initialConnections(nextLevel)); setPendingConnection(null); setSelectedConnection(null); setSelectedRope(null);
    setWon(false);
    setAttempt((value) => bumpAttempt ? value + 1 : 0);
  };

  const changeLevel = (nextLevel: LevelDefinition) => {
    setEditorDraft(null);
    setLevel(nextLevel);
    setSelected(nextLevel.inventory[0]?.type ?? null);
    clearAttempt(nextLevel);
    setShowLevels(false);
  };

  const reset = () => clearAttempt(level, true);
  const login = () => {
    const playerName = draft.trim();
    if (!playerName) return;
    localStorage.setItem("machine-user", playerName);
    setName(playerName);
  };

  const boardPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width * 900, y: (event.clientY - bounds.top) / bounds.height * 520 };
  };

  const boardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (running) return;
    if (event.button !== 0) return;
    const point = boardPoint(event);
    const configs = [...level.fixedGadgets, ...placed.map(part => ({ ...part, id: placedConfigId(part) }))];
    const selectRope = (id: string) => { setSelectedRope(id); setSelectedId(null); setSelectedConnection(null); setPendingScissor(null); setSelected(null); };
    if (selected === "wire" || selected === "belt") {
      const kind = selected, ports = gadgetPorts(configs).filter(port => kind === "wire" ? port.kind !== "drive" : port.kind === "drive");
      const port = ports.map(port => ({ port, distance: Math.hypot(point.x - port.x, point.y - port.y) })).sort((a, b) => a.distance - b.distance)[0];
      if (port && port.distance < 24) {
        const limit = (level.inventory.find(entry => entry.type === kind)?.count ?? 0) + (level.connections ?? []).filter(item => item.kind === kind).length;
        if (!pendingConnection) { if (connections.filter(item => item.kind === kind).length < limit) setPendingConnection(port.port); }
        else {
          const connection = connectPorts(pendingConnection, port.port, kind, connections, `connection-${Math.round(performance.now() * 1000)}`);
          if (connection) { setConnections(items => [...items, connection]); setSelectedConnection(connection.id); setSelectedId(null); setSelectedRope(null); setSelected(null); setPendingConnection(null); }
          else if (pendingConnection.gadgetId === port.port.gadgetId) setPendingConnection(null);
        }
        return;
      }
      if (pendingConnection) return;
    }

    if (selected === "rope" && !level.loadRope) {
      const limit = (level.inventory.find(entry => entry.type === "rope")?.count ?? 0) + (level.controlRopes ?? []).length;
      const ports = ropePorts([...level.fixedGadgets, ...placed.map(part => ({ ...part, id: placedConfigId(part) }))]);
      const port = ports.map(port => ({ port, distance: Math.hypot(port.x - point.x, port.y - point.y) }))
        .filter(item => item.distance < 26).sort((a, b) => a.distance - b.distance)[0]?.port;
      if (port) {
        // Select a connected cable; removal uses the shared toolbar action.
        const connected = scissorRopes.some(rope => rope.targetId === port.gadgetId && rope.targetPortId === port.portId);
        if (port.kind === "target" && connected) {
          selectRope(controlRopeKey({targetId:port.gadgetId,targetPortId:port.portId}));
          return;
        }
        const next = advanceRopeDraft(pendingScissor, port, scissorRopes, limit);
        setPendingScissor(next.pending);
        if (next.connection) {
          setScissorRopes(ropes => [...ropes, next.connection!]);
          setSelectedRope(controlRopeKey(next.connection)); setSelectedId(null); setSelectedConnection(null);
          setSelected(null);
        }
        return;
      }
      setPendingScissor(null);
      // An ordinary click outside a port can still select and move a part.
    }

    if (selected === "rope" && !!level.loadRope) {
      const candidates: Array<[number, RopeNode]> = [];
      if (!ropePath.some((node) => node.kind === "anchor")) candidates.push([Math.hypot(point.x - ROPE_ANCHOR.x, point.y - ROPE_ANCHOR.y), { kind: "anchor" }]);
      for (const part of placed) {
        if (!routeKindForPart(part.type) || ropePath.some((node) => node.kind === "part" && node.placedId === part.id)) continue;
        candidates.push([Math.hypot(part.x - point.x, part.y - point.y), { kind: "part", placedId: part.id }]);
      }
      candidates.sort((a, b) => a[0] - b[0]);
      if (candidates[0]?.[0] < 48) setRopePath((nodes) => [...nodes, candidates[0][1]]);
      return;
    }

    // The center of a movable body stays draggable, including connected rope ends.
    const bodyCenter = placed.find(part => Math.hypot(part.x - point.x, part.y - point.y) < 23);
    if (bodyCenter && selected === null) {
      event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(bodyCenter.id); setSelectedConnection(null); setSelectedRope(null);
      transformDrag.current = { before: bodyCenter }; setDrag({ id: bodyCenter.id, dx: bodyCenter.x - point.x, dy: bodyCenter.y - point.y }); return;
    }
    // Connections can be selected along their full path, even when inventory is exhausted.
    const configById = new Map(configs.map(config => [config.id, config]));
    const paths = scissorRopes.map(rope => {
      return {id:controlRopeKey(rope),points:ropeConfigPoints(rope,[...configById.values()])};
    });
    const cable = paths.map(path => ({ ...path, distance: distanceToPath(point, path.points) })).sort((a, b) => a.distance - b.distance)[0];
    if (cable && cable.distance < 13) { selectRope(cable.id); return; }
    const pulleyPoints = ropePath.flatMap(node => node.kind === "anchor" ? [ROPE_ANCHOR] : placed.filter(part => part.id === node.placedId));
    if (distanceToPath(point, pulleyPoints) < 13 || (pulleyPoints.length === 1 && Math.hypot(point.x - pulleyPoints[0].x, point.y - pulleyPoints[0].y) < 18)) { selectRope("pulley-rope"); return; }
    const ports = gadgetPorts(configs);
    const connection = connections.map(item => ({ ...item, distance: distanceToPath(point, connectionPorts(item, ports)) })).sort((a, b) => a.distance - b.distance)[0];
    if (connection && connection.distance < 13) { setSelectedConnection(connection.id); setSelectedId(null); setSelectedRope(null); setPendingConnection(null); setSelected(null); return; }

    const hit = hitGadget(placed.map(part => ({ ...part, id: placedConfigId(part) })), point);
    const movable = hit && placed.find(part => placedConfigId(part) === hit.id);
    if (movable) {
      event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(movable.id);
      setSelectedConnection(null); setSelectedRope(null); transformDrag.current = { before: movable };
      setDrag({ id: movable.id, dx: movable.x - point.x, dy: movable.y - point.y }); return;
    }

    const allowed = level.inventory.find((entry) => entry.type === selected);
    if (!selected || !allowed || selected === "rope" || selected === "wire" || selected === "belt") return;
    if (remainingInventory(allowed, level, placed, connections, scissorRopes, ropePath.length > 0) === 0) return;
    const id = Math.round(performance.now() * 1000);
    setSelectedId(id);
    setSelectedConnection(null); setSelectedRope(null);
    setPlaced((items) => [...items, { id, type: selected, x: point.x, y: point.y, rotation: defaultRotation(selected), tags: ["player-part"], ...(["candle", "cat", "mouse", "fish", "fishBowl"].includes(selected) ? { properties: { standalone: true } } : {}), ...(selected === "fish" ? { state: "flopping" } : {}) }]);
  };

  const boardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (running) return;
    const point = boardPoint(event);
    if (!drag) return;
    setPlaced((items) => items.map((part) => part.id === drag.id ? {
      ...part,
      x: Math.max(25, Math.min(875, point.x + drag.dx)),
      y: Math.max(25, Math.min(level.floor === false ? 495 : 475, point.y + drag.dy)),
    } : part));
  };

  const selectedPlaced = placed.find((part) => part.id === selectedId);
  const canRotate = Boolean(selectedPlaced && GADGET_CATALOG[selectedPlaced.type].rotatable);
  const removeSelected = () => {
    if (selectedConnection) { setConnections(items => items.filter(item => item.id !== selectedConnection)); setSelectedConnection(null); return; }
    if (selectedRope) {
      if (selectedRope === "pulley-rope") setRopePath([]);
      else setScissorRopes(ropes => ropes.filter(rope => controlRopeKey(rope) !== selectedRope));
      setSelectedRope(null); setPendingScissor(null); return;
    }
    if (selectedId === null) return;
    setPlaced((items) => items.filter((part) => part.id !== selectedId));
    setRopePath((nodes) => {
      const index = nodes.findIndex((node) => node.kind === "part" && node.placedId === selectedId);
      return index < 0 ? nodes : nodes.slice(0, index);
    });
    const configId = placed.find(part => part.id === selectedId);
    if (configId) {
      setScissorRopes((ropes) => ropes.filter(rope => !ropeUsesGadget(rope, placedConfigId(configId))));
      setConnections(items => items.filter(item => item.sourceId !== placedConfigId(configId) && item.targetId !== placedConfigId(configId)));
    }
    setSelectedId(null);
    setPendingScissor(null);
  };
  const rotateSelected = (direction: -1 | 1) => setPlaced((items) => items.map((part) => part.id === selectedId ? { ...part, rotation: part.rotation + direction * Math.PI / 12 } : part));

  const ropeAnalysis = analyzePulleyRoute(ropePath.map((node) => node.kind === "anchor" ? "anchor" : routeKindForPart(placed.find((part) => part.id === node.placedId)?.type ?? "rope")).filter((kind): kind is PulleyRouteKind => kind !== null));
  const tip = selected === "rope" && !!level.loadRope
    ? ropePath.length ? ropeAnalysis.tensioned ? "Festpunkt und Kugel bilden die beiden gespannten Enden. Weitere Punkte öffnen den Verlauf wieder." : "Klicke weitere Anschlüsse oder starte auch mit offenen Enden." : "Beginne an einem beliebigen grünen Anschluss – der Festpunkt ist optional."
    : selected === "rope" && !level.loadRope
      ? pendingScissor === null ? "Griff oder Riegel anklicken, bei Bedarf über Rollen führen, dann am Zugpunkt befestigen. Zum Entfernen das Seil auswählen und ENTFERNEN drücken." : "Klicke weitere Rollen oder schließe am Wippenende, Ballon oder einer Kugel ab. Esc bricht ab."
      : selected === "wire" || selected === "belt" ? pendingConnection ? "Klicke den zweiten passenden Anschluss. Esc bricht ab." : selected === "wire" ? "Klicke STROM am Generator und dann STECKDOSE am Verbraucher." : "Verbinde zwei grüne ANTRIEB-Anschlüsse. Am Laufband kannst du beide Räder wählen."
        : selectedRope || selectedConnection ? "Verbindung ausgewählt. ENTFERNEN gibt sie ins Inventar zurück." : level.hint;

  const remaining = (entry: InventoryEntry) => {
    return remainingInventory(entry, level, placed, connections, scissorRopes, ropePath.length > 0);
  };

  const win = useCallback(() => {
    setWon(true);
    if (onExitTest) return;
    setScore((oldScore) => {
      const nextScore = oldScore + Math.max(500, 1800 - placed.length * 120);
      const nextBoard = [...readScores(), { name, score: nextScore }].sort((a, b) => b.score - a.score).slice(0, 10);
      localStorage.setItem("machine-scores", JSON.stringify(nextBoard));
      setScores(nextBoard);
      return nextScore;
    });
  }, [name, placed.length, onExitTest]);

  const applyEditedLevel = (editedLevel: LevelDefinition) => {
    setCustomLevel(editedLevel);
    setLevel(editedLevel);
    setSelected(editedLevel.inventory[0]?.type ?? null);
    clearAttempt(editedLevel);
  };

  if (!name) return <LoginScreen draft={draft} onDraftChange={setDraft} onLogin={login} />;
  if (showEditor) return <LevelEditor level={{ ...level, controlRopes: scissorRopes }} savedLevel={editorDraft} placed={placed} connections={connections} onApply={applyEditedLevel} onClose={draft => { setEditorDraft(draft); setShowEditor(false); }} renderTest={(testLevel, close) => <GameApp initialLevel={testLevel} onExitTest={close} />} />;

  const nextLevel = availableLevels[levelPosition] ?? null;

  return (
    <main className="game-shell">
      {onExitTest && <div className="playtest-banner"><b>LEVEL-TEST</b><span>Baue mit dem Spielerinventar und starte die Maschine.</span><button onClick={onExitTest}>← Zurück zum Editor</button></div>}
      {folderName && <div className="folder-banner">Levelordner: <b>{folderName}</b> · {levelPosition} / {availableLevels.length}</div>}
      <GameHeader score={score} playerName={name} levelNumber={level.number} levelCount={availableLevels.length} onScores={() => { setScores(readScores()); setShowScores(true); }} onLevels={() => setShowLevels(true)} onLogout={() => { localStorage.removeItem("machine-user"); setName(""); }} />
      <MissionPanel level={level} />
      <div className="workspace">
        <section className="board-wrap">
          <div className="board" onPointerDown={boardPointerDown} onPointerMove={boardPointerMove} onPointerUp={() => { setDrag(null); transformDrag.current = null; }} onPointerCancel={() => { setDrag(null); if (transformDrag.current) { const before = transformDrag.current.before; setPlaced(items => items.map(item => item.id === before.id ? before : item)); transformDrag.current = null; } }}>
            <GameCanvas level={level} placed={placed} ropePath={ropePath} scissorRopes={scissorRopes} pendingScissor={pendingScissor} ropeMode={selected === "rope"} selectedTool={selected} selectedId={selectedId} connections={connections} selectedConnection={selectedConnection} pendingConnection={pendingConnection ? gadgetPortKey(pendingConnection) : null} selectedRope={selectedRope} running={running} attempt={attempt} onWin={win} />
            <GoalOverlay goal={level.goal} />
            {selectedPlaced && !running && <GadgetSelection gadget={{ ...selectedPlaced, id: placedConfigId(selectedPlaced) }} />}
            {!running && placed.length === 0 && level.scene !== "rocket-parade" && <div className="board-tip">{level.buildTip}</div>}
          </div>
          <div className="motto">ERFINDEN · VERBESSERN · VERSTEHEN</div>
        </section>
        {won ? <aside className="win" aria-label="Level geschafft"><span aria-hidden="true">★</span><h2>Es funktioniert!</h2><p role="status">{level.successText}</p>{nextLevel ? <button onClick={() => changeLevel(nextLevel)}>Nächstes Level →</button> : <button onClick={reset}>Noch einmal bauen ↻</button>}</aside> : <PartsPanel inventory={level.inventory} selected={selected} running={running} tip={tip} remaining={remaining} onSelect={type => { setSelected(type); setPendingScissor(null); setPendingConnection(null); }} />}
      </div>
      <GameToolbar attempt={attempt} running={running} canRemove={selectedId !== null || selectedRope !== null || selectedConnection !== null} canRotate={canRotate} canFlip={!!selectedPlaced && !!GADGET_CATALOG[selectedPlaced.type].flippable} onFlip={axis => setPlaced(items => items.map(part => part.id === selectedId ? { ...part, [axis]: !part[axis] } : part))} onReset={reset} onRemove={removeSelected} onRotateLeft={() => rotateSelected(-1)} onRotateRight={() => rotateSelected(1)} onToggleMachine={() => { if (!running) setAttempt((value) => value + 1); setWon(false); setRunning((value) => !value); }} onPhysics={() => setShowPhysics(true)} onEditor={() => { if (onExitTest) onExitTest(); else { setRunning(false); setShowEditor(true); } }} onLevels={() => setShowLevels(true)} levelNumber={level.number} levelCount={availableLevels.length} />
      {showScores && <ScoreDialog scores={scores} onClose={() => setShowScores(false)} />}
      {showLevels && <LevelSelectDialog levels={availableLevels} current={level} customLevelId={customLevel?.id} onSelect={changeLevel} onClose={() => setShowLevels(false)} folderName={folderName} onLoadFolder={onExitTest ? undefined : (levels, folder) => { setFolderLevels(levels); setFolderName(folder); setCustomLevel(null); changeLevel(levels[0]); }} onBuiltinLevels={onExitTest ? undefined : () => { setFolderLevels(null); setFolderName(null); setCustomLevel(null); changeLevel(LEVELS[0]); }} />}
      {showPhysics && <PhysicsHandbook onClose={() => setShowPhysics(false)} />}
    </main>
  );
}
