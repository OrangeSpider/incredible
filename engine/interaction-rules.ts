import {GADGET_CATALOG} from "./gadget-catalog.ts";
import type {GadgetCategory,GadgetDefinition,GadgetType} from "./types.ts";

export type InteractionEffect=
  |"start"|"transport"|"goal-signal"|"redirect"|"pop"|"push"|"flee"|"chase"|"transfer-rotation"|"transfer-tension"|"bounce"|"transfer-impulse"|"close"|"cut"|"break"|"ignite"|"extinguish"|"fire"|"collect";

export type GadgetSelector={types?:GadgetType[];categories?:GadgetCategory[];tags?:string[]};

export type InteractionRule={
  id:string;
  source:GadgetSelector;
  target:GadgetSelector;
  trigger:"collision"|"proximity"|"connection"|"tension"|"continuous"|"state-change";
  effect:InteractionEffect;
  description:string;
  minImpactSpeed?:number;
  maxVerticalDistance?:number;
  minDistance?:number;
  maxDistance?:number;
  requiresSourceAbove?:boolean;
  direction?:"contact-normal"|"source-motion"|"opposite-target"|"clockwise-inverted"|"up"|"forward";
  impulseScale?:number;
  signal?:string;
  stateTarget?:"source"|"target";
  sourceStates?:string[];
  targetStates?:string[];
};

export type InteractionKinematics={
  impactSpeed:number;
  sourceX:number;
  sourceY:number;
  targetX:number;
  targetY:number;
  relativeVelocity:{x:number;y:number};
  collisionNormal?:{x:number;y:number};
  sourceState?:string;
  targetState?:string;
};

export type ResolvedInteraction={rule:InteractionRule;source:GadgetDefinition;target:GadgetDefinition;reversed:boolean};

export const INTERACTION_RULES:InteractionRule[]=[
  {id:"falling-body-starts-wheel",source:{tags:["falling-body"]},target:{types:["hamsterWheel"]},trigger:"collision",effect:"start",description:"Ein ausreichend schneller beweglicher Körper setzt Louis und sein Hamsterrad in Gang.",minImpactSpeed:1.5,direction:"source-motion",signal:"hamsterWheel.started"},
  {id:"belt-transfers-drive",source:{tags:["rotational-source"]},target:{tags:["belt-port"]},trigger:"connection",effect:"transfer-rotation",description:"Ein sichtbarer Riemen überträgt Drehung auf das Ziel.",direction:"forward",signal:"drive.transferred"},
  {id:"conveyor-transports",source:{types:["conveyor"]},target:{categories:["dynamic"]},trigger:"collision",effect:"transport",description:"Ein laufendes Band gibt eine konstante seitliche Geschwindigkeit vor.",direction:"forward"},
  {id:"target-zone",source:{categories:["dynamic"]},target:{tags:["goal-zone"]},trigger:"collision",effect:"goal-signal",description:"Ein passender Körper betritt einen sensorischen Zielbereich.",signal:"target.entered"},
  {id:"ramp-redirects",source:{tags:["falling-body"]},target:{types:["ramp"]},trigger:"collision",effect:"redirect",description:"Die Flächennormale und Reibung der Rampe lenken den Körper um.",direction:"contact-normal"},
  {id:"needle-pops-balloon",source:{tags:["balloon"]},target:{tags:["sharp"]},trigger:"collision",effect:"pop",description:"Eine Spitze durchdringt ausschließlich eine ballonartige Hülle.",signal:"balloon.popped",stateTarget:"source"},
  {id:"fire-pops-balloon",source:{tags:["fire-source"]},target:{tags:["balloon"]},trigger:"collision",effect:"pop",description:"Direkter Flammenkontakt zerstört die Ballonhülle.",sourceStates:["burning"],signal:"balloon.popped"},
  {id:"fan-pushes-buoyant",source:{tags:["air-source"]},target:{tags:["buoyant"]},trigger:"proximity",effect:"push",description:"Der gerichtete Luftkegel beschleunigt leichte Körper und wird mit Entfernung schwächer.",maxDistance:420,direction:"forward",impulseScale:.00035},
  {id:"cat-mouse",source:{tags:["cat"]},target:{tags:["prey"]},trigger:"proximity",effect:"flee",description:"Mogli flieht, wenn Joanne ungefähr auf gleicher Höhe ist.",maxVerticalDistance:35,maxDistance:700,direction:"opposite-target",signal:"mouse.fleeing"},
  {id:"fish-attracts-cat",source:{tags:["cat-attractor"]},target:{tags:["cat"]},trigger:"proximity",effect:"chase",description:"Joanne läuft zu einem sichtbaren, zappelnden Mr. Blue.",sourceStates:["flopping"],maxVerticalDistance:70,maxDistance:700,direction:"opposite-target",signal:"cat.chasing"},
  {id:"gear-mesh",source:{tags:["gear"]},target:{tags:["gear"]},trigger:"proximity",effect:"transfer-rotation",description:"Zahnräder im passenden Achsabstand drehen sich entgegengesetzt.",sourceStates:["running"],minDistance:70,maxDistance:98,direction:"clockwise-inverted",signal:"gear.connected"},
  {id:"rope-fixed-pulley",source:{tags:["tension-only"]},target:{tags:["fixed-pulley"]},trigger:"connection",effect:"transfer-tension",description:"Eine Festrolle lenkt Zugkraft um, ohne ihre Achse zu bewegen."},
  {id:"rope-moving-pulley",source:{tags:["tension-only"]},target:{tags:["moving-pulley"]},trigger:"tension",effect:"transfer-tension",description:"Tragende Seilabschnitte teilen Zugkraft und bewegen die lose Rolle."},
  {id:"trampoline-bounce",source:{tags:["falling-body"]},target:{tags:["bounce-surface"]},trigger:"collision",effect:"bounce",description:"Der Impuls wird an der gedrehten Trampolinnormalen nach oben umgelenkt.",minImpactSpeed:1,direction:"contact-normal",impulseScale:1.5},
  {id:"seesaw-impact",source:{tags:["falling-body"]},target:{tags:["seesaw"]},trigger:"collision",effect:"transfer-impulse",description:"Die getroffene Seite sinkt, die Gegenseite erhält einen entgegengesetzten Impuls.",minImpactSpeed:1,direction:"opposite-target",impulseScale:.65},
  {id:"impact-closes-scissor",source:{tags:["falling-body"]},target:{tags:["impact-closable"]},trigger:"collision",effect:"close",description:"Ein ausreichend schneller Aufprall von oben schließt die Schere.",minImpactSpeed:2.4,requiresSourceAbove:true,signal:"scissor.closed"},
  {id:"tension-closes-scissor",source:{tags:["tension-only"]},target:{tags:["rope-pullable"]},trigger:"tension",effect:"close",description:"Nur vom Griff weg gerichtete Seilspannung schließt die Schere.",direction:"source-motion",signal:"scissor.closed"},
  {id:"scissor-cuts-tether",source:{types:["scissor"]},target:{tags:["balloon"]},trigger:"state-change",effect:"cut",description:"Die geschlossene Schere durchtrennt ausschließlich ihr zugeordnetes Ballonseil.",signal:"balloon.released"},
  {id:"impact-breaks-glass",source:{tags:["falling-body"]},target:{tags:["breakable"]},trigger:"collision",effect:"break",description:"Ein harter Aufprall von oben zerbricht das Goldfischglas.",minImpactSpeed:4.5,requiresSourceAbove:true,signal:"fishBowl.broken"},
  {id:"fire-ignites-fuse",source:{tags:["fire-source"]},target:{tags:["fuse"]},trigger:"collision",effect:"ignite",description:"Feuer startet den Abbrand genau am räumlichen Kontaktpunkt.",sourceStates:["burning"],signal:"fuse.ignited"},
  {id:"fuse-ignites-fuse",source:{tags:["fuse"]},target:{tags:["fuse"]},trigger:"collision",effect:"ignite",description:"Eine brennende Lunte entzündet eine kreuzende Lunte am Kontaktpunkt.",sourceStates:["burning"]},
  {id:"fuse-fires-cannon",source:{tags:["fuse"]},target:{tags:["fuse-target"]},trigger:"state-change",effect:"fire",description:"Erreicht die Flammenfront den Zündkanal, feuert die Kanone einmal.",signal:"cannon.fired"},
  {id:"fire-ignites-rocket",source:{tags:["fire-source"]},target:{tags:["fire-trigger"]},trigger:"collision",effect:"ignite",description:"Berührt eine offene Flamme die Düse, beginnt die fest montierte Rakete zu zünden.",sourceStates:["burning"],signal:"rocket.ignited"},
  {id:"water-extinguishes",source:{tags:["water"]},target:{tags:["extinguishable"]},trigger:"collision",effect:"extinguish",description:"Wasser beendet Flamme oder Luntenabbrand am Kontaktpunkt.",signal:"fire.extinguished"},
  {id:"water-collects",source:{tags:["water"]},target:{categories:["container"]},trigger:"collision",effect:"collect",description:"Wasserpartikel können sich im offenen Innenraum eines Behälters sammeln."},
];

export const matchesGadget=(definition:GadgetDefinition,selector:GadgetSelector)=>
  (!selector.types||selector.types.includes(definition.type))&&
  (!selector.categories||selector.categories.some(category=>definition.categories.includes(category)))&&
  (!selector.tags||selector.tags.every(tag=>definition.tags.includes(tag)));

const conditionMatches=(rule:InteractionRule,kinematics:InteractionKinematics)=>
  (rule.sourceStates===undefined||kinematics.sourceState===undefined||rule.sourceStates.includes(kinematics.sourceState))&&
  (rule.targetStates===undefined||kinematics.targetState===undefined||rule.targetStates.includes(kinematics.targetState))&&
  (rule.minImpactSpeed===undefined||kinematics.impactSpeed>=rule.minImpactSpeed)&&
  (!rule.requiresSourceAbove||kinematics.sourceY<kinematics.targetY)&&
  (rule.maxVerticalDistance===undefined||Math.abs(kinematics.sourceY-kinematics.targetY)<=rule.maxVerticalDistance)&&
  (rule.minDistance===undefined||Math.hypot(kinematics.sourceX-kinematics.targetX,kinematics.sourceY-kinematics.targetY)>=rule.minDistance)&&
  (rule.maxDistance===undefined||Math.hypot(kinematics.sourceX-kinematics.targetX,kinematics.sourceY-kinematics.targetY)<=rule.maxDistance);

export function resolveInteractions(sourceType:GadgetType,targetType:GadgetType,trigger:InteractionRule["trigger"],kinematics:InteractionKinematics):ResolvedInteraction[]{
  const source=GADGET_CATALOG[sourceType],target=GADGET_CATALOG[targetType],resolved:ResolvedInteraction[]=[];
  for(const rule of INTERACTION_RULES){
    if(rule.trigger!==trigger)continue;
    if(matchesGadget(source,rule.source)&&matchesGadget(target,rule.target)&&conditionMatches(rule,kinematics))resolved.push({rule,source,target,reversed:false});
    else if(matchesGadget(target,rule.source)&&matchesGadget(source,rule.target)&&conditionMatches(rule,{...kinematics,sourceX:kinematics.targetX,sourceY:kinematics.targetY,targetX:kinematics.sourceX,targetY:kinematics.sourceY,sourceState:kinematics.targetState,targetState:kinematics.sourceState,relativeVelocity:{x:-kinematics.relativeVelocity.x,y:-kinematics.relativeVelocity.y}}))resolved.push({rule,source:target,target:source,reversed:true});
  }
  return resolved;
}

export const interactionRows=()=>INTERACTION_RULES.map(rule=>({source:Object.values(GADGET_CATALOG).filter(gadget=>matchesGadget(gadget,rule.source)).map(gadget=>gadget.displayName).join(", "),target:Object.values(GADGET_CATALOG).filter(gadget=>matchesGadget(gadget,rule.target)).map(gadget=>gadget.displayName).join(", "),trigger:rule.trigger,effect:rule.description,status:"aktiv" as const}));
