import { GADGET_CATALOG } from "../engine/gadget-catalog.ts";
import { inversePoint } from "../engine/gadget-geometry.ts";
import type { ComposableGoalSpec, GadgetInstanceConfig, GadgetType, GoalSelector, GoalSpec, LevelDefinition } from "../engine/types.ts";

export const BOARD_WIDTH = 900;
export const BOARD_HEIGHT = 520;
export const UNSET_GOAL: Extract<ComposableGoalSpec,{kind:"signal"}> = { kind: "signal", name: "editor.goal.unset" };

export function newLevel(number = 1): LevelDefinition {
  return {
    schemaVersion: 2, id: `level-${Date.now().toString(36)}`, number, scene: "custom",
    title: "Neues Level", objective: "Definiere das Ziel deiner Maschine.", hint: "Baue deine Maschine und starte sie.",
    buildTip: "Wähle rechts ein Bauteil und platziere es auf dem Spielfeld.", successText: "Deine Maschine hat das Ziel erreicht!",
    inventory: [], fixedGadgets: [], initialPlacements: [], connections: [],
    floor: true, goal: structuredClone(UNSET_GOAL),
  };
}

export function goalList(goal: GoalSpec): GoalSpec[] {
  if ("kind" in goal && goal.kind === "signal" && goal.name === UNSET_GOAL.name) return [];
  return "kind" in goal && (goal.kind === "all" || goal.kind === "any") ? goal.goals : [goal];
}

export function combineGoals(goals: GoalSpec[], mode: "all" | "any" = "all"): ComposableGoalSpec {
  if (!goals.length) return structuredClone(UNSET_GOAL);
  return goals.length === 1 ? goals[0] : { kind: mode, goals: goals };
}

export function exitGoal(selector: GoalSelector, side: "top" | "bottom" | "left" | "right"): ComposableGoalSpec {
  return { kind: "position", selector, axis: side === "left" || side === "right" ? "x" : "y",
    operator: side === "left" || side === "top" ? "below" : "above",
    value: side === "left" || side === "top" ? 0 : side === "right" ? BOARD_WIDTH : BOARD_HEIGHT };
}

export function rectangleGoal(selector: GoalSelector, start: { x: number; y: number }, end: { x: number; y: number }): ComposableGoalSpec {
  return { kind: "area", selector, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) };
}

function references(goal: ComposableGoalSpec, id: string): boolean {
  if (goal.kind === "all" || goal.kind === "any") return goal.goals.some(child => references(child, id));
  if (goal.kind === "never") return references(goal.goal, id) || (!!goal.until && references(goal.until, id));
  return ["selector", "source", "target", "entity", "zone"].some(key => (goal as unknown as Record<string, GoalSelector>)[key]?.id === id);
}

export function removeGadget(level: LevelDefinition, id: string): LevelDefinition {
  const clearRelations=(gadget:GadgetInstanceConfig)=>{
    const properties={...gadget.properties};
    for (const key of ["balloon","fishId"]) if(properties[key]===id) delete properties[key];
    return {...gadget,properties};
  };
  const prune = (goal: ComposableGoalSpec): ComposableGoalSpec | null => {
    if (goal.kind === "all" || goal.kind === "any") {
      const children = goal.goals.map(prune).filter((child): child is ComposableGoalSpec => child !== null);
      return children.length ? combineGoals(children, goal.kind) : null;
    }
    return references(goal, id) ? null : goal;
  };
  return { ...level,
    animalChases:level.animalChases?.filter(flow=>![flow.catId,flow.mouseId,flow.exitId,flow.gateId].includes(id)),
    catapults:level.catapults?.filter(flow=>![flow.catId,flow.mouseId,flow.seesawId,flow.platformId,flow.exitId].includes(id)),
    fishChases:level.fishChases?.filter(flow=>![flow.catId,flow.fishId].includes(id)),
    seesawLaunches:level.seesawLaunches?.filter(flow=>![flow.impactId,flow.triggerId].includes(id)),
    loadRope:level.loadRope?.weightId===id?undefined:level.loadRope,
    fixedGadgets: level.fixedGadgets.filter(gadget => gadget.id !== id).map(clearRelations),
    initialPlacements: (level.initialPlacements ?? []).filter(gadget => gadget.id !== id).map(clearRelations),
    connections: (level.connections ?? []).filter(connection => connection.sourceId !== id && connection.targetId !== id),
    controlRopes: (level.controlRopes ?? []).filter(rope => rope.targetId !== id && rope.source.gadgetId !== id && !rope.guides.some(guide=>guide.gadgetId===id)),
    goal: "kind" in level.goal ? prune(level.goal) ?? structuredClone(UNSET_GOAL) : level.goal };
}

export function updateGadget(level: LevelDefinition, id: string, update: Partial<GadgetInstanceConfig>): LevelDefinition {
  const edit = (gadgets: GadgetInstanceConfig[]) => gadgets.map(gadget => gadget.id === id ? { ...gadget, ...update } : gadget);
  return { ...level, fixedGadgets: edit(level.fixedGadgets), initialPlacements: edit(level.initialPlacements ?? []) };
}

export type GadgetPositionMode = "fixed" | "gravity";

export function gadgetPositionMode(gadget: GadgetInstanceConfig): GadgetPositionMode {
  // A pivot keeps the gadget's position fixed while still allowing it to rotate.
  // Reporting its dynamic body as gravity-driven is therefore misleading in the editor.
  if (GADGET_CATALOG[gadget.type].joint?.kind === "pivot") return "fixed";
  const physics = { ...GADGET_CATALOG[gadget.type].physics, ...gadget.physics };
  return !physics.isStatic && physics.gravityScale > 0 ? "gravity" : "fixed";
}

export function setGadgetPositionMode(level: LevelDefinition, id: string, mode: GadgetPositionMode): LevelDefinition {
  const edit = (gadgets: GadgetInstanceConfig[]) => gadgets.map(gadget => {
    if (gadget.id !== id) return gadget;
    // Pivot-mounted gadgets cannot become free-falling without removing their joint,
    // which is not an instance-level editor option.
    if (GADGET_CATALOG[gadget.type].joint?.kind === "pivot") return gadget;
    const defaults = GADGET_CATALOG[gadget.type].physics;
    const effective = { ...defaults, ...gadget.physics };
    const physics = {
      ...gadget.physics,
      isStatic: mode === "fixed",
      gravityScale: mode === "fixed" ? 0 : defaults.gravityScale > 0 ? defaults.gravityScale : 1,
    };
    // Sensor bodies detect overlap but cannot land on surfaces. Give them their
    // visible circular/rectangular footprint while gravity is enabled.
    if (mode === "gravity" && effective.shape === "sensor") {
      physics.shape = effective.radius !== undefined ? "circle" : "rectangle";
      physics.isSensor = false;
    } else if (mode === "fixed" && defaults.shape === "sensor") {
      physics.shape = "sensor";
      physics.isSensor = defaults.isSensor;
    }
    return { ...gadget, physics };
  });
  return { ...level, fixedGadgets: edit(level.fixedGadgets), initialPlacements: edit(level.initialPlacements ?? []) };
}

export function hitGadget(gadgets: GadgetInstanceConfig[], point: { x: number; y: number }): GadgetInstanceConfig | undefined {
  return [...gadgets].reverse().find(gadget => {
    const physics = { ...GADGET_CATALOG[gadget.type].physics, ...gadget.physics };
    const { x, y } = inversePoint(gadget, point);
    return physics.radius !== undefined ? Math.hypot(x, y) <= Math.max(18, physics.radius)
      : Math.abs(x) <= Math.max(18, (physics.width ?? 50) / 2) && Math.abs(y) <= Math.max(18, (physics.height ?? 50) / 2);
  });
}

export type LevelHistory = { past: LevelDefinition[]; present: LevelDefinition; future: LevelDefinition[] };
export function remember(history: LevelHistory, next: LevelDefinition): LevelHistory {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return { past: [...history.past.slice(-99), history.present], present: next, future: [] };
}
export function undo(history: LevelHistory): LevelHistory {
  const previous = history.past.at(-1);
  return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] } : history;
}
export function redo(history: LevelHistory): LevelHistory {
  const next = history.future[0];
  return next ? { past: [...history.past, history.present], present: next, future: history.future.slice(1) } : history;
}

export const STATE_LABELS: Record<string, string> = {
  idle: "In Ruhe", off: "Aus", on: "Eingeschaltet", running: "Läuft", burning: "Brennt", extinguished: "Erloschen",
  unlit: "Unangezündet", waiting: "Wartet", slack: "Lose", taut: "Gespannt", full: "Voll", pouring: "Gießt aus", empty: "Leer", splashing: "Spritzt",
  popped: "Geplatzt", free: "Frei", tethered: "Angebunden", open: "Offen", closed: "Geschlossen", intact: "Intakt",
  breaking: "Zerbricht", broken: "Zerbrochen", flopping: "Zappelt", falling: "Fällt", startled: "Erschrocken",
  mounted: "Startbereit", launching: "Startet", launched: "Gestartet", fuseBurning: "Lunte brennt", firing: "Feuert", burned: "Abgebrannt",
  exploded: "Explodiert", ready: "Bereit", spent: "Ausgelöst", focusing: "Bündelt Licht", flowing: "Fließt", flying: "Fliegt", hidden: "Versteckt",
};
export function gadgetName(type: GadgetType) { return GADGET_CATALOG[type].displayName; }
