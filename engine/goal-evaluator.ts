import type { GoalSpec } from "./types.ts";

export type GoalContext = {
  signal: (name: string) => string | number | boolean | undefined;
};

function conditionMatches(condition: NonNullable<GoalSpec["conditions"]>[number], context: GoalContext) {
  const actual = context.signal(condition.signal);
  if (condition.operator === "occurred") return actual === true;
  if (condition.operator === "equals") return actual === condition.value;
  if (condition.operator === "above") return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
  if (condition.operator === "below") return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
  return false;
}

export function evaluateGoal(goal: GoalSpec, context: GoalContext) {
  if (goal.mode === "event") return Boolean(goal.event && context.signal(goal.event) === true);
  const results = (goal.conditions ?? []).map((condition) => conditionMatches(condition, context));
  if (!results.length) return false;
  return goal.mode === "any" ? results.some(Boolean) : results.every(Boolean);
}
