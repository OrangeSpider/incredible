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
import {KNOWN_RUNTIME_SYSTEM_IDS} from "../game/runtime-system-ids.ts";
import type {ComposableGoalSpec,GoalSelector,LevelDefinition,PlaceableGadgetType} from "../engine/types.ts";

const rawLevels=[level01,level02,level03,level04,level05,level06,level07,level08,level09,level10,level11,level12,level13,level14,level15];

const isObject=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const nonempty=(value:unknown):value is string=>typeof value==="string"&&value.trim().length>0;
const finite=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);
const comparison=(value:unknown)=>["equals","above","below","atLeast","atMost"].includes(String(value));

function checkKeys(value:Record<string,unknown>,allowed:string[],path:string){
  for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error(`${path}: unknown field ${key}`);
}

function validateSelector(value:unknown,ids:Set<string>,path:string):asserts value is GoalSelector{
  if(!isObject(value))throw new Error(`${path}: selector must be an object`);
  checkKeys(value,["id","type","tag","role"],path);
  if(!Object.keys(value).length)throw new Error(`${path}: selector needs id, type, tag or role`);
  if(value.id!==undefined&&(!nonempty(value.id)||!ids.has(value.id)))throw new Error(`${path}: unknown gadget id ${String(value.id)}`);
  if(value.type!==undefined&&(!nonempty(value.type)||!GADGET_CATALOG[value.type as keyof typeof GADGET_CATALOG]))throw new Error(`${path}: unknown gadget type ${String(value.type)}`);
  if(value.tag!==undefined&&!nonempty(value.tag))throw new Error(`${path}: tag must be nonempty`);
  if(value.role!==undefined&&!nonempty(value.role))throw new Error(`${path}: role must be nonempty`);
}

function validateGoal(value:unknown,ids:Set<string>,path="goal",depth=0):asserts value is ComposableGoalSpec{
  if(depth>32)throw new Error(`${path}: goal nesting is too deep`);
  if(!isObject(value)||!nonempty(value.kind))throw new Error(`${path}: goal needs a kind`);
  switch(value.kind){
    case "signal":
      checkKeys(value,["kind","name","operator","value"],path);
      if(!nonempty(value.name))throw new Error(`${path}: signal name must be nonempty`);
      if(value.operator!==undefined&&!(["occurred","equals","above","below","atLeast","atMost"].includes(String(value.operator))))throw new Error(`${path}: invalid signal operator`);
      if(value.operator!==undefined&&value.operator!=="occurred"&&(value.value===undefined||typeof value.value==="object"))throw new Error(`${path}: signal comparison needs a primitive value`);
      if(["above","below","atLeast","atMost"].includes(String(value.operator))&&!finite(value.value))throw new Error(`${path}: numeric signal comparison needs a finite number`);
      return;
    case "event":
      checkKeys(value,["kind","name","source","target"],path);
      if(!nonempty(value.name))throw new Error(`${path}: event name must be nonempty`);
      if(value.source!==undefined)validateSelector(value.source,ids,`${path}.source`);
      if(value.target!==undefined)validateSelector(value.target,ids,`${path}.target`);
      return;
    case "state":
      checkKeys(value,["kind","selector","state"],path);
      validateSelector(value.selector,ids,`${path}.selector`);
      if(!nonempty(value.state))throw new Error(`${path}: state must be nonempty`);
      return;
    case "position":
      checkKeys(value,["kind","selector","axis","operator","value"],path);
      validateSelector(value.selector,ids,`${path}.selector`);
      if(value.axis!=="x"&&value.axis!=="y")throw new Error(`${path}: position axis must be x or y`);
      if(!comparison(value.operator)||!finite(value.value))throw new Error(`${path}: position needs a numeric comparison`);
      return;
    case "contact":
      checkKeys(value,["kind","source","target"],path);
      validateSelector(value.source,ids,`${path}.source`);
      validateSelector(value.target,ids,`${path}.target`);
      return;
    case "zone":
      checkKeys(value,["kind","entity","zone"],path);
      validateSelector(value.entity,ids,`${path}.entity`);
      validateSelector(value.zone,ids,`${path}.zone`);
      return;
    case "all":case "any":
      checkKeys(value,["kind","goals"],path);
      if(!Array.isArray(value.goals)||value.goals.length===0)throw new Error(`${path}: ${value.kind} needs at least one child goal`);
      value.goals.forEach((goal,index)=>validateGoal(goal,ids,`${path}.goals[${index}]`,depth+1));
      return;
    case "count":
      checkKeys(value,["kind","selector","where","operator","value"],path);
      validateSelector(value.selector,ids,`${path}.selector`);
      if(!["atLeast","atMost","exactly"].includes(String(value.operator))||!finite(value.value)||!Number.isInteger(value.value)||value.value<0)throw new Error(`${path}: count needs a nonnegative integer comparison`);
      if(value.where!==undefined){
        if(!isObject(value.where)||!nonempty(value.where.kind))throw new Error(`${path}.where: needs an entity predicate`);
        if(value.where.kind==="state"){
          checkKeys(value.where,["kind","state"],`${path}.where`);
          if(!nonempty(value.where.state))throw new Error(`${path}.where: state must be nonempty`);
        }else if(value.where.kind==="position"){
          checkKeys(value.where,["kind","axis","operator","value"],`${path}.where`);
          if(!["x","y"].includes(String(value.where.axis))||!comparison(value.where.operator)||!finite(value.where.value))throw new Error(`${path}.where: position needs a numeric comparison`);
        }else throw new Error(`${path}.where: unknown predicate kind ${value.where.kind}`);
      }
      return;
    case "never":
      checkKeys(value,["kind","goal","afterMs","until"],path);
      if(value.afterMs===undefined&&value.until===undefined)throw new Error(`${path}: never needs afterMs or until`);
      if(value.afterMs!==undefined&&(!finite(value.afterMs)||value.afterMs<=0))throw new Error(`${path}: afterMs must be positive`);
      validateGoal(value.goal,ids,`${path}.goal`,depth+1);
      if(value.until!==undefined)validateGoal(value.until,ids,`${path}.until`,depth+1);
      return;
    default:throw new Error(`${path}: unknown goal kind ${String(value.kind)}`);
  }
}

function validateLegacyGoal(value:unknown){
  if(!isObject(value)||!["event","all","any","state","position"].includes(String(value.mode)))throw new Error("Level needs a legacy goal mode");
  checkKeys(value,["mode","event","conditions"],"goal");
  if(value.mode==="event"){
    if(!nonempty(value.event))throw new Error("goal.event must be nonempty");
    return;
  }
  if(!Array.isArray(value.conditions)||value.conditions.length===0)throw new Error("goal.conditions must be nonempty");
  for(const [index,condition] of value.conditions.entries()){
    if(!isObject(condition))throw new Error(`goal.conditions[${index}] must be an object`);
    checkKeys(condition,["signal","operator","value"],`goal.conditions[${index}]`);
    if(!nonempty(condition.signal)||!["occurred","equals","above","below"].includes(String(condition.operator)))throw new Error(`goal.conditions[${index}] is invalid`);
    if(condition.operator==="equals"&&(condition.value===undefined||typeof condition.value==="object"))throw new Error(`goal.conditions[${index}] needs a value`);
    if(["above","below"].includes(String(condition.operator))&&!finite(condition.value))throw new Error(`goal.conditions[${index}] needs a number`);
  }
}

export function validateLevel(value:unknown):LevelDefinition{
  if(!value||typeof value!=="object")throw new Error("Level JSON must be an object");
  const level=value as Partial<LevelDefinition>;
  if(level.schemaVersion!==1&&level.schemaVersion!==2)throw new Error("Unsupported level schemaVersion");
  if(!level.id||!level.scene||!level.title||!level.objective)throw new Error("Level needs id, scene, title and objective");
  if(!Number.isInteger(level.number)||Number(level.number)<1)throw new Error("Level number must be a positive integer");
  if(!Array.isArray(level.inventory)||!Array.isArray(level.fixedGadgets)||!Array.isArray(level.systems))throw new Error("Level needs inventory, fixedGadgets and systems arrays");
  const seenSystems=new Set<string>();
  for(const system of level.systems){
    if(!KNOWN_RUNTIME_SYSTEM_IDS.has(system))throw new Error(`Unknown level system: ${system}`);
    if(seenSystems.has(system))throw new Error(`Duplicate level system: ${system}`);
    seenSystems.add(system);
  }
  const ids=new Set<string>();
  for(const gadget of level.fixedGadgets){if(!GADGET_CATALOG[gadget.type])throw new Error(`Unknown gadget type: ${gadget.type}`);if(ids.has(gadget.id))throw new Error(`Duplicate gadget id: ${gadget.id}`);ids.add(gadget.id)}
  if(level.initialPlacements!==undefined&&!Array.isArray(level.initialPlacements))throw new Error("initialPlacements must be an array");
  for(const gadget of level.initialPlacements??[]){const definition=GADGET_CATALOG[gadget.type];if(!definition)throw new Error(`Unknown initial gadget type: ${gadget.type}`);if(!definition.removable)throw new Error(`Initial gadget must be placeable: ${gadget.type}`);if(ids.has(gadget.id))throw new Error(`Duplicate gadget id: ${gadget.id}`);ids.add(gadget.id)}
  for(const item of level.inventory){if(!GADGET_CATALOG[item.type as PlaceableGadgetType])throw new Error(`Unknown inventory type: ${item.type}`);if(!Number.isInteger(item.count)||item.count<1)throw new Error(`Invalid inventory count for ${item.type}`)}
  if(level.schemaVersion===1)validateLegacyGoal(level.goal);
  else validateGoal(level.goal,ids);
  return structuredClone(level as LevelDefinition);
}

export const LEVELS:LevelDefinition[]=rawLevels.map(validateLevel).sort((a,b)=>a.number-b.number);
export const LEVEL_BY_ID=new Map(LEVELS.map(level=>[level.id,level]));
export const getLevel=(index:number)=>LEVELS[index]??LEVELS[0];
