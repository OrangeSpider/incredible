import { GADGET_CATALOG } from "./gadget-catalog.ts";
import type { GadgetAnimation, GadgetType } from "./types.ts";

export type ResolvedAnimation = {
  state: string;
  definition: GadgetAnimation;
  frame: number;
  row: number;
  column: number;
};

/** Pure frame selection; changing state resets the clock in MachinePhysicsEngine. */
export function resolveGadgetAnimation(type: GadgetType, state: string, stateAgeMs: number): ResolvedAnimation {
  const gadget = GADGET_CATALOG[type];
  const resolvedState = gadget.animations[state] ? state : gadget.defaultState;
  const definition = gadget.animations[resolvedState];
  if (!definition) throw new Error(`No animation for ${type}.${resolvedState}`);
  const frames = Math.max(1, definition.frames ?? 1);
  const frameDurationMs = Math.max(1, definition.frameDurationMs ?? 100);
  const elapsedFrames = Math.floor(Math.max(0, stateAgeMs) / frameDurationMs);
  const frame = definition.loop === false
    ? Math.min(frames - 1, elapsedFrames)
    : elapsedFrames % frames;
  const columns = definition.kind === "sprite" ? definition.columns : 1;
  return {
    state: resolvedState,
    definition,
    frame,
    row: definition.kind === "sprite" ? definition.row + Math.floor(frame / columns) : 0,
    column: frame % columns,
  };
}
