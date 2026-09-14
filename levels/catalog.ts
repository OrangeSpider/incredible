import level01 from "./level-01.json" with { type: "json" };
import level02 from "./level-02.json" with { type: "json" };
import level03 from "./level-03.json" with { type: "json" };
import level04 from "./level-04.json" with { type: "json" };
import level05 from "./level-05.json" with { type: "json" };
import level06 from "./level-06.json" with { type: "json" };
import level07 from "./level-07.json" with { type: "json" };
import level08 from "./level-08.json" with { type: "json" };
import level09 from "./level-09.json" with { type: "json" };
import level10 from "./level-10.json" with { type: "json" };
import level11 from "./level-11.json" with { type: "json" };
import level12 from "./level-12.json" with { type: "json" };
import level13 from "./level-13.json" with { type: "json" };
import level14 from "./level-14.json" with { type: "json" };
import level15 from "./level-15.json" with { type: "json" };
import {GADGET_CATALOG} from "../engine/gadget-catalog.ts";
import type {LevelDefinition,PlaceableGadgetType} from "../engine/types.ts";

const rawLevels=[level01,level02,level03,level04,level05,level06,level07,level08,level09,level10,level11,level12,level13,level14,level15];

export function validateLevel(value:unknown):LevelDefinition{
  if(!value||typeof value!=="object")throw new Error("Level JSON must be an object");
  const level=value as Partial<LevelDefinition>;
  if(level.schemaVersion!==1)throw new Error("Unsupported level schemaVersion");
  if(!level.id||!level.scene||!level.title||!level.objective)throw new Error("Level needs id, scene, title and objective");
  if(!Number.isInteger(level.number)||Number(level.number)<1)throw new Error("Level number must be a positive integer");
  if(!Array.isArray(level.inventory)||!Array.isArray(level.fixedGadgets)||!Array.isArray(level.systems))throw new Error("Level needs inventory, fixedGadgets and systems arrays");
  const ids=new Set<string>();
  for(const gadget of level.fixedGadgets){if(!GADGET_CATALOG[gadget.type])throw new Error(`Unknown gadget type: ${gadget.type}`);if(ids.has(gadget.id))throw new Error(`Duplicate gadget id: ${gadget.id}`);ids.add(gadget.id)}
  if(level.initialPlacements!==undefined&&!Array.isArray(level.initialPlacements))throw new Error("initialPlacements must be an array");
  for(const gadget of level.initialPlacements??[]){const definition=GADGET_CATALOG[gadget.type];if(!definition)throw new Error(`Unknown initial gadget type: ${gadget.type}`);if(!definition.removable)throw new Error(`Initial gadget must be placeable: ${gadget.type}`);if(ids.has(gadget.id))throw new Error(`Duplicate gadget id: ${gadget.id}`);ids.add(gadget.id)}
  for(const item of level.inventory){if(!GADGET_CATALOG[item.type as PlaceableGadgetType])throw new Error(`Unknown inventory type: ${item.type}`);if(!Number.isInteger(item.count)||item.count<1)throw new Error(`Invalid inventory count for ${item.type}`)}
  if(!level.goal||!level.goal.mode)throw new Error("Level needs a goal specification");
  return structuredClone(level as LevelDefinition);
}

export const LEVELS:LevelDefinition[]=rawLevels.map(validateLevel).sort((a,b)=>a.number-b.number);
export const LEVEL_BY_ID=new Map(LEVELS.map(level=>[level.id,level]));
export const getLevel=(index:number)=>LEVELS[index]??LEVELS[0];
