import type { GadgetConnection, InventoryEntry, LevelDefinition } from "../../engine/types.ts";
import type { ControlRope } from "../../game/control-ropes.ts";
import type { PlacedGadget } from "./types.ts";

export function initialPlacements(level: LevelDefinition): PlacedGadget[] {
  return (level.initialPlacements ?? []).map((gadget, index) => ({
    ...gadget, id: -(index + 1), configId: gadget.id, rotation: gadget.rotation ?? 0,
  }));
}
export function initialConnections(level: LevelDefinition): GadgetConnection[] {
  return structuredClone(level.connections ?? []);
}
export function remainingInventory(entry: InventoryEntry, level: LevelDefinition, placed: PlacedGadget[], connections: GadgetConnection[], ropes: ControlRope[], hasPulleyRoute: boolean): number {
  if (entry.type === "wire" || entry.type === "belt")
    return Math.max(0, entry.count - connections.filter(connection => connection.kind === entry.type && !(level.connections ?? []).some(preset => preset.id === connection.id)).length);
  if (entry.type === "rope" && level.systems.includes("tension-rope"))
    return Math.max(0, entry.count - ropes.filter(rope => !(level.controlRopes ?? []).some(preset => preset.targetId === rope.targetId && preset.targetPortId === rope.targetPortId)).length);
  if (entry.type === "rope" && level.systems.includes("pulley-rope")) return hasPulleyRoute ? 0 : entry.count;
  return Math.max(0, entry.count - placed.filter(part => part.type === entry.type && !part.configId).length);
}
