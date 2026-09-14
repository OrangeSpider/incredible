import Matter from "matter-js";
import {getGadgetDefinition} from "./gadget-catalog.ts";
import type {GadgetInstanceConfig,PhysicalProperties} from "./types.ts";

export type MachineBodyPlugin={machine:{instanceId:string;type:GadgetInstanceConfig["type"];state:string;role?:string;properties:Record<string,string|number|boolean>}};

export function machinePlugin(body:Matter.Body):MachineBodyPlugin["machine"]|null{
  return (body.plugin as Partial<MachineBodyPlugin>)?.machine??null;
}

export function createGadgetBody(instance:GadgetInstanceConfig):Matter.Body|null{
  const definition=getGadgetDefinition(instance.type),properties:PhysicalProperties={...definition.physics,...instance.physics};
  if(properties.shape==="none")return null;
  const options:Matter.IChamferableBodyDefinition={
    angle:instance.rotation??0,
    density:properties.density,
    friction:properties.friction,
    frictionStatic:properties.staticFriction,
    frictionAir:properties.airFriction,
    restitution:properties.restitution,
    isSensor:properties.isSensor||properties.shape==="sensor",
    inertia:properties.inertiaLocked?Infinity:undefined,
    label:instance.collisionLabel??instance.type,
  };
  const body=properties.shape==="circle"||("radius" in properties&&properties.radius!==undefined)
    ?Matter.Bodies.circle(instance.x,instance.y,properties.radius??25,options)
    :Matter.Bodies.rectangle(instance.x,instance.y,properties.width??50,properties.height??50,properties.shape==="compound"?{...options,chamfer:{radius:4}}:options);
  Matter.Body.setMass(body,Math.max(.0001,properties.massKg));
  body.plugin={...body.plugin,machine:{instanceId:instance.id,type:instance.type,state:instance.state??definition.defaultState,role:instance.role,properties:{...(instance.properties??{})}}};
  // Bodies are deliberately created dynamic first. Matter can then restore their
  // original mass when a level later releases a tethered/static gadget.
  if(properties.isStatic)Matter.Body.setStatic(body,true);
  return body;
}
