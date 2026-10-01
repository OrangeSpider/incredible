import { useState } from "react";
import { GADGET_CATALOG } from "@/engine/gadget-catalog";
import type { ComposableGoalSpec, GadgetType, GoalSelector, GoalSpec, LevelDefinition } from "@/engine/types";
import { combineGoals, exitGoal, goalList, STATE_LABELS } from "@/levels/authoring";

export function describeGoal(goal: GoalSpec, level: LevelDefinition): string {
  if (!("kind" in goal)) return "Bestehendes Signalziel";
  const name = (selector: GoalSelector) => {
    const gadget = [...level.fixedGadgets, ...(level.initialPlacements ?? [])].find(item => item.id === selector.id);
    return gadget ? `${GADGET_CATALOG[gadget.type].displayName} (${gadget.id})` : selector.type ? `${GADGET_CATALOG[selector.type].displayName}${selector.tag === "player-part" ? " aus Spielerinventar" : ""}` : selector.id ?? selector.role ?? selector.tag ?? "Bauteil";
  };
  if (goal.kind === "state") return `${name(goal.selector)}: ${STATE_LABELS[goal.state] ?? goal.state}`;
  if (goal.kind === "motion") return `${name(goal.selector)} bewegt sich (Tempo ≥ ${goal.minimumSpeed})`;
  if (goal.kind === "area") return `${name(goal.selector)} im Zielbereich (${Math.round(goal.x)}, ${Math.round(goal.y)}; ${Math.round(goal.width)} × ${Math.round(goal.height)})`;
  if (goal.kind === "position") return `${name(goal.selector)}: ${goal.axis} ${goal.operator === "above" ? ">" : goal.operator === "below" ? "<" : goal.operator} ${goal.value}`;
  if (goal.kind === "all" || goal.kind === "any") return `${goal.kind === "all" ? "Alle" : "Eines der"} ${goal.goals.length} Teilziele`;
  if (goal.kind === "signal" || goal.kind === "event") return `Ereignis: ${goal.name}`;
  return `Bestehendes Ziel: ${goal.kind}`;
}

type Props = { level: LevelDefinition; selectedId: string | null; onChange: (level: LevelDefinition) => void;
  onDrawArea: (selector: GoalSelector) => void; drawing: boolean };

export default function GoalEditor({ level, selectedId, onChange, onDrawArea, drawing }: Props) {
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<"state" | "motion" | "exit" | "area">("state");
  const [state, setState] = useState("");
  const [side, setSide] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const [minimumSpeed, setMinimumSpeed] = useState(0.5);
  const gadgets = [...level.fixedGadgets, ...(level.initialPlacements ?? [])];
  const effectiveTarget = target || (selectedId ? `id:${selectedId}` : gadgets[0] ? `id:${gadgets[0].id}` : level.inventory[0] ? `player:${level.inventory[0].type}` : "");
  const targetGadget = gadgets.find(gadget => `id:${gadget.id}` === effectiveTarget);
  const type = targetGadget?.type ?? (effectiveTarget.startsWith("player:") ? effectiveTarget.slice(7) as GadgetType : undefined);
  const states = type ? Object.keys(GADGET_CATALOG[type].animations) : [];
  const effectiveState = states.includes(state) ? state : states[0] ?? "idle";
  const selector: GoalSelector = targetGadget ? { id: targetGadget.id } : { type, tag: "player-part" };
  const goals = goalList(level.goal);
  const mode = "kind" in level.goal && level.goal.kind === "any" ? "any" : "all";
  const add = () => {
    if (!type) return;
    if (kind === "area") { onDrawArea(selector); return; }
    const goal: ComposableGoalSpec = kind === "state" ? { kind, selector, state: effectiveState }
      : kind === "motion" ? { kind, selector, minimumSpeed }
      : exitGoal(selector, side);
    onChange({ ...level, schemaVersion: 2, floor: kind === "exit" && side === "bottom" ? false : level.floor, goal: combineGoals([...goals, goal], mode) });
  };
  return <section className="goal-editor" aria-label="Ziele definieren">
    <h3>Goal · Ziele definieren</h3>
    <p>Klicke ein gesetztes Bauteil an oder wähle ein Bauteil aus dem Spielerinventar. Mindestens ein passendes Objekt muss das jeweilige Ziel erfüllen.</p>
    <label>Zielobjekt<select value={effectiveTarget} onChange={event => { setTarget(event.target.value); setState(""); }}>
      {!effectiveTarget && <option value="">Erst Bauteile hinzufügen</option>}
      <optgroup label="Gesetzte Bauteile">{gadgets.map(gadget => <option key={gadget.id} value={`id:${gadget.id}`}>{GADGET_CATALOG[gadget.type].displayName} · {gadget.id}</option>)}</optgroup>
      <optgroup label="Frei platzierbare Spielerbauteile">{level.inventory.map(entry => <option key={entry.type} value={`player:${entry.type}`}>{GADGET_CATALOG[entry.type].displayName} · Spielerinventar</option>)}</optgroup>
    </select></label>
    {selectedId && target && <button onClick={() => setTarget("")}>Angeklicktes Bauteil verwenden</button>}
    <label>Zielart<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
      <option value="state">Zustand erreichen</option><option value="motion">Bewegt sich</option><option value="exit">Spielfeld verlassen</option><option value="area">Zielbereich erreichen</option>
    </select></label>
    {kind === "state" && <label>Zielstatus<select value={effectiveState} onChange={event => setState(event.target.value)}>{states.map(value => <option key={value} value={value}>{STATE_LABELS[value] ?? value}</option>)}</select></label>}
    {kind === "motion" && <label>Mindesttempo<input type="number" min="0.1" step="0.1" value={minimumSpeed} onChange={event => setMinimumSpeed(Math.max(0.1, Number(event.target.value)))} /></label>}
    {kind === "exit" && <label>Ausgang<select value={side} onChange={event => setSide(event.target.value as typeof side)}><option value="top">Oben</option><option value="bottom">Unten (Boden wird ausgeschaltet)</option><option value="left">Links</option><option value="right">Rechts</option></select></label>}
    <button disabled={!type || drawing} onClick={add}>{kind === "area" ? "Zielbereich aufziehen" : "Ziel hinzufügen"}</button>
    {drawing && <p role="status">Ziehe ein Rechteck auf dem Spielfeld. Esc bricht ab.</p>}
    {goals.length > 1 && <label>Verknüpfung<select value={mode} onChange={event => onChange({ ...level, schemaVersion: 2, goal: combineGoals(goals, event.target.value as "all" | "any") })}><option value="all">Alle Ziele müssen gleichzeitig erfüllt sein</option><option value="any">Ein Ziel genügt</option></select></label>}
    <ol>{goals.map((goal, index) => <li key={index}><span>{describeGoal(goal, level)}</span><button aria-label={`Ziel ${index + 1} löschen`} onClick={() => onChange({ ...level, schemaVersion: 2, goal: combineGoals(goals.filter((_, i) => i !== index), mode) })}>×</button></li>)}</ol>
    {!goals.length && <p>Noch kein Ziel definiert.</p>}
  </section>;
}
