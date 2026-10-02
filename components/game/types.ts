import type { GadgetInstanceConfig, PlaceableGadgetType } from "@/engine/types";

export type PlacedGadget = {
  flipX?: boolean;
  flipY?: boolean;
  id: number;
  configId?: string;
  collisionLabel?: string;
  type: PlaceableGadgetType;
  x: number;
  y: number;
  rotation: number;
  physics?: GadgetInstanceConfig["physics"];
  properties?: GadgetInstanceConfig["properties"];
  role?: string;
  tags?: string[];
  state?: string;
};

export const placedConfigId = (gadget: PlacedGadget) => gadget.configId ?? `placed-${gadget.id}`;

export type RopeNode =
  | { kind: "anchor" }
  | { kind: "part"; placedId: number };

export type { ControlRope as ScissorRope } from "@/game/control-ropes";
