import test from 'node:test';
import assert from 'node:assert/strict';
import { newLevel } from '../levels/authoring.ts';
import { validateLevel } from '../levels/catalog.ts';
import { createSimulation } from '../game/simulation-setup.ts';
import { bodyAnimation, drawGadgetBody } from '../components/game/gadget-body-renderer.ts';
import { createFireGadgetRenderer } from '../components/game/fire-gadget-renderer.ts';
import { drawLoadRope } from '../components/game/load-rope-renderer.ts';
import { drawGadget } from '../components/game/gadget-renderer.ts';
import { GADGET_CATALOG } from '../engine/gadget-catalog.ts';
import Matter from 'matter-js';

function simulation(t,gadgets,extra={}) {
 const result=createSimulation({level:{...newLevel(),fixedGadgets:gadgets,...extra},running:true,onWin(){}});
 t.after(()=>{result.runtime.dispose();result.machine.destroy()});return result;
}
function context() {
 const calls=[];
 const gradient={addColorStop(){}};
 const ctx=new Proxy({calls},{get(target,key){if(key in target)return target[key];if(String(key).startsWith('create'))return ()=>gradient;return (...args)=>calls.push([key,...args]);},set(target,key,value){target[key]=value;return true;}});
 return ctx;
}

test('validation leaves frozen candle data untouched and requires explicit flame geometry',()=>{
 const candle={id:'wax',type:'candle',x:100,y:100,collisionLabel:'ignitionCandle',physics:{height:52}};
 const level={...newLevel(),fixedGadgets:[candle]};Object.freeze(candle.physics);Object.freeze(candle);Object.freeze(level.fixedGadgets);Object.freeze(level);
 const validated=validateLevel(level);
 assert.equal(validated.fixedGadgets[0].properties,undefined);
 assert.notEqual(validated,level);assert.deepEqual(validated,level);
 assert.equal(GADGET_CATALOG.fish.placementState,'flopping');
});

test('separate cat and mouse animations read each current instance state',t=>{
 const {machine}=simulation(t,[{id:'quiet',type:'cat',x:100,y:400},{id:'runner',type:'cat',x:300,y:400},{id:'first',type:'mouse',x:200,y:400},{id:'second',type:'mouse',x:400,y:400}]);
 machine.setState('runner','running');machine.setState('second','running');
 assert.equal(bodyAnimation(machine,'quiet',1000,true).state,'idle');
 assert.equal(bodyAnimation(machine,'runner',1000,true).state,'running');
 assert.equal(bodyAnimation(machine,'first',1000,true).state,'waiting');
 assert.equal(bodyAnimation(machine,'second',1000,true).state,'running');
 machine.state('quiet').properties.fallStartedAt=200;
 assert.equal(bodyAnimation(machine,'quiet',1000,true).state,'falling');
 assert.equal(bodyAnimation(machine,'runner',1000,true).state,'running');
});

test('fire artwork uses instance type despite arbitrary collision labels and independent phases',t=>{
 const {machine}=simulation(t,[{id:'lit',type:'cannon',x:100,y:100,collisionLabel:'custom-a'},{id:'quiet',type:'cannon',x:400,y:100,collisionLabel:'custom-b'},{id:'thread',type:'fuse',x:600,y:100,collisionLabel:'custom-c'}]);
 const previous=globalThis.Image;globalThis.Image=class{complete=true;naturalWidth=600;naturalHeight=300;};t.after(()=>globalThis.Image=previous);
 const ctx=context(),draw=createFireGadgetRenderer(ctx);machine.setState('lit','firing');
 assert.equal(draw(machine.body('lit'),machine,10),true);const flashes=ctx.calls.filter(([key])=>key==='drawImage').length;assert.ok(flashes>0);
 const shot=ctx.calls.find(([key,img])=>key==='drawImage'&&img.src==='/assets/gadget-cartoon-atlas.png');assert.equal(shot[2],200);
 ctx.calls.length=0;assert.equal(draw(machine.body('quiet'),machine,10),true);
 const idle=ctx.calls.filter(([key,img])=>key==='drawImage'&&img.src==='/assets/gadget-cartoon-atlas.png');assert.equal(idle.length,1);assert.equal(idle[0][2],0);
 assert.equal(ctx.calls.filter(([key,img])=>key==='drawImage'&&img.src==='/assets/fire-animation-sprites.png').length,0);
 assert.equal(draw(machine.body('thread'),machine,10),true);assert.ok(ctx.calls.some(([key])=>key==='lineTo'));
});

test('active hamster wheel keeps a fixed housing, rotates its wheel and anchors Louis',t=>{
 const {machine}=simulation(t,[{id:'wheel',type:'hamsterWheel',x:200,y:200,state:'running'}]);
 machine.step(270);
 const ctx=context(),states=[],placements=[];
 drawGadgetBody(ctx,machine.body('wheel'),machine,270,true,(_ctx,animation,x,y)=>{states.push(animation?.state);placements.push([x,y,animation?.definition.kind==='sprite'?animation.definition.asset:null]);return true;},()=>false);
 assert.deepEqual(states,['idle','running']);
 assert.deepEqual(placements,[
  [0,0,'/assets/hamster-wheel-sprites.png'],
  [1,7,'/assets/hamster-running-sprites.png'],
 ]);
 assert.ok(ctx.calls.some(([key,x,y,r])=>key==='arc'&&x===0&&y===0&&r===46));
 assert.ok(ctx.calls.some(([key])=>key==='clip'));
 assert.ok(ctx.calls.some(([key,angle])=>key==='rotate'&&Math.abs(angle-270*Math.PI*2/900)<1e-9));
});

test('full body rendering keeps cannon artwork under the local fire effects',t=>{
 const {machine}=simulation(t,[{id:'gun',type:'cannon',x:100,y:100},{id:'wick',type:'fuse',x:300,y:100,state:'burning'}]);
 const previous=globalThis.Image;globalThis.Image=class{complete=true;naturalWidth=600;naturalHeight=400;};t.after(()=>globalThis.Image=previous);
 const ctx=context(),fire=createFireGadgetRenderer(ctx),sprite=()=>assert.fail('a flame sprite must not replace a fire gadget body');
 drawGadgetBody(ctx,machine.body('gun'),machine,0,false,sprite,fire);
 assert.ok(ctx.calls.some(([key,img])=>key==='drawImage'&&img.src==='/assets/gadget-cartoon-atlas.png'));
 ctx.calls.length=0;machine.step(16);drawGadgetBody(ctx,machine.body('wick'),machine,16,true,sprite,fire);
 assert.ok(ctx.calls.some(([key,img])=>key==='drawImage'&&img.src==='/assets/fire-animation-sprites.png'));
 assert.ok(ctx.calls.filter(([key])=>key==='stroke').length>40,'braided cord remains visible around the flame fronts');
});

test('gear drawing follows current instance rotor angle and stops after detachment',t=>{
 const {machine,runtime}=simulation(t,[{id:'motor',type:'gearSource',x:100,y:100},{id:'receiver',type:'gear',x:184,y:100}]);runtime.tick(16,16);
 const phase=machine.state("receiver").properties.rotorAngle;assert.ok(phase<0);
 const receiver=machine.body('receiver');assert.equal(machine.state('receiver').state,'running');
 Matter.Body.setPosition(receiver,{x:400,y:100});runtime.tick(32,16);assert.equal(machine.state('receiver').state,'idle');
 assert.equal(machine.state("receiver").properties.rotorAngle,phase);
 const ctx=context();drawGadgetBody(ctx,receiver,machine,32,true,()=>false,()=>false);
 assert.equal(ctx.calls.find(([key])=>key==='rotate')[1],receiver.angle);
});

test('two scissor handle visuals use independent instance progress',t=>{
 const {machine}=simulation(t,[{id:'a',type:'scissor',x:100,y:100},{id:'b',type:'scissor',x:300,y:100}]);
 machine.state('a').properties['handleProgress:handle']=.8;machine.state('b').properties['handleProgress:handle']=.1;
 const a=context(),b=context();drawGadget(a,machine.body('a'),machine,100,true);drawGadget(b,machine.body('b'),machine,100,true);
 assert.notDeepEqual(a.calls.find(([key])=>key==='moveTo'),b.calls.find(([key])=>key==='moveTo'));
});

test('load rope anchor rendering follows explicit data independently of scene name',()=>{
 const ctx=context(),anchor={x:420,y:140};
 drawLoadRope(ctx,0,false,anchor,[{kind:'anchor'}],new Map(),new Map(),[],null,{supportingStrands:0,tensioned:false});
 assert.ok(ctx.calls.some(([key,x,y])=>key==='arc'&&x===420&&y===140));
 assert.ok(ctx.calls.some(([key,x,y])=>key==='moveTo'&&x===420&&y===110));
});
