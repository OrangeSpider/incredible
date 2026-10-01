import type { GadgetInstanceConfig, PlaceableGadgetType } from "@/engine/types";

export type PlacedGadget = {
  id: number;
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

export type RopeNode =
  | { kind: "anchor" }
  | { kind: "part"; placedId: number };

export type { ControlRope as ScissorRope } from "@/game/control-ropes";
