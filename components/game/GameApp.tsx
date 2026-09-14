"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { GADGET_CATALOG } from "@/engine/gadget-catalog";
import type { InventoryEntry, LevelDefinition, PlaceableGadgetType } from "@/engine/types";
import { LEVELS } from "@/levels/catalog";
import { analyzePulleyRoute, type PulleyRouteKind } from "@/game/pulley";
import { SCISSOR_LAYOUT, scissorPullPoint } from "@/game/scissors";
import { conveyorWheelCenters } from "@/game/drive";
import GameCanvas, { routeKindForPart } from "./GameCanvas";
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

const ROPE_ANCHOR = { x: 92, y: 64 };

function initialPlacements(level: LevelDefinition): PlacedGadget[] {
  return (level.initialPlacements ?? []).map((gadget, index) => ({
    id: -(index + 1),
    type: gadget.type as PlaceableGadgetType,
    x: gadget.x,
    y: gadget.y,
    rotation: gadget.rotation ?? 0,
  }));
}

function readScores(): ScoreEntry[] {
  try { return JSON.parse(localStorage.getItem("machine-scores") || "[]") as ScoreEntry[]; }
  catch { return []; }
}

function defaultRotation(type: PlaceableGadgetType) {
  return GADGET_CATALOG[type].defaultRotation ?? 0;
}

function driveBeltMarker(level: LevelDefinition) {
  const source = level.fixedGadgets.find((gadget) => gadget.role === "drive");
  const conveyor = level.fixedGadgets.find((gadget) => gadget.type === "conveyor");
  if (!source || !conveyor) return null;
  const width = Number(conveyor.physics?.width ?? GADGET_CATALOG.conveyor.physics.width ?? 270);
  const [target] = conveyorWheelCenters(conveyor.x, conveyor.y, width);
  const sourcePort = { x: source.x + 55, y: source.y + 13 };
  return { x: (sourcePort.x + target.x) / 2, y: (sourcePort.y + target.y) / 2 };
}

export default function GameApp() {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState<LevelDefinition>(LEVELS[0]);
  const [customLevel, setCustomLevel] = useState<LevelDefinition | null>(null);
  const [selected, setSelected] = useState<PlaceableGadgetType | null>(LEVELS[0].inventory[0]?.type ?? null);
  const [placed, setPlaced] = useState<PlacedGadget[]>(() => initialPlacements(LEVELS[0]));
  const [ropePath, setRopePath] = useState<RopeNode[]>([]);
  const [scissorRopes, setScissorRopes] = useState<ScissorRope[]>([]);
  const [pendingScissor, setPendingScissor] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [showScores, setShowScores] = useState(false);
  const [showPhysics, setShowPhysics] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setName(localStorage.getItem("machine-user") || ""), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const availableLevels = useMemo(() => {
    if (!customLevel) return LEVELS;
    const withoutSameId = LEVELS.filter((item) => item.id !== customLevel.id);
    return [...withoutSameId, customLevel].sort((a, b) => a.number - b.number);
  }, [customLevel]);
  const levelPosition = Math.max(0, availableLevels.indexOf(level)) + 1;

  const clearAttempt = (nextLevel: LevelDefinition, bumpAttempt = false) => {
    setRunning(false);
    setPlaced(initialPlacements(nextLevel));
    setRopePath([]);
    setScissorRopes([]);
    setPendingScissor(null);
    setSelectedId(null);
    setWon(false);
    setAttempt((value) => bumpAttempt ? value + 1 : 0);
  };

  const changeLevel = (nextLevel: LevelDefinition) => {
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
    if (running || !selected) return;
    const point = boardPoint(event);

    if (selected === "rope" && level.systems.includes("scissors")) {
      const ropeLimit = level.inventory.find((entry) => entry.type === "rope")?.count ?? 0;
      if (scissorRopes.length >= ropeLimit) return;
      if (pendingScissor === null) {
        const candidate = SCISSOR_LAYOUT
          .map((_, index) => ({ index, point: scissorPullPoint(index) }))
          .filter((entry) => !scissorRopes.some((rope) => rope.scissorIndex === entry.index))
          .map((entry) => ({ ...entry, distance: Math.hypot(entry.point.x - point.x, entry.point.y - point.y) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (candidate && candidate.distance < 48) setPendingScissor(candidate.index);
      } else {
        const pull = placed
          .filter((part) => part.type === "ball" || part.type === "tennisBall")
          .map((part) => ({ ...part, distance: Math.hypot(part.x - point.x, part.y - point.y) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (pull && pull.distance < 52) {
          setScissorRopes((ropes) => [...ropes, { scissorIndex: pendingScissor, placedId: pull.id }]);
          setPendingScissor(null);
        }
      }
      return;
    }

    if (selected === "rope" && level.systems.includes("pulley-rope")) {
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

    const movable = placed
      .map((part) => ({ ...part, distance: Math.hypot(part.x - point.x, part.y - point.y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (movable && movable.distance < 52) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedId(movable.id);
      setDrag({ id: movable.id, dx: movable.x - point.x, dy: movable.y - point.y });
      return;
    }

    const allowed = level.inventory.find((entry) => entry.type === selected);
    if (!allowed || selected === "rope") return;
    if (placed.filter((part) => part.type === selected).length >= allowed.count) return;
    const id = Math.round(performance.now() * 1000);
    setSelectedId(id);
    const connectorPoint = selected === "belt" ? driveBeltMarker(level) : null;
    setPlaced((items) => [...items, { id, type: selected, x: connectorPoint?.x ?? point.x, y: connectorPoint?.y ?? point.y, rotation: defaultRotation(selected) }]);
  };

  const boardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || running) return;
    const point = boardPoint(event);
    setPlaced((items) => items.map((part) => part.id === drag.id ? {
      ...part,
      x: Math.max(25, Math.min(875, point.x + drag.dx)),
      y: Math.max(25, Math.min(475, point.y + drag.dy)),
    } : part));
  };

  const selectedPlaced = placed.find((part) => part.id === selectedId);
  const canRotate = Boolean(selectedPlaced && GADGET_CATALOG[selectedPlaced.type].rotatable);
  const removeSelected = () => {
    if (selectedId === null) return;
    setPlaced((items) => items.filter((part) => part.id !== selectedId));
    setRopePath((nodes) => {
      const index = nodes.findIndex((node) => node.kind === "part" && node.placedId === selectedId);
      return index < 0 ? nodes : nodes.slice(0, index);
    });
    setScissorRopes((ropes) => ropes.filter((rope) => rope.placedId !== selectedId));
    setSelectedId(null);
  };
  const rotateSelected = (direction: -1 | 1) => setPlaced((items) => items.map((part) => part.id === selectedId ? { ...part, rotation: part.rotation + direction * Math.PI / 12 } : part));

  const ropeAnalysis = analyzePulleyRoute(ropePath.map((node) => node.kind === "anchor" ? "anchor" : routeKindForPart(placed.find((part) => part.id === node.placedId)?.type ?? "rope")).filter((kind): kind is PulleyRouteKind => kind !== null));
  const tip = selected === "rope" && level.systems.includes("pulley-rope")
    ? ropePath.length ? ropeAnalysis.tensioned ? "Festpunkt und Kugel bilden die beiden gespannten Enden. Weitere Punkte öffnen den Verlauf wieder." : "Klicke weitere Anschlüsse oder starte auch mit offenen Enden." : "Beginne an einem beliebigen grünen Anschluss – der Festpunkt ist optional."
    : selected === "rope" && level.systems.includes("scissors")
      ? pendingScissor === null ? "Klicke einen grünen Scherengriff." : "Der Griff ist gewählt. Klicke jetzt eine Bowlingkugel oder den Tennisball."
      : selected === "belt" && level.systems.includes("belt-drive")
        ? placed.some((part) => part.type === "belt") ? "Der Riemen liegt geschlossen um Louis' Antriebsrad und das linke Laufbandrad." : "Klicke auf das Spielfeld: Der Riemen verbindet automatisch die beiden grün markierten Antriebsräder."
        : level.hint;

  const remaining = (entry: InventoryEntry) => {
    if (entry.type === "rope" && level.systems.includes("scissors")) return Math.max(0, entry.count - scissorRopes.length);
    if (entry.type === "rope" && level.systems.includes("pulley-rope")) return ropePath.length ? 0 : entry.count;
    return Math.max(0, entry.count - placed.filter((part) => part.type === entry.type).length);
  };

  const win = useCallback(() => {
    setWon(true);
    setScore((oldScore) => {
      const nextScore = oldScore + Math.max(500, 1800 - placed.length * 120);
      const nextBoard = [...readScores(), { name, score: nextScore }].sort((a, b) => b.score - a.score).slice(0, 10);
      localStorage.setItem("machine-scores", JSON.stringify(nextBoard));
      setScores(nextBoard);
      return nextScore;
    });
  }, [name, placed.length]);

  const applyEditedLevel = (editedLevel: LevelDefinition) => {
    setCustomLevel(editedLevel);
    setLevel(editedLevel);
    setSelected(editedLevel.inventory[0]?.type ?? null);
    clearAttempt(editedLevel);
  };

  if (!name) return <LoginScreen draft={draft} onDraftChange={setDraft} onLogin={login} />;

  const nextLevel = availableLevels[levelPosition] ?? null;
  const undoLabel = selected === "rope" && level.systems.includes("pulley-rope") ? "SEILPUNKT ZURÜCK" : selected === "rope" && level.systems.includes("scissors") ? "SEIL ZURÜCK" : undefined;
  const canUndo = level.systems.includes("pulley-rope") ? ropePath.length > 0 : pendingScissor !== null || scissorRopes.length > 0;
  const undo = () => {
    if (level.systems.includes("pulley-rope")) setRopePath((nodes) => nodes.slice(0, -1));
    else if (pendingScissor !== null) setPendingScissor(null);
    else setScissorRopes((ropes) => ropes.slice(0, -1));
  };

  return (
    <main className="game-shell">
      <GameHeader score={score} playerName={name} levelNumber={levelPosition} levelCount={availableLevels.length} onScores={() => { setScores(readScores()); setShowScores(true); }} onLevels={() => setShowLevels(true)} onLogout={() => { localStorage.removeItem("machine-user"); setName(""); }} />
      <MissionPanel level={level} />
      <div className="workspace">
        <section className="board-wrap">
          <div className="board" onPointerDown={boardPointerDown} onPointerMove={boardPointerMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
            <GameCanvas level={level} placed={placed} ropePath={ropePath} scissorRopes={scissorRopes} pendingScissor={pendingScissor} ropeMode={selected === "rope"} selectedTool={selected} selectedId={selectedId} running={running} attempt={attempt} onWin={win} />
            {!running && placed.length === 0 && level.scene !== "rocket-parade" && <div className="board-tip">{level.buildTip}</div>}
            {won && <div className="win"><span>★</span><h2>Es funktioniert!</h2><p>{level.successText}</p>{nextLevel ? <button onClick={() => changeLevel(nextLevel)}>Nächstes Level →</button> : <button onClick={reset}>Noch einmal bauen ↻</button>}</div>}
          </div>
          <div className="motto">ERFINDEN · VERBESSERN · VERSTEHEN</div>
        </section>
        <PartsPanel inventory={level.inventory} selected={selected} running={running} tip={tip} remaining={remaining} onSelect={setSelected} />
      </div>
      <GameToolbar attempt={attempt} running={running} canRemove={selectedId !== null} canRotate={canRotate} undoLabel={undoLabel} canUndo={canUndo} onUndo={undo} onReset={reset} onRemove={removeSelected} onRotateLeft={() => rotateSelected(-1)} onRotateRight={() => rotateSelected(1)} onToggleMachine={() => { if (!running) setAttempt((value) => value + 1); setRunning((value) => !value); }} onPhysics={() => setShowPhysics(true)} onEditor={() => setShowEditor(true)} onLevels={() => setShowLevels(true)} levelNumber={levelPosition} levelCount={availableLevels.length} />
      {showScores && <ScoreDialog scores={scores} onClose={() => setShowScores(false)} />}
      {showLevels && <LevelSelectDialog levels={availableLevels} current={level} customLevelId={customLevel?.id} onSelect={changeLevel} onClose={() => setShowLevels(false)} />}
      {showPhysics && <PhysicsHandbook onClose={() => setShowPhysics(false)} />}
      {showEditor && <LevelEditor level={level} placed={placed} onApply={applyEditedLevel} onClose={() => setShowEditor(false)} />}
    </main>
  );
}
