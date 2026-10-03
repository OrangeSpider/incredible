import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {newLevel,removeGadget} from '../levels/authoring.ts';
import {validateLevel} from '../levels/catalog.ts';
import {createSimulation} from '../game/simulation-setup.ts';
import {GADGET_CATALOG} from '../engine/gadget-catalog.ts';
import {portKey} from '../engine/gadget-ports.ts';
import {createScenario,loadLevel} from './helpers/machine-scenario.mjs';
const config=(id,type,x,y,extra={})=>({id,type,x,y,...extra});
const scene=(gadgets,extra={})=>({...newLevel(),floor:false,fixedGadgets:gadgets,...extra});
function setup(t,level,options={}) {
 const s=createSimulation({level,running:true,onWin:()=>{},...options});
 t.after(()=>{s.runtime.dispose();s.machine.destroy()});
 s.machine.matter.gravity.y=0;
 return {...s,tick:()=>s.runtime.tick(s.machine.timeMs+16,16)};
}
const belt=(sourceId,targetId,targetPortId='drive')=>({id:`${sourceId}:${targetId}`,kind:'belt',sourceId,targetId,sourcePortId:'drive',targetPortId});
const contact=(m,a,b)=>m.processCollision(m.body(a),m.body(b),{x:0,y:1});

test('editor gadgets activate without system labels and wheels drive independent live belts',t=>{
 const s=setup(t,scene([
  config('renamed-A','hamsterWheel',100,100),config('renamed-B','hamsterWheel',700,100),
  config('belt-A','conveyor',200,300),config('belt-B','conveyor',700,300),config('impactor','basketball',20,100),
 ]));
 Matter.Body.setVelocity(s.machine.body('impactor'),{x:4,y:0});contact(s.machine,'impactor','renamed-A');s.tick();
 assert.equal(s.machine.state('renamed-A').state,'running');assert.equal(s.machine.state('renamed-B').state,'idle');
 s.machine.connections=[belt('renamed-A','belt-A','left'),belt('renamed-B','belt-B','right')];s.tick();
 assert.equal(s.machine.state('belt-A').state,'running');assert.equal(s.machine.state('belt-B').state,'idle');
 s.machine.connections=[];s.tick();assert.equal(s.machine.state('belt-A').state,'idle');
 s.machine.connections=[belt('renamed-A','belt-A','right')];s.tick();assert.equal(s.machine.state('belt-A').state,'running');
});

test('drive cannot persist in detached gear islands, and mixed belt mesh chains reconnect',t=>{
 const s=setup(t,scene([config('motor','hamsterWheel',20,20,{state:'running'}),config('g1','gear',200,200),config('g2','gear',284,200),config('goal','gearTarget',368,200),config('other','gearTarget',700,200)],{connections:[belt('motor','g1')]}));
 s.tick();for(const id of ['g1','g2','goal'])assert.equal(s.machine.state(id).state,'running');
 assert.equal(s.machine.state('other').state,'idle');assert.ok(s.machine.body('g1').angularVelocity*s.machine.body('g2').angularVelocity<0);
 Matter.Body.setPosition(s.machine.body('g2'),{x:550,y:200});s.tick();
 for(const id of ['g2','goal']) {assert.equal(s.machine.state(id).state,'idle');assert.equal(s.machine.body(id).angularVelocity,0)}
 Matter.Body.setPosition(s.machine.body('g2'),{x:284,y:200});s.tick();assert.equal(s.machine.state('goal').state,'running');
 s.machine.setState('motor','idle');s.tick();for(const id of ['g1','g2','goal'])assert.equal(s.machine.state(id).state,'idle');
 s.machine.setState('motor','running');s.tick();assert.equal(s.machine.state('goal').state,'running');
 s.machine.connections=[];s.tick();for(const id of ['g1','g2','goal'])assert.equal(s.machine.state(id).state,'idle');
});

test('placed and moved scissors close once and release only explicit balloons',t=>{
 const s=setup(t,scene([config('float-A','balloon',100,50,{state:'tethered',physics:{isStatic:true}}),config('float-B','balloon',500,50,{state:'tethered',physics:{isStatic:true}}),config('cut-A','scissor',100,200,{properties:{balloon:'float-A'}})]),{placed:[{id:7,configId:'cut-B',type:'scissor',x:500,y:200,rotation:.4,properties:{balloon:'float-B'}}]});
 Matter.Body.setPosition(s.machine.body('cut-B'),{x:600,y:220});s.machine.setState('cut-B','closed');
 assert.equal(s.machine.state('float-B').state,'free');assert.equal(s.machine.body('float-B').isStatic,false);assert.equal(s.machine.state('float-A').state,'tethered');
 const at=s.runtime.scissorClosedById.get('cut-B');s.tick();assert.equal(s.runtime.scissorClosedById.get('cut-B'),at);
 s.machine.setState('cut-A','closed');assert.equal(s.runtime.scissorClosedById.size,2);assert.equal(s.machine.state('float-A').state,'free');
});

test('named control ports keep independent progress and invoke their own defined effects',t=>{
 const old=GADGET_CATALOG.snapGate.ports;t.after(()=>GADGET_CATALOG.snapGate.ports=old);
 GADGET_CATALOG.snapGate.ports=()=>[{id:'release',kind:'target',action:'open',local:{x:0,y:0},label:'release'},{id:'observe',kind:'target',local:{x:0,y:50},label:'observe'}];
 const ropes=['release','observe'].map((targetPortId,i)=>({targetId:'latch',targetPortId,guides:[],source:{gadgetId:`load-${i}`,portId:'pull'}}));
 const s=setup(t,scene([config('latch','snapGate',100,100),config('load-0','basketball',200,100),config('load-1','basketball',200,150)],{controlRopes:ropes}));
 Matter.Body.setPosition(s.machine.body('load-1'),{x:220,y:150});s.tick();
 assert.equal(s.machine.state('latch').state,'closed');assert.equal(s.machine.state('latch').properties['handleProgress:observe'],1);assert.equal(s.machine.state('latch').properties['handleProgress:release'],0);
 assert.equal(s.machine.signal(`rope.pulled.${portKey({gadgetId:'latch',portId:'observe'})}`),true);
 Matter.Body.setPosition(s.machine.body('load-0'),{x:220,y:100});s.tick();assert.equal(s.machine.state('latch').state,'open');
});

test('light geometry and device active states are independent of artwork and renderer names',t=>{
 const old=GADGET_CATALOG.flashlight.appearance.renderer;t.after(()=>GADGET_CATALOG.flashlight.appearance.renderer=old);
 GADGET_CATALOG.flashlight.appearance.renderer='new-artwork';
 const s=setup(t,scene([config('light','flashlight',50,100,{state:'on'}),config('lens','magnifier',180,100)]));s.tick();
 const light=s.machine.mechanics.lights.find(light=>light.id==='light');assert.equal(light.x,88);assert.equal(light.radius,360);assert.equal(light.angle,0);assert.equal(s.machine.state('lens').state,'focusing');
 const active=GADGET_CATALOG.socketFan.electrical.activeState;t.after(()=>GADGET_CATALOG.socketFan.electrical.activeState=active);GADGET_CATALOG.socketFan.electrical.activeState='running-custom';
 const powered=setup(t,scene([config('gen','generator',400,400,{state:'running'}),config('fan','socketFan',600,400)],{connections:[{id:'wire',kind:'wire',sourceId:'gen',sourcePortId:'power',targetId:'fan',targetPortId:'socket'}]}));powered.tick();assert.equal(powered.machine.state('fan').state,'running-custom');
});

test('behavior overrides affect contact thresholds and physical motion; descriptive reactions are rejected',t=>{
 const s=setup(t,scene([config('soft','scissor',100,200,{physics:{impactThreshold:1}}),config('hard','scissor',400,200,{physics:{impactThreshold:10}}),config('ball','ball',100,150,{physics:{gravityScale:0,maxSpeed:2,massKg:3,restitution:.9}}),config('glass','fishBowl',700,200,{physics:{impactThreshold:2}})]));
 Matter.Body.setVelocity(s.machine.body('ball'),{x:0,y:3});contact(s.machine,'ball','soft');contact(s.machine,'ball','hard');
 assert.equal(s.machine.state('soft').state,'closed');assert.equal(s.machine.state('hard').state,'open');
 Matter.Body.setPosition(s.machine.body('ball'),{x:700,y:150});contact(s.machine,'ball','glass');assert.equal(s.machine.state('glass').state,'breaking');
 s.tick();assert.equal(s.machine.body('ball').mass,3);assert.equal(s.machine.body('ball').restitution,.9);assert.ok(s.machine.body('ball').speed<=2.001);
 assert.throws(()=>validateLevel(scene([config('bad','ball',100,100,{physics:{fireReaction:'ignite'}})])),/physics/);
});

test('two explicit animal pairs use their own gates and shifted destinations',t=>{
 const gadgets=[];for(let i=0;i<2;i++) gadgets.push(config(`cat-${i}`,'cat',100,100+i*200,{physics:{isStatic:true}}),config(`mouse-${i}`,'mouse',200,100+i*200,{physics:{isStatic:true}}),config(`exit-${i}`,'exit',400+i*200,100+i*200),config(`gate-${i}`,'snapGate',300,100+i*200));
 const s=setup(t,scene(gadgets,{animalChases:[0,1].map(i=>({catId:`cat-${i}`,mouseId:`mouse-${i}`,exitId:`exit-${i}`,gateId:`gate-${i}`}))}));
 for(let i=0;i<130;i++)s.tick();const blocked=s.machine.body('mouse-1').position.x;
 s.machine.setState('gate-0','open');for(let i=0;i<160;i++)s.tick();
 assert.ok(s.machine.body('mouse-0').position.x>=375);assert.equal(s.machine.body('mouse-1').position.x,blocked);assert.equal(s.machine.signal('mouse.entered.hole.mouse-0'),true);assert.equal(s.machine.signal('mouse.entered.hole.mouse-1'),undefined);
});

test('translated catapult scene with renamed IDs retains the shared simulation solution',t=>{
 const base=loadLevel(12),rename=id=>`new-${id}`;
 const level={...base,fixedGadgets:base.fixedGadgets.map(g=>({...g,id:rename(g.id),x:g.x-80,y:g.y-30,collisionLabel:'art-label'})),catapults:base.catapults.map(flow=>Object.fromEntries(Object.entries(flow).map(([key,id])=>[key,rename(id)]))),goal:{kind:'signal',name:'mouse.entered.hole'}};
 const s=createScenario(level,[{type:'ball',x:125,y:80}]);t.after(()=>{s.runtime.dispose();s.machine.destroy()});s.step(900);
 assert.equal(s.won,true);assert.ok(s.machine.body('new-joanne').position.y<260);assert.equal(s.machine.state('new-mogli').state,'running');
});

test('load route selects its explicit weight and anchor, uses body mass, and rejects ambiguous pulls',t=>{
 const level=scene([config('unrelated','weight',100,100),config('load','weight',600,350,{physics:{massKg:80}})],{loadRope:{weightId:'load',anchor:{x:300,y:40}}});
 const placed=[{id:1,type:'movingPulley',x:400,y:250,rotation:0},{id:2,type:'pulley',x:600,y:70,rotation:0},{id:3,type:'ball',x:650,y:280,rotation:0}];
 const ropePath=[{kind:'anchor'},...[1,2,3].map(placedId=>({kind:'part',placedId}))];const s=setup(t,level,{placed,ropePath});
 assert.deepEqual(s.runtime.options.rope.physicsPoints()[0],{x:300,y:40,group:'static'});assert.equal(s.runtime.options.rope.initialWeightY,350);s.tick();assert.deepEqual(s.machine.body('unrelated').position,{x:100,y:100});assert.equal(s.machine.physical('load').massKg,80);
 assert.throws(()=>createSimulation({level,placed:[...placed,{...placed[2],id:4}],ropePath:[...ropePath,{kind:'part',placedId:4}],running:true,onWin:()=>{}}),/one pulling body/);
});

test('relationships validate types, reject shared fish, and are pruned by editor deletion',()=>{
 const level=scene([config('c','cat',100,100),config('f','fish',200,100)],{fishChases:[{catId:'c',fishId:'f'}]});assert.doesNotThrow(()=>validateLevel(level));assert.throws(()=>validateLevel({...level,fishChases:[{catId:'missing',fishId:'f'}]}),/reference/);
 assert.deepEqual(removeGadget(level,'f').fishChases,[]);
 assert.throws(()=>validateLevel(scene([config('f','fish',200,100),...['a','b'].map(id=>config(id,'fishBowl',200,100,{properties:{fishId:'f'}}))])),/Duplicate fish/);
});

test('a wheel driven by another wheel loses drive until it is activated independently',t=>{
 const s=setup(t,scene([config('source','hamsterWheel',100,100,{state:'running'}),config('receiver','hamsterWheel',500,100)],{connections:[belt('source','receiver')]}));s.tick();assert.equal(s.machine.state('receiver').state,'running');
 s.machine.connections=[];s.tick();assert.equal(s.machine.state('receiver').state,'idle');
 s.machine.addGadget(config('impact','ball',700,100));Matter.Body.setVelocity(s.machine.body('impact'),{x:4,y:0});contact(s.machine,'impact','receiver');s.tick();assert.equal(s.machine.state('receiver').state,'running');
});

test('compound bucket overrides and density overrides affect the registered physical bodies',t=>{
 const s=setup(t,scene([config('b','bucket',100,100,{physics:{isStatic:false,massKg:9,friction:.12,staticFriction:.2,restitution:.6,inertiaLocked:true,width:152,height:128}}),config('dense','basketball',500,100,{physics:{density:.003}})]));
 const bucket=s.machine.body('b');assert.equal(bucket.isStatic,false);assert.equal(bucket.mass,9);assert.equal(bucket.friction,.12);assert.equal(bucket.restitution,.6);assert.equal(bucket.inertia,Infinity);assert.ok(bucket.bounds.max.x-bucket.bounds.min.x>140);
 assert.equal(s.machine.body('dense').mass,s.machine.body('dense').area*.003);assert.equal(s.machine.physical('dense').massKg,s.machine.body('dense').mass);
});

test('explicit fish relations release independent fish and cats chase their assigned fish',t=>{
 const gadgets=[0,1].flatMap(i=>[config(`bowl-${i}`,'fishBowl',400,100+i*200,{properties:{fishId:`fish-${i}`}}),config(`fish-${i}`,'fish',400,100+i*200,{physics:{isStatic:true}}),config(`cat-${i}`,'cat',100,100+i*200,{physics:{isStatic:true}})]);
 const s=setup(t,scene(gadgets,{fishChases:[0,1].map(i=>({catId:`cat-${i}`,fishId:`fish-${i}`}))}));
 s.machine.setState('bowl-1','broken');for(let i=0;i<50;i++)s.tick();
 assert.equal(s.machine.state('fish-0').state,'hidden');assert.equal(s.machine.state('fish-1').state,'flopping');assert.equal(s.machine.body('cat-0').position.x,100);assert.ok(s.machine.body('cat-1').position.x>100);assert.equal(s.machine.bodiesByType('fish').length,2);
});


test('level 7 movable mouse has an explicit stable relationship and wins after repositioning',t=>{
 const level=loadLevel("07"),mouse=level.initialPlacements[0];
 const s=createScenario(level,[{...mouse,id:971234,configId:mouse.id,x:400,y:370}]);t.after(()=>{s.runtime.dispose();s.machine.destroy()});s.step(600);assert.equal(s.won,true);
});

