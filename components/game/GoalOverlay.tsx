import type { ComposableGoalSpec, GoalSpec } from "@/engine/types";

function areas(goal: GoalSpec): Extract<ComposableGoalSpec, { kind: "area" }>[] {
  if (!("kind" in goal)) return [];
  if (goal.kind === "area") return [goal];
  if (goal.kind === "all" || goal.kind === "any") return goal.goals.flatMap(areas);
  if (goal.kind === "never") return [...areas(goal.goal), ...(goal.until ? areas(goal.until) : [])];
  return [];
}
export default function GoalOverlay({ goal }: { goal: GoalSpec }) {
  return <svg className="goal-overlay" viewBox="0 0 900 520" aria-label="Zielbereiche">{areas(goal).map((area, index) => <g key={index}><rect x={area.x} y={area.y} width={area.width} height={area.height} /><text x={area.x + 6} y={area.y + 16}>ZIEL {index + 1}</text></g>)}</svg>;
}
