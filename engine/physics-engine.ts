import Matter from "matter-js";
import {createGadgetBody,machinePlugin} from "./body-factory.ts";
import {getGadgetDefinition} from "./gadget-catalog.ts";
import {resolveInteractions,type ResolvedInteraction} from "./interaction-rules.ts";
import {evaluateGoal} from "./goal-evaluator.ts";
import type {GadgetInstanceConfig,GadgetRuntimeState,GoalSpec,LevelDefinition} from "./types.ts";

export type PhysicsEvent={type:"interaction"|"state"|"signal";interaction?:ResolvedInteraction;instanceId?:string;state?:string;signal?:string;value?:string|number|boolean};

type RuntimeEntry={config:GadgetInstanceConfig;body:Matter.Body|null;state:GadgetRuntimeState};

export class MachinePhysicsEngine{
  readonly matter=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}});
  readonly world=this.matter.world;
  private entries=new Map<string,RuntimeEntry>();
  private bodyEntries=new Map<number,RuntimeEntry>();
  private listeners=new Set<(event:PhysicsEvent)=>void>();
  private signals=new Map<string,string|number|boolean>();

  constructor(level?:LevelDefinition){
    Matter.Events.on(this.matter,"collisionStart",event=>event.pairs.forEach(pair=>this.processCollision(pair.bodyA,pair.bodyB,pair.collision.normal)));
    if(level)this.loadLevel(level);
  }

  loadLevel(level:LevelDefinition){
    for(const gadget of level.fixedGadgets)this.addGadget(gadget);
  }

  addGadget(config:GadgetInstanceConfig){
    if(this.entries.has(config.id))throw new Error(`Duplicate gadget id: ${config.id}`);
    const definition=getGadgetDefinition(config.type),body=createGadgetBody(config),entry:RuntimeEntry={config,body,state:{id:config.id,type:config.type,state:config.state??definition.defaultState,role:config.role,properties:{...(config.properties??{})}}};
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
  bodyByRole(role:string){return [...this.entries.values()].find(entry=>entry.state.role===role)?.body??null}
  bodiesByType(type:GadgetInstanceConfig["type"]){return [...this.entries.values()].filter(entry=>entry.config.type===type).flatMap(entry=>entry.body?[entry.body]:[])}
  state(id:string){return this.entries.get(id)?.state??null}
  allStates(){return [...this.entries.values()].map(entry=>({...entry.state,properties:{...entry.state.properties}}))}
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
  goalReached(goal:GoalSpec){return evaluateGoal(goal,{signal:name=>this.value(name)})}

  subscribe(listener:(event:PhysicsEvent)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener)}
  private emit(event:PhysicsEvent){for(const listener of this.listeners)listener(event)}

  setState(id:string,state:string){const entry=this.entries.get(id);if(!entry)return;entry.state.state=state;const plugin=entry.body&&machinePlugin(entry.body);if(plugin)plugin.state=state;this.emit({type:"state",instanceId:id,state})}
  setSignal(signal:string,value:string|number|boolean=true){this.signals.set(signal,value);this.emit({type:"signal",signal,value})}
  release(id:string,velocity?:{x:number;y:number}){const body=this.body(id);if(!body)return;Matter.Body.setStatic(body,false);if(velocity)Matter.Body.setVelocity(body,velocity)}

  private processCollision(bodyA:Matter.Body,bodyB:Matter.Body,normal:{x:number;y:number}){
    const a=this.bodyEntries.get(bodyA.id),b=this.bodyEntries.get(bodyB.id);if(!a||!b)return;
    const relativeVelocity={x:bodyA.velocity.x-bodyB.velocity.x,y:bodyA.velocity.y-bodyB.velocity.y},impactSpeed=Math.max(bodyA.speed,bodyB.speed,Math.hypot(relativeVelocity.x,relativeVelocity.y));
    for(const interaction of resolveInteractions(a.config.type,b.config.type,"collision",{impactSpeed,sourceX:bodyA.position.x,sourceY:bodyA.position.y,targetX:bodyB.position.x,targetY:bodyB.position.y,relativeVelocity,collisionNormal:normal}))this.applyInteraction(interaction,a,b,bodyA,bodyB);
  }

  resolve(sourceId:string,targetId:string,trigger:"proximity"|"connection"|"tension"|"continuous"|"state-change",kinematics?:Partial<{impactSpeed:number;relativeVelocity:{x:number;y:number}}>) {
    const source=this.entries.get(sourceId),target=this.entries.get(targetId);if(!source||!target)return[];
    const sourcePosition=source.body?.position??{x:source.config.x,y:source.config.y},targetPosition=target.body?.position??{x:target.config.x,y:target.config.y};
    const interactions=resolveInteractions(source.config.type,target.config.type,trigger,{impactSpeed:kinematics?.impactSpeed??0,sourceX:sourcePosition.x,sourceY:sourcePosition.y,targetX:targetPosition.x,targetY:targetPosition.y,relativeVelocity:kinematics?.relativeVelocity??{x:0,y:0}});
    for(const interaction of interactions)this.applyInteraction(interaction,source,target,source.body,target.body);
    return interactions;
  }

  private applyInteraction(interaction:ResolvedInteraction,a:RuntimeEntry,b:RuntimeEntry,bodyA:Matter.Body|null,bodyB:Matter.Body|null){
    const source=interaction.reversed?b:a,target=interaction.reversed?a:b,sourceBody=interaction.reversed?bodyB:bodyA,targetBody=interaction.reversed?bodyA:bodyB;
    const stateEntry=interaction.rule.stateTarget==="source"?source:target;
    const effect=interaction.rule.effect;
    if(effect==="pop")this.setState(stateEntry.config.id,"popped");
    if(effect==="close")this.setState(stateEntry.config.id,"closed");
    if(effect==="break")this.setState(stateEntry.config.id,"broken");
    if(effect==="ignite")this.setState(stateEntry.config.id,"burning");
    if(effect==="extinguish")this.setState(stateEntry.config.id,"extinguished");
    if(effect==="start")this.setState(stateEntry.config.id,"running");
    if(effect==="cut"){this.setState(target.config.id,"free");this.release(target.config.id,{x:0,y:-1.2})}
    if(effect==="fire")this.setState(target.config.id,"firing");
    if(effect==="transport"&&source.state.state==="running"&&sourceBody&&targetBody&&!targetBody.isStatic){const speed=Number(source.state.properties.speed??3.4),direction=Number(source.state.properties.direction??1);Matter.Body.setVelocity(targetBody,{x:Math.cos(sourceBody.angle)*speed*direction,y:targetBody.velocity.y})}
    if(effect==="push"&&sourceBody&&targetBody&&!targetBody.isStatic){
      const dx=targetBody.position.x-sourceBody.position.x,dy=targetBody.position.y-sourceBody.position.y,c=Math.cos(sourceBody.angle),s=Math.sin(sourceBody.angle),forward=dx*c+dy*s,side=-dx*s+dy*c,maxDistance=interaction.rule.maxDistance??420;
      if(forward<=0||forward>maxDistance||Math.abs(side)>=100+forward*.3)return;
      const referenceMass=.2,force=(interaction.rule.impulseScale??.00035)*(1-forward/maxDistance)*targetBody.mass/referenceMass;
      Matter.Body.applyForce(targetBody,targetBody.position,{x:c*force,y:s*force});
    }
    if(effect==="flee"&&sourceBody&&targetBody&&!targetBody.isStatic){const direction=Math.sign(targetBody.position.x-sourceBody.position.x)||1;Matter.Body.setVelocity(targetBody,{x:direction*2.8,y:targetBody.velocity.y})}
    if(effect==="chase"&&sourceBody&&targetBody&&!targetBody.isStatic){const direction=Math.sign(sourceBody.position.x-targetBody.position.x)||1;Matter.Body.setVelocity(targetBody,{x:direction*2.2,y:targetBody.velocity.y})}
    if(effect==="transfer-rotation"&&targetBody){const angular=sourceBody?.angularVelocity||.08;Matter.Body.setAngularVelocity(targetBody,-angular);this.setState(target.config.id,"running")}
    if(effect==="collect")this.setState(source.config.id,"collected");
    if(effect==="bounce"&&sourceBody&&targetBody){const angle=targetBody.angle;Matter.Body.setVelocity(sourceBody,{x:Math.sin(angle)*20,y:-Math.abs(Math.cos(angle))*20})}
    if(effect==="transfer-impulse"&&sourceBody&&targetBody){const side=Math.sign(sourceBody.position.x-targetBody.position.x)||1;Matter.Body.setAngularVelocity(targetBody,side*Math.min(.24,Math.max(.08,Math.abs(sourceBody.velocity.y)*.018)))}
    if(interaction.rule.signal)this.setSignal(interaction.rule.signal,true);
    this.emit({type:"interaction",interaction,instanceId:source.config.id});
  }

  step(deltaMs:number){
    const active=[...this.entries.values()].filter(entry=>entry.body&&entry.state.state!=="hidden"&&entry.state.state!=="popped");
    for(let left=0;left<active.length;left++)for(let right=left+1;right<active.length;right++){
      const source=active[left],target=active[right],sourceBody=source.body!,targetBody=target.body!,relativeVelocity={x:sourceBody.velocity.x-targetBody.velocity.x,y:sourceBody.velocity.y-targetBody.velocity.y};
      const interactions=resolveInteractions(source.config.type,target.config.type,"proximity",{impactSpeed:Math.hypot(relativeVelocity.x,relativeVelocity.y),sourceX:sourceBody.position.x,sourceY:sourceBody.position.y,targetX:targetBody.position.x,targetY:targetBody.position.y,relativeVelocity});
      for(const interaction of interactions)this.applyInteraction(interaction,source,target,sourceBody,targetBody);
    }
    // A running conveyor is a continuous contact source. Collision-start alone
    // would only impart one short impulse and the transported object would slow
    // down again because of friction.
    for(const conveyor of active.filter(entry=>entry.config.type==="conveyor"&&entry.state.state==="running")){
      const beltBody=conveyor.body!,speed=Number(conveyor.state.properties.speed??3.4),direction=Number(conveyor.state.properties.direction??1);
      for(const target of active){
        const targetBody=target.body!;
        if(target===conveyor||targetBody.isStatic)continue;
        const overlapsX=targetBody.bounds.max.x>=beltBody.bounds.min.x&&targetBody.bounds.min.x<=beltBody.bounds.max.x;
        const bottom=targetBody.bounds.max.y,top=beltBody.bounds.min.y;
        if(overlapsX&&bottom>=top-9&&bottom<=top+18&&targetBody.bounds.min.y<top){
          Matter.Body.setVelocity(targetBody,{x:Math.cos(beltBody.angle)*speed*direction,y:Math.min(targetBody.velocity.y,.35)});
        }
      }
    }
    for(const entry of this.entries.values()){
      const body=entry.body;if(!body||body.isStatic)continue;const definition=getGadgetDefinition(entry.config.type),properties={...definition.physics,...entry.config.physics};
      if(properties.gravityScale!==1){const gravity=this.world.gravity;Matter.Body.applyForce(body,body.position,{x:body.mass*gravity.x*gravity.scale*(properties.gravityScale-1),y:body.mass*gravity.y*gravity.scale*(properties.gravityScale-1)})}
      if(properties.buoyancyForce&&entry.state.state!=="tethered"&&entry.state.state!=="popped")Matter.Body.applyForce(body,body.position,{x:0,y:properties.buoyancyForce*body.mass/.2});
      if(properties.maxSpeed){const speed=Math.hypot(body.velocity.x,body.velocity.y);if(speed>properties.maxSpeed)Matter.Body.setVelocity(body,{x:body.velocity.x/speed*properties.maxSpeed,y:body.velocity.y/speed*properties.maxSpeed})}
    }
    Matter.Engine.update(this.matter,deltaMs);
  }

  destroy(){Matter.Engine.clear(this.matter);this.entries.clear();this.bodyEntries.clear();this.listeners.clear();this.signals.clear()}
}
