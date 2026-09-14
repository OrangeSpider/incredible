import type { PlaceableGadgetType } from "@/engine/types";

export type PlacedGadget = {
  id: number;
  type: PlaceableGadgetType;
  x: number;
  y: number;
  rotation: number;
};

export type RopeNode =
  | { kind: "anchor" }
  | { kind: "part"; placedId: number };

export type ScissorRope = {
  scissorIndex: number;
  placedId: number;
};
