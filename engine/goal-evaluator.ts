import type {ComposableGoalSpec,EntityPredicate,GoalComparison,GoalEntity,GoalEvent,GoalSelector,GoalSpec,LegacyGoalSpec} from "./types.ts";

/** A read-only snapshot of the running machine. Events and signals are historical facts. */
export type GoalContext={
  signal:(name:string)=>string|number|boolean|undefined;
  entities:()=>readonly GoalEntity[];
  events?:()=>readonly GoalEvent[];
  elapsedMs?:number;
  completed?:boolean;
};

function compare(actual:unknown,operator:GoalComparison,value:unknown):boolean{
  if(operator==="equals")return actual===value;
  if(typeof actual!=="number"||typeof value!=="number")return false;
  if(operator==="above")return actual>value;
  if(operator==="below")return actual<value;
  if(operator==="atLeast")return actual>=value;
  return actual<=value;
}

function matches(entity:GoalEntity,selector:GoalSelector):boolean{
  return (selector.id===undefined||entity.id===selector.id)
    &&(selector.type===undefined||entity.type===selector.type)
    &&(selector.tag===undefined||entity.tags?.includes(selector.tag)===true)
    &&(selector.role===undefined||entity.role===selector.role);
}

function matchingEntities(selector:GoalSelector,context:GoalContext):readonly GoalEntity[]{
  return context.entities().filter(entity=>matches(entity,selector));
}

function matchesId(id:string|undefined,selector:GoalSelector|undefined,context:GoalContext):boolean{
  return selector===undefined||(id!==undefined&&context.entities().some(entity=>entity.id===id&&matches(entity,selector)));
}

function predicateMatches(entity:GoalEntity,predicate:EntityPredicate):boolean{
  if(predicate.kind==="state")return entity.state===predicate.state;
  return compare(entity[predicate.axis],predicate.operator,predicate.value);
}

function evaluateComposable(goal:ComposableGoalSpec,context:GoalContext):boolean{
  switch(goal.kind){
    case "signal":{
      const actual=context.signal(goal.name);
      return goal.operator===undefined||goal.operator==="occurred"?actual===true:compare(actual,goal.operator,goal.value);
    }
    case "event":{
      const recorded=context.events?.().some(event=>event.name===goal.name
        &&matchesId(event.sourceId,goal.source,context)
        &&matchesId(event.targetId,goal.target,context))??false;
      return recorded||(!goal.source&&!goal.target&&context.signal(goal.name)===true);
    }
    case "state":return matchingEntities(goal.selector,context).some(entity=>entity.state===goal.state);
    case "position":return matchingEntities(goal.selector,context).some(entity=>compare(entity[goal.axis],goal.operator,goal.value));
    case "contact":return context.events?.().some(event=>event.name==="contact"&&(
      (matchesId(event.sourceId,goal.source,context)&&matchesId(event.targetId,goal.target,context))||
      (matchesId(event.sourceId,goal.target,context)&&matchesId(event.targetId,goal.source,context))
    ))??false;
    case "zone":return context.events?.().some(event=>
      (event.name==="zone.entered"&&matchesId(event.sourceId,goal.entity,context)&&matchesId(event.targetId,goal.zone,context))
      ||(event.name==="contact"&&(
        (matchesId(event.sourceId,goal.entity,context)&&matchesId(event.targetId,goal.zone,context))||
        (matchesId(event.targetId,goal.entity,context)&&matchesId(event.sourceId,goal.zone,context))
      )))??false;
    case "all":return goal.goals.length>0&&goal.goals.every(child=>evaluateComposable(child,context));
    case "any":return goal.goals.some(child=>evaluateComposable(child,context));
    case "count":{
      const count=matchingEntities(goal.selector,context).filter(entity=>!goal.where||predicateMatches(entity,goal.where)).length;
      return goal.operator==="exactly"?count===goal.value:goal.operator==="atLeast"?count>=goal.value:count<=goal.value;
    }
    case "never":return !evaluateComposable(goal.goal,context)
      &&(goal.afterMs===undefined||typeof context.elapsedMs==="number"&&context.elapsedMs>=goal.afterMs)
      &&(goal.until===undefined||evaluateComposable(goal.until,context));
  }
}

function evaluateLegacy(goal:LegacyGoalSpec,context:GoalContext):boolean{
  if(goal.mode==="event")return Boolean(goal.event&&context.signal(goal.event)===true);
  const results=(goal.conditions??[]).map(condition=>{
    const actual=context.signal(condition.signal);
    if(condition.operator==="occurred")return actual===true;
    return compare(actual,condition.operator,condition.value);
  });
  return results.length>0&&(goal.mode==="any"?results.some(Boolean):results.every(Boolean));
}

export function evaluateGoal(goal:GoalSpec,context:GoalContext):boolean{
  return "mode" in goal?evaluateLegacy(goal,context):evaluateComposable(goal,context);
}
