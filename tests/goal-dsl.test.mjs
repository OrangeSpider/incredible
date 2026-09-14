import assert from "node:assert/strict";
import test from "node:test";
import {evaluateGoal} from "../engine/goal-evaluator.ts";
import {LEVELS,validateLevel} from "../levels/catalog.ts";

const entities=[
  {id:"rocket-1",type:"rocket",role:"payload",tags:["flammable"],state:"launched",x:100,y:-40},
  {id:"rocket-2",type:"rocket",role:"payload",tags:["flammable"],state:"launched",x:200,y:-35},
  {id:"rocket-3",type:"rocket",role:"payload",tags:["flammable"],state:"idle",x:300,y:100},
  {id:"basket",type:"basket",role:"goal",tags:["goal-zone"],state:"idle",x:400,y:400},
];

function context({signals={},events=[],elapsedMs=0,items=entities}={}){
  return {signal:name=>signals[name],entities:()=>items,events:()=>events,elapsedMs};
}

test("count selects gadgets by type, role and state without enumerating their IDs",()=>{
  const goal={kind:"count",selector:{type:"rocket",role:"payload"},where:{kind:"state",state:"launched"},operator:"atLeast",value:3};
  assert.equal(evaluateGoal(goal,context()),false);
  assert.equal(evaluateGoal(goal,context({items:entities.map(entity=>entity.id==="rocket-3"?{...entity,state:"launched"}:entity)})),true);
  assert.equal(evaluateGoal({...goal,operator:"exactly",value:2},context()),true);
});

test("composed protection goal waits for completion and rejects any recorded violation",()=>{
  const goal={kind:"all",goals:[
    {kind:"signal",name:"payload.delivered"},
    {kind:"never",goal:{kind:"event",name:"fish.bowl.broken"},until:{kind:"signal",name:"payload.delivered"}},
  ]};
  assert.equal(evaluateGoal(goal,context()),false);
  assert.equal(evaluateGoal(goal,context({signals:{"payload.delivered":true}})),true);
  assert.equal(evaluateGoal(goal,context({signals:{"payload.delivered":true},events:[{name:"fish.bowl.broken"}]})),false);
  assert.equal(evaluateGoal({kind:"never",goal:{kind:"signal",name:"fish.bowl.broken"},afterMs:5000},context({elapsedMs:4999})),false);
  assert.equal(evaluateGoal({kind:"never",goal:{kind:"signal",name:"fish.bowl.broken"},afterMs:5000},context({elapsedMs:5000})),true);
});

test("event, contact and zone selectors identify participants independently of ID spelling",()=>{
  const contact={kind:"contact",source:{type:"rocket",tag:"flammable"},target:{role:"goal",tag:"goal-zone"}};
  assert.equal(evaluateGoal(contact,context({events:[{name:"contact",sourceId:"basket",targetId:"rocket-2"}]})),true);
  assert.equal(evaluateGoal(contact,context({events:[{name:"contact",sourceId:"basket",targetId:"rocket-2"}],items:entities.filter(entity=>entity.id!=="rocket-2")})),false);
  assert.equal(evaluateGoal({kind:"zone",entity:{id:"rocket-1"},zone:{id:"basket"}},context({events:[{name:"zone.entered",sourceId:"rocket-1",targetId:"basket"}]})),true);
  assert.equal(evaluateGoal({kind:"zone",entity:{id:"rocket-1"},zone:{tag:"goal-zone"}},context({events:[{name:"contact",sourceId:"basket",targetId:"rocket-1"}]})),true);
  assert.equal(evaluateGoal({kind:"event",name:"state",source:{id:"rocket-1"}},context({events:[{name:"state",sourceId:"rocket-1"}]})),true);
});

test("position and state predicates are evaluated against the current snapshot",()=>{
  const goal={kind:"all",goals:[
    {kind:"state",selector:{id:"rocket-1"},state:"launched"},
    {kind:"position",selector:{id:"rocket-1"},axis:"y",operator:"below",value:-30},
  ]};
  assert.equal(evaluateGoal(goal,context()),true);
  assert.equal(evaluateGoal(goal,context({items:entities.map(entity=>entity.id==="rocket-1"?{...entity,y:0}:entity)})),false);
});

test("legacy version-1 goals still validate and evaluate",()=>{
  assert.equal(LEVELS.length,15);
  assert.ok(LEVELS.every(level=>level.schemaVersion===2&&"kind" in level.goal));
  const old=structuredClone(LEVELS[0]);
  old.schemaVersion=1;
  old.goal={mode:"event",event:"cat.entered.exit"};
  assert.deepEqual(validateLevel(old),old);
  assert.equal(evaluateGoal(old.goal,context({signals:{"cat.entered.exit":true}})),true);
});

test("recursive validation rejects vacuous and structurally unsafe goals",()=>{
  const level=structuredClone(LEVELS[0]);
  for(const goal of [
    {kind:"all",goals:[]},
    {kind:"state",selector:{},state:"running"},
    {kind:"state",selector:{id:"typo"},state:"running"},
    {kind:"count",selector:{type:"rocket"},operator:"atLeast",value:-1},
    {kind:"never",goal:{kind:"signal",name:"payload.lost"}},
    {kind:"never",goal:{kind:"signal",name:"payload.lost"},afterMs:0},
    {kind:"all",goals:[{kind:"signal",name:"ready"},{kind:"what"}]},
  ])assert.throws(()=>validateLevel({...level,goal}));
  assert.throws(()=>validateLevel({...level,systems:["unknown-physics-system"]}));
});
