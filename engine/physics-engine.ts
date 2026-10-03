import { validateConnections, sameConnection } from "../game/gadget-connections.ts";
import Matter from "matter-js";
import {createGadgetBody,machinePlugin} from "./body-factory.ts";
import {getGadgetDefinition} from "./gadget-catalog.ts";
import {resolveInteractions,type ResolvedInteraction} from "./interaction-rules.ts";
import {evaluateGoal} from "./goal-evaluator.ts";
import {createDefaultEffectRegistry, type EffectRegistry} from "./effect-handlers.ts";
import {createDefaultStepBehaviors, type StepBehaviorRegistry} from "./step-behaviors.ts";
import {resolveGadgetAnimation} from "./animation.ts";
import {localPoint} from "./gadget-geometry.ts";
import {GadgetMechanics} from "./gadget-mechanics.ts";
import {createBucketAssembly} from "../game/water.ts";
import {bodyHasSupport} from "../game/animals.ts";
import type {GadgetConnection,GadgetInstanceConfig,GadgetRuntimeState,GoalEvent,GoalSpec,LevelDefinition} from "./types.ts";

export type PhysicsEvent=
  |{type:"collision";bodyA:Matter.Body;bodyB:Matter.Body;normal:{x:number;y:number}}
  |{type:"interaction";interaction:ResolvedInteraction;instanceId:string}
  |{type:"state";instanceId:string;state:string}
  |{type:"signal";signal:string;value:string|number|boolean};

type RuntimeEntry={config:GadgetInstanceConfig;body:Matter.Body|null;state:GadgetRuntimeState;stateEnteredAtMs:number};

export const WORLD_GRAVITY_SCALE=.00105;
export const ROLLING_AIR_FRICTION=.002;

export class MachinePhysicsEngine{
  readonly matter=Matter.Engine.create({gravity:{x:0,y:1,scale:WORLD_GRAVITY_SCALE}});
  readonly world=this.matter.world;
  private entries=new Map<string,RuntimeEntry>();
  private bodyEntries=new Map<number,RuntimeEntry>();
  private listeners=new Set<(event:PhysicsEvent)=>void>();
  private signals=new Map<string,string|number|boolean>();
  private events:GoalEvent[]=[];
  private seenEvents=new Set<string>();
  private elapsedMs=0;
  readonly effects:EffectRegistry;
  readonly behaviors:StepBehaviorRegistry;
  readonly mechanics:GadgetMechanics;
  private connectionDefinitions:GadgetConnection[]=[];
  get connections(){return this.connectionDefinitions}
  set connections(connections:GadgetConnection[]){
    for(const connection of connections){
      if(!connection.sourcePortId||!connection.targetPortId)throw new Error(`Invalid connection port: ${connection.id}`);
      if(connections.some(other=>other!==connection&&(other.id===connection.id||sameConnection(other,connection))))throw new Error(`Duplicate connection: ${connection.id}`);
    }
    this.connectionDefinitions=connections;
  }

  constructor(
    level?:LevelDefinition,
    effects:EffectRegistry=createDefaultEffectRegistry(),
    behaviors:StepBehaviorRegistry=createDefaultStepBehaviors(),
  ){
    this.effects=effects;
    this.behaviors=behaviors;
    this.mechanics=new GadgetMechanics(this);
    Matter.Events.on(this.matter,"collisionStart",event=>event.pairs.forEach(pair=>{
      this.processCollision(pair.bodyA,pair.bodyB,pair.collision.normal);
      // A container may break during collisionStart, before Matter solves this pair.
      pair.isSensor = pair.bodyA.isSensor || pair.bodyB.isSensor;
    }));
    if(level)this.loadLevel(level);
  }

  loadLevel(level:LevelDefinition){
    validateConnections(level.connections??[],[...level.fixedGadgets,...(level.initialPlacements??[])]);
    this.connections=structuredClone(level.connections??[]);
    for(const gadget of level.fixedGadgets)this.addGadget(gadget);
  }

  addGadget(config:GadgetInstanceConfig,providedBody?:Matter.Body):Matter.Body|null{
    if(this.entries.has(config.id))throw new Error(`Duplicate gadget id: ${config.id}`);
    if(config.type==="bucket"&&!providedBody){
      const assembly=createBucketAssembly(config.x,config.y,config.rotation??0);
      if (config.flipX || config.flipY) {
        Matter.Body.setAngle(assembly.bucket, 0);
        Matter.Body.scale(assembly.bucket, config.flipX ? -1 : 1, config.flipY ? -1 : 1, {x:config.x,y:config.y});
        Matter.Body.setAngle(assembly.bucket, config.rotation ?? 0);
        for (const drop of assembly.water) { const dx=drop.position.x-config.x,dy=drop.position.y-config.y,a=-(config.rotation??0); const at={x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)}; Matter.Body.setPosition(drop,localPoint(config,at)); }
      }
      if (config.physics?.width!==undefined || config.physics?.height!==undefined) {
        const sx=(config.physics.width??76)/76,sy=(config.physics.height??64)/64;
        Matter.Body.setAngle(assembly.bucket,0);Matter.Body.scale(assembly.bucket,sx,sy,{x:config.x,y:config.y});Matter.Body.setAngle(assembly.bucket,config.rotation??0);
        const a=-(config.rotation??0);
        for(const drop of assembly.water){const dx=drop.position.x-config.x,dy=drop.position.y-config.y,x=(dx*Math.cos(a)-dy*Math.sin(a))*sx,y=(dx*Math.sin(a)+dy*Math.cos(a))*sy;const r=config.rotation??0;Matter.Body.setPosition(drop,{x:config.x+x*Math.cos(r)-y*Math.sin(r),y:config.y+x*Math.sin(r)+y*Math.cos(r)});}
      }
      if(config.physics?.isStatic===false)Matter.Body.setStatic(assembly.bucket,false);
      const bucket=this.addGadget(config,assembly.bucket);
      assembly.water.forEach((drop,index)=>this.addGadget({id:`${config.id}:water:${index}`,type:"water",x:drop.position.x,y:drop.position.y},drop));
      return bucket;
    }
    const definition=getGadgetDefinition(config.type),body=providedBody??createGadgetBody(config),entry:RuntimeEntry={config,body,stateEnteredAtMs:this.elapsedMs,state:{id:config.id,type:config.type,state:config.state??definition.defaultState,role:config.role,properties:{...(config.properties??{})}}};
    if (providedBody && config.physics) {
      const p=config.physics, wasStatic=providedBody.isStatic;
      Matter.Body.setStatic(providedBody,false);
      for (const part of providedBody.parts) {
        if(p.friction!==undefined)part.friction=p.friction;
        if(p.staticFriction!==undefined)part.frictionStatic=p.staticFriction;
        if(p.airFriction!==undefined)part.frictionAir=p.airFriction;
        if(p.restitution!==undefined)part.restitution=p.restitution;
        if(p.isSensor!==undefined)part.isSensor=p.isSensor;
      }
      if (p.massKg!==undefined) Matter.Body.setMass(providedBody,p.massKg);
      else if(p.density!==undefined) Matter.Body.setDensity(providedBody,p.density);
      if (p.inertiaLocked!==undefined) Matter.Body.setInertia(providedBody,p.inertiaLocked?Infinity:providedBody.inertia);
      Matter.Body.setStatic(providedBody,p.isStatic??wasStatic);
    }
    if(providedBody)providedBody.plugin={...providedBody.plugin,machine:{instanceId:config.id,flipX:config.flipX,flipY:config.flipY,type:config.type,state:entry.state.state,role:config.role,properties:entry.state.properties}};
    this.entries.set(config.id,entry);
    if(body){
      this.bodyEntries.set(body.id,entry);
      Matter.Composite.add(this.world,body);
      if(definition.joint?.kind==="pivot")Matter.Composite.add(this.world,Matter.Constraint.create({
        pointA:{x:config.x,y:config.y},bodyB:body,pointB:{x:definition.joint.localX,y:definition.joint.localY},length:0,
        stiffness:definition.joint.stiffness,damping:definition.joint.damping,label:`joint:${config.id}`,
      }));
    }
    return body;
  }

  addConstraint(constraint:Matter.Constraint){Matter.Composite.add(this.world,constraint);return constraint}
  body(id:string){return this.entries.get(id)?.body??null}
  config(id:string){return this.entries.get(id)?.config??null}
  get timeMs(){return this.elapsedMs}
  bodyByRole(role:string){return [...this.entries.values()].find(entry=>entry.state.role===role)?.body??null}
  bodiesByType(type:GadgetInstanceConfig["type"]){return [...this.entries.values()].filter(entry=>entry.config.type===type).flatMap(entry=>entry.body?[entry.body]:[])}
  state(id:string){return this.entries.get(id)?.state??null}
  stateAgeMs(id:string){const entry=this.entries.get(id);return entry?this.elapsedMs-entry.stateEnteredAtMs:null}
  physical(id:string){const config=this.config(id);return config?{...getGadgetDefinition(config.type).physics,...config.physics,...(config.physics?.density!==undefined&&config.physics.massKg===undefined?{massKg:config.physics.density*(this.body(id)?.area??0)}:{})}:null}
  animation(id:string){const entry=this.entries.get(id);return entry?resolveGadgetAnimation(entry.config.type,entry.state.state,this.elapsedMs-entry.stateEnteredAtMs):null}
  allStates(){return [...this.entries.values()].map(entry=>({...entry.state,properties:{...entry.state.properties}}))}
  entities(){return [...this.entries.values()].map(entry=>({
    id:entry.config.id,type:entry.config.type,
    tags:[...new Set([...getGadgetDefinition(entry.config.type).tags,...(entry.config.tags??[])])],
    role:entry.state.role,state:entry.state.state,
    x:entry.body?.position.x??entry.config.x,
    y:entry.body?.position.y??entry.config.y,
    speed:entry.body?.speed??0,
  }))}
  eventHistory():readonly GoalEvent[]{return this.events}
  signal(name:string){return this.signals.get(name)}
  value(name:string){
    if(this.signals.has(name))return this.signals.get(name);
    const separator=name.lastIndexOf(".");if(separator<0)return undefined;
    const id=name.slice(0,separator),property=name.slice(separator+1),entry=this.entries.get(id),body=entry?.body;
    if(property==="state")return entry?.state.state;
    if(!body)return undefined;
    if(property==="x")return body.position.x;
    if(property==="y")return body.position.y;
    if(property==="speed")return body.speed;
    return entry?.state.properties[property];
  }
  goalReached(goal:GoalSpec){return evaluateGoal(goal,{
    signal:name=>this.value(name),
    entities:()=>this.entities(),
    events:()=>this.eventHistory(),
    elapsedMs:this.elapsedMs,
  })}

  subscribe(listener:(event:PhysicsEvent)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener)}
  private emit(event:PhysicsEvent){for(const listener of this.listeners)listener(event)}

  private recordEvent(event:GoalEvent){const key=`${event.name}\0${event.sourceId??""}\0${event.targetId??""}`;if(this.seenEvents.has(key))return;this.seenEvents.add(key);this.events.push(event)}
  setState(id:string,state:string){const entry=this.entries.get(id);if(!entry||entry.state.state===state)return;entry.state.state=state;entry.stateEnteredAtMs=this.elapsedMs;const plugin=entry.body&&machinePlugin(entry.body);if(plugin)plugin.state=state;this.recordEvent({name:"state",sourceId:id});this.emit({type:"state",instanceId:id,state})}
  setSignal(signal:string,value:string|number|boolean=true){if(Object.is(this.signals.get(signal),value))return;this.signals.set(signal,value);this.recordEvent({name:signal});this.emit({type:"signal",signal,value})}
  release(id:string,velocity?:{x:number;y:number}){const body=this.body(id);if(!body)return;Matter.Body.setStatic(body,false);if(velocity)Matter.Body.setVelocity(body,velocity)}

  private processCollision(bodyA:Matter.Body,bodyB:Matter.Body,normal:{x:number;y:number}){
    this.mechanics.collision(bodyA,bodyB);
    this.emit({type:"collision",bodyA,bodyB,normal});
    const a=this.bodyEntries.get(bodyA.id),b=this.bodyEntries.get(bodyB.id);if(!a||!b)return;
    this.recordEvent({name:"contact",sourceId:a.config.id,targetId:b.config.id});
    const relativeVelocity={x:bodyA.velocity.x-bodyB.velocity.x,y:bodyA.velocity.y-bodyB.velocity.y},impactSpeed=Math.max(bodyA.speed,bodyB.speed,Math.hypot(relativeVelocity.x,relativeVelocity.y));
    for(const interaction of resolveInteractions(a.config.type,b.config.type,"collision",{impactSpeed,sourceImpactThreshold:this.physical(a.config.id)?.impactThreshold,targetImpactThreshold:this.physical(b.config.id)?.impactThreshold,sourceX:bodyA.position.x,sourceY:bodyA.position.y,targetX:bodyB.position.x,targetY:bodyB.position.y,sourceState:a.state.state,targetState:b.state.state,relativeVelocity,collisionNormal:normal})) { if (interaction.rule.execution !== undefined) continue; this.applyInteraction(interaction,a,b,bodyA,bodyB); }
  }

  resolve(sourceId:string,targetId:string,trigger:"proximity"|"connection"|"tension"|"continuous"|"state-change",kinematics?:Partial<{impactSpeed:number;relativeVelocity:{x:number;y:number}}>) {
    const source=this.entries.get(sourceId),target=this.entries.get(targetId);if(!source||!target)return[];
    const sourcePosition=source.body?.position??{x:source.config.x,y:source.config.y},targetPosition=target.body?.position??{x:target.config.x,y:target.config.y};
    const interactions=resolveInteractions(source.config.type,target.config.type,trigger,{impactSpeed:kinematics?.impactSpeed??0,sourceX:sourcePosition.x,sourceY:sourcePosition.y,targetX:targetPosition.x,targetY:targetPosition.y,sourceState:source.state.state,targetState:target.state.state,relativeVelocity:kinematics?.relativeVelocity??{x:0,y:0}});
    for(const interaction of interactions)this.applyInteraction(interaction,source,target,source.body,target.body);
    return interactions;
  }

  private applyInteraction(interaction:ResolvedInteraction,a:RuntimeEntry,b:RuntimeEntry,bodyA:Matter.Body|null,bodyB:Matter.Body|null){
    if (interaction.rule.execution !== undefined) return;
    const source=interaction.reversed?b:a,target=interaction.reversed?a:b;
    this.effects.apply(interaction.rule.effect,{
      interaction,
      source:{...source,body:interaction.reversed?bodyB:bodyA},
      target:{...target,body:interaction.reversed?bodyA:bodyB},
      setState:(id,state)=>this.setState(id,state),
      release:(id,velocity)=>this.release(id,velocity),
    });
    if(interaction.rule.signal)this.setSignal(interaction.rule.signal,true);
    this.recordEvent({name:interaction.rule.id,sourceId:source.config.id,targetId:target.config.id});
    this.emit({type:"interaction",interaction,instanceId:source.config.id});
  }

  step(deltaMs:number){
    this.elapsedMs+=deltaMs;
    this.mechanics.beforeStep(deltaMs);
    const active=[...this.entries.values()].filter(entry=>entry.body&&entry.state.state!=="hidden"&&entry.state.state!=="popped");
    for(let left=0;left<active.length;left++)for(let right=left+1;right<active.length;right++){
      const source=active[left],target=active[right],sourceBody=source.body!,targetBody=target.body!,relativeVelocity={x:sourceBody.velocity.x-targetBody.velocity.x,y:sourceBody.velocity.y-targetBody.velocity.y};
      const interactions=resolveInteractions(source.config.type,target.config.type,"proximity",{impactSpeed:Math.hypot(relativeVelocity.x,relativeVelocity.y),sourceX:sourceBody.position.x,sourceY:sourceBody.position.y,targetX:targetBody.position.x,targetY:targetBody.position.y,sourceState:source.state.state,targetState:target.state.state,relativeVelocity});
      for(const interaction of interactions)this.applyInteraction(interaction,source,target,sourceBody,targetBody);
    }
    this.behaviors.step(active,deltaMs);
    const worldBodies=Matter.Composite.allBodies(this.world);
    for(const entry of this.entries.values()){
      const body=entry.body;if(!body||body.isStatic)continue;const definition=getGadgetDefinition(entry.config.type),properties={...definition.physics,...entry.config.physics};
      const rollingOnSupport=definition.tags.includes("rolling")&&Math.abs(body.velocity.y)<1.5&&bodyHasSupport(body,worldBodies,5);
      if(definition.tags.includes("rolling")&&entry.config.physics?.airFriction===undefined)body.frictionAir=rollingOnSupport?ROLLING_AIR_FRICTION:properties.airFriction;
      if(properties.gravityScale!==1){const gravity=this.world.gravity;Matter.Body.applyForce(body,body.position,{x:body.mass*gravity.x*gravity.scale*(properties.gravityScale-1),y:body.mass*gravity.y*gravity.scale*(properties.gravityScale-1)})}
      if(properties.buoyancyForce&&entry.state.state!=="tethered"&&entry.state.state!=="popped")Matter.Body.applyForce(body,body.position,{x:0,y:properties.buoyancyForce*body.mass/.2});
      if(properties.maxSpeed){const speed=Math.hypot(body.velocity.x,body.velocity.y);if(speed>properties.maxSpeed)Matter.Body.setVelocity(body,{x:body.velocity.x/speed*properties.maxSpeed,y:body.velocity.y/speed*properties.maxSpeed})}
    }
    Matter.Engine.update(this.matter,deltaMs);
  }

  destroy(){Matter.Engine.clear(this.matter);this.entries.clear();this.bodyEntries.clear();this.listeners.clear();this.signals.clear();this.events.length=0;this.seenEvents.clear();this.elapsedMs=0}
}
