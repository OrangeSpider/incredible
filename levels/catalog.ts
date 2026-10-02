import level01 from "./level-01.json" with { type: "json" };
import level02 from "./level-02.json" with { type: "json" };
import level03 from "./level-03.json" with { type: "json" };
import level04 from "./level-04.json" with { type: "json" };
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
import level16 from "./level-16.json" with { type: "json" };
import level17 from "./level-17.json" with { type: "json" };
import level18 from "./level-18.json" with { type: "json" };
import level19 from "./level-19.json" with { type: "json" };
import level20 from "./level-20.json" with { type: "json" };
import level21 from "./level-21.json" with { type: "json" };
import level22 from "./level-22.json" with { type: "json" };
import level23 from "./level-23.json" with { type: "json" };
import level24 from "./level-24.json" with { type: "json" };
import level25 from "./level-25.json" with { type: "json" };
import level26 from "./level-26.json" with { type: "json" };
import level27 from "./level-27.json" with { type: "json" };
import level28 from "./level-28.json" with { type: "json" };
import level29 from "./level-29.json" with { type: "json" };
import level30 from "./level-30.json" with { type: "json" };
import level31 from "./level-31.json" with { type: "json" };
import level32 from "./level-32.json" with { type: "json" };
import level33 from "./level-33.json" with { type: "json" };
import level34 from "./level-34.json" with { type: "json" };
import level35 from "./level-35.json" with { type: "json" };
import {GADGET_CATALOG} from "../engine/gadget-catalog.ts";
import {KNOWN_RUNTIME_SYSTEM_IDS} from "../game/runtime-system-ids.ts";
import {gadgetPorts,connectPorts,connectionPorts,sameConnection} from "../game/gadget-connections.ts";
import {ropePorts} from "../game/control-ropes.ts";
import type {ComposableGoalSpec,GoalSelector,LevelDefinition,PlaceableGadgetType} from "../engine/types.ts";

const rawLevels=[level01,level02,level03,level04,level06,level07,level08,level09,level10,level11,level12,level13,level14,level15,level16,level17,level18,level19,level20,level21,level22,level23,level24,level25,level26,level27,level28,level29,level30,level31,level32,level33,level34,level35];

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
    case "area":
      checkKeys(value,["kind","selector","x","y","width","height"],path);
      validateSelector(value.selector,ids,`${path}.selector`);
      if(!finite(value.x)||!finite(value.y)||!finite(value.width)||!finite(value.height)||value.width<=0||value.height<=0)throw new Error(`${path}: area needs finite coordinates and positive dimensions`);
      return;
    case "motion":
      checkKeys(value,["kind","selector","minimumSpeed"],path);
      validateSelector(value.selector,ids,`${path}.selector`);
      if(!finite(value.minimumSpeed)||value.minimumSpeed<=0)throw new Error(`${path}: motion needs a positive minimumSpeed`);
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
  if(level.floor!==undefined&&typeof level.floor!=="boolean")throw new Error("floor must be boolean");
  const validateGadget=(gadget:unknown)=>{
    if(!isObject(gadget)||!nonempty(gadget.id)||!nonempty(gadget.type)||!GADGET_CATALOG[gadget.type as keyof typeof GADGET_CATALOG])throw new Error("Gadget needs an id and known type");
    if(!finite(gadget.x)||!finite(gadget.y)||(gadget.rotation!==undefined&&!finite(gadget.rotation)))throw new Error(`Invalid gadget coordinates: ${gadget.id}`);
    for (const key of ["flipX", "flipY"]) if (gadget[key] !== undefined && typeof gadget[key] !== "boolean") throw new Error(`Invalid gadget ${key}: ${gadget.id}`);
    if (gadget.physics !== undefined) {
      if (!isObject(gadget.physics)) throw new Error("Gadget physics must be an object");
      for (const key of ["width", "height", "radius"]) if (gadget.physics[key] !== undefined && (!finite(gadget.physics[key]) || Number(gadget.physics[key]) <= 0)) throw new Error(`Invalid gadget dimension ${key}: ${gadget.id}`);
    }
    if (gadget.type === "candle" && gadget.collisionLabel === "ignitionCandle" && isObject(gadget.physics) && gadget.physics.height === 52) gadget.properties = { flameOffsetY: -50, ...(isObject(gadget.properties) ? gadget.properties : {}) };
    if(ids.has(gadget.id))throw new Error(`Duplicate gadget id: ${gadget.id}`);
    ids.add(gadget.id);
  };
  for(const gadget of level.fixedGadgets)validateGadget(gadget);
  if(level.initialPlacements!==undefined&&!Array.isArray(level.initialPlacements))throw new Error("initialPlacements must be an array");
  for(const gadget of level.initialPlacements??[])validateGadget(gadget);
  const inventoryTypes=new Set<string>();
  for(const item of level.inventory){if(!isObject(item)||!GADGET_CATALOG[item.type as PlaceableGadgetType])throw new Error(`Unknown inventory type: ${item?.type}`);if(!Number.isInteger(item.count)||Number(item.count)<1)throw new Error(`Invalid inventory count for ${item.type}`);if(inventoryTypes.has(String(item.type)))throw new Error(`Duplicate inventory type: ${item.type}`);inventoryTypes.add(String(item.type))}
  if(level.connections!==undefined&&!Array.isArray(level.connections))throw new Error("connections must be an array");
  const ports=gadgetPorts([...level.fixedGadgets,...(level.initialPlacements??[])]),connectionIds=new Set<string>();
  for(const connection of level.connections??[]){
    if(!nonempty(connection.id)||connectionIds.has(connection.id))throw new Error("Connection needs a unique id");
    if(connection.kind!=="wire"&&connection.kind!=="belt")throw new Error("Unknown connection kind");
    if((connection.sourcePortId!==undefined&&!nonempty(connection.sourcePortId))||(connection.targetPortId!==undefined&&!nonempty(connection.targetPortId)))throw new Error(`Invalid connection port: ${connection.id}`);
    const [source,target]=connectionPorts(connection,ports);
    if(!source||!target||!connectPorts(source,target,connection.kind,[],connection.id))throw new Error(`Invalid connection: ${connection.id}`);
    if((level.connections??[]).some(other=>other!==connection&&sameConnection(other,connection)))throw new Error(`Duplicate connection: ${connection.id}`);
    connectionIds.add(connection.id);
  }
  if(level.controlRopes!==undefined&&!Array.isArray(level.controlRopes))throw new Error("controlRopes must be an array");
  const ropeEndpoints=ropePorts([...level.fixedGadgets,...(level.initialPlacements??[])]),ropeTargets=new Set<string>();
  for(const rope of level.controlRopes??[]){
    if(!isObject(rope)||!nonempty(rope.targetId)||!Array.isArray(rope.guides)||!isObject(rope.source)||!isObject(rope.source.local)||!finite(rope.source.local.x)||!finite(rope.source.local.y))throw new Error("Invalid control rope");
    if(!ropeEndpoints.some(port=>port.gadgetId===rope.targetId&&port.kind==="target")||ropeTargets.has(rope.targetId))throw new Error(`Invalid or duplicate rope target: ${rope.targetId}`);
    if(!ropeEndpoints.some(port=>port.gadgetId===rope.source.gadgetId&&port.kind==="source"&&port.local.x===rope.source.local.x&&port.local.y===rope.source.local.y))throw new Error("Invalid rope source");
    if(new Set(rope.guides).size!==rope.guides.length||rope.guides.some(id=>!ropeEndpoints.some(port=>port.gadgetId===id&&port.kind==="guide")))throw new Error("Invalid rope guides");
    ropeTargets.add(rope.targetId);
  }
  if(level.schemaVersion===1)validateLegacyGoal(level.goal);
  else validateGoal(level.goal,ids);
  const validated=structuredClone(level as LevelDefinition);
  // Older editor exports omit the runtime hook required by their magnets.
  const hasMagnet=[...validated.fixedGadgets,...(validated.initialPlacements??[]),...validated.inventory].some(gadget=>gadget.type==="magnet");
  if(hasMagnet&&!seenSystems.has("magnetic-field"))validated.systems.push("magnetic-field");
  return validated;
}

export const LEVELS:LevelDefinition[]=rawLevels.map(validateLevel).sort((a,b)=>a.number-b.number);
export const LEVEL_BY_ID=new Map(LEVELS.map(level=>[level.id,level]));
export const getLevel=(index:number)=>LEVELS[index]??LEVELS[0];
