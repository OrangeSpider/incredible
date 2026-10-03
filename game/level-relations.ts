import { GADGET_CATALOG } from "../engine/gadget-catalog.ts";
import type { GadgetInstanceConfig, GadgetType, LevelDefinition } from "../engine/types.ts";

/** Validate only the concrete relationships supported by the existing scene mechanics. */
export function validateLevelRelations(level:LevelDefinition, configs:readonly GadgetInstanceConfig[]= [...level.fixedGadgets,...(level.initialPlacements??[])]) {
  const reference=(id:unknown,type:GadgetType)=>{
    if (typeof id!=="string" || !id.length) throw new Error(`Missing ${type} reference`);
    const config=configs.find(config=>config.id===id) ?? level.initialPlacements?.find(config=>config.id===id);
    if (config) {if(config.type!==type) throw new Error(`Invalid ${type} reference: ${id}`);return;}
    if (type==="fish" && configs.some(config=>config.type==="fishBowl" && `${config.id}:fish`===id)) return;
    throw new Error(`Unknown ${type} reference: ${id}`);
  };
  const keys=(row:Record<string,unknown>,allowed:string[])=>{for(const key of Object.keys(row))if(!allowed.includes(key))throw new Error(`Unknown relation field: ${key}`)};
  const rows=(value:unknown,name:string):Record<string,unknown>[]=>{
    if (value===undefined) return [];
    if (!Array.isArray(value)||value.some(row=>!row||typeof row!=="object"||Array.isArray(row))) throw new Error(`Invalid ${name}`);
    return value;
  };
  for (const flow of rows(level.animalChases,"animalChases")) {
    keys(flow,["catId","mouseId","exitId","gateId"]);
    reference(flow.catId,"cat");reference(flow.mouseId,"mouse");reference(flow.exitId,"exit");if(flow.gateId!==undefined)reference(flow.gateId,"snapGate");
  }
  for (const flow of rows(level.catapults,"catapults")) {
    keys(flow,["catId","mouseId","exitId","seesawId","platformId"]);
    reference(flow.catId,"cat");reference(flow.mouseId,"mouse");reference(flow.exitId,"exit");reference(flow.seesawId,"seesaw");reference(flow.platformId,"steelBeam");
  }
  for (const flow of rows(level.fishChases,"fishChases")) {keys(flow,["catId","fishId"]);reference(flow.catId,"cat");reference(flow.fishId,"fish");}
  for (const flow of rows(level.seesawLaunches,"seesawLaunches")) {
    keys(flow,["impactId","triggerId","velocity"]);
    reference(flow.impactId,"ball");reference(flow.triggerId,"tennisBall");
    const v=flow.velocity as {x?:number;y?:number}|undefined;
    if (!v || !Number.isFinite(v.x)||!Number.isFinite(v.y)) throw new Error("Invalid launch velocity");
  }
  if (level.loadRope) {
    keys(level.loadRope,["weightId","anchor"]);
    reference(level.loadRope.weightId,"weight");
    if (!level.loadRope.anchor || !Number.isFinite(level.loadRope.anchor.x)||!Number.isFinite(level.loadRope.anchor.y)) throw new Error("Invalid load rope anchor");
  }
  const assignedFish=new Set<string>();
  for (const config of configs) {
    if (config.type==="scissor" && config.properties?.balloon!==undefined) reference(config.properties.balloon,"balloon");
    if (config.type==="fishBowl" && config.properties?.fishId!==undefined) {
      reference(config.properties.fishId,"fish");
      const fishId=String(config.properties.fishId);
      if (assignedFish.has(fishId)) throw new Error(`Duplicate fish relation: ${fishId}`);
      assignedFish.add(fishId);
    }
    if (config.physics) {
      for (const [key,value] of Object.entries(config.physics)) {
        if (["isStatic","isSensor","inertiaLocked"].includes(key)) {if(typeof value!=="boolean")throw new Error(`Invalid physics boolean: ${key}`);}
        else if(key==="shape") {if(!["circle","rectangle","compound","sensor","none"].includes(String(value)))throw new Error("Invalid body shape");}
        else if(typeof value!=="number" || !Number.isFinite(value))throw new Error(`Invalid physics number: ${key}`);
      }
      for(const key of ["width","height","radius","maxSpeed"] as const)if(config.physics[key]!==undefined&&config.physics[key]!<=0)throw new Error(`Invalid physics dimension: ${key}`);
      for(const key of ["massKg","density","friction","staticFriction","airFriction","restitution","impactThreshold"] as const)if(config.physics[key]!==undefined&&config.physics[key]!<0)throw new Error(`Invalid physics parameter: ${key}`);
      if(config.type==="bucket" && ((config.physics.shape!==undefined&&config.physics.shape!=="compound")||config.physics.radius!==undefined))throw new Error("Bucket overrides retain the open compound shape");
    }
    if (config.physics) for (const key of Object.keys(config.physics)) if (!(key in GADGET_CATALOG[config.type].physics) && !["radius","width","height","inertiaLocked","maxSpeed","buoyancyForce","impactThreshold"].includes(key)) throw new Error(`Unknown physics parameter: ${key}`);
  }
}
