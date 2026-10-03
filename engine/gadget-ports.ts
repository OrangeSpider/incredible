import { GADGET_CATALOG } from "./gadget-catalog.ts";
import { localPoint } from "./gadget-geometry.ts";
import type { GadgetInstanceConfig, PortDefinition, PortReference } from "./types.ts";
export function portKey(ref:PortReference):string { return JSON.stringify([ref.gadgetId,ref.portId]); }
export type InstancePort = Omit<PortDefinition,"id"> & {gadgetId:string;portId:string;x:number;y:number};
export function localPorts(config:GadgetInstanceConfig):PortDefinition[] {
  const definition=GADGET_CATALOG[config.type];
  if(definition.ports) return definition.ports(config);
  const ports:PortDefinition[]=[];
  if(definition.tags.includes("rope-end")) ports.push({id:"pull",kind:"source",local:{x:0,y:0},label:"ZUGPUNKT"});
  if(definition.electrical?.supply==="socket") ports.push({id:"socket",kind:"socket",local:{x:36,y:20},label:"STECKDOSE"});
  if(definition.tags.includes("belt-port")||definition.tags.includes("gear")) ports.push({id:"drive",kind:"drive",local:{x:0,y:0},radius:12,label:"ANTRIEB"});
  return ports;
}
export function instancePorts(configs:readonly GadgetInstanceConfig[]):InstancePort[] {
  return configs.flatMap(config=>localPorts(config).map(({id,...port})=>({...port,gadgetId:config.id,portId:id,...localPoint(config,port.local)})));
}
export function localPort(config:GadgetInstanceConfig, id:string, kind:PortDefinition["kind"]) {
  return localPorts(config).find(port=>port.id===id&&port.kind===kind);
}
