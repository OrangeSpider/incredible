import test from 'node:test';
import assert from 'node:assert/strict';
import { newLevel } from '../levels/authoring.ts';
import { createSimulation } from '../game/simulation-setup.ts';
import { bodyAnimation, drawGadgetBody } from '../components/game/gadget-body-renderer.ts';
import { CAT_STARTLE_DURATION_MS } from '../game/cat.ts';

function scene(t,gadgets,extra={}){
 const result=createSimulation({level:{...newLevel(),fixedGadgets:gadgets,goal:{kind:'signal',name:'never'},...extra},running:true,onWin(){}});
 t.after(()=>{result.runtime.dispose();result.machine.destroy()});
 const step=(frames=1)=>{for(let i=0;i<frames;i++)result.runtime.tick(result.machine.timeMs+16,16)};
 return {...result,step};
}
const blast={id:'tnt',type:'tnt',x:400,y:456,state:'burning'};
const cat=(id,x,extra={})=>({id,type:'cat',x,y:456,...extra});

test('TNT startles every exposed cat, then they face and run away in opposite directions',t=>{
 const {machine,step}=scene(t,[blast,cat('left',290),cat('right',510,{flipX:true,physics:{isStatic:true}}),cat('far',680)]);
 step(41);
 for(const id of ['left','right']){
  assert.equal(machine.state(id).state,'startled');assert.equal(bodyAnimation(machine,id,0,true).row,2);
  assert.equal(machine.body(id).isStatic,false);
 }
 assert.equal(machine.state('far').state,'idle');
 step(14);assert.equal(bodyAnimation(machine,'left',0,true).frame,1);
 step(14);assert.equal(bodyAnimation(machine,'left',0,true).frame,2);
 step(14);
 assert.equal(machine.state('left').state,'running');assert.equal(machine.state('right').state,'running');
 assert.equal(bodyAnimation(machine,'left',0,true).row,1);
 const left=machine.body('left').position.x,right=machine.body('right').position.x;
 step(15);assert.ok(machine.body('left').position.x<left-20);assert.ok(machine.body('right').position.x>right+20);
 for(const [id,direction] of [['left',-1],['right',1]]){
  const scales=[],ctx={save(){},restore(){},translate(){},rotate(){},scale(x,y){scales.push([x,y])}};
  drawGadgetBody(ctx,machine.body(id),machine,0,true,()=>true,()=>false);
  assert.deepEqual(scales,[[direction,1]],'the sprite faces its world-space escape direction');
 }
 step(180);assert.equal(machine.state('left').properties.blastStartledAt,undefined);
 assert.equal(machine.state('left').state,'idle');assert.equal(machine.body('left').velocity.x,0);
 const resting=machine.body('left').position;
 machine.addGadget({id:'new-bait',type:'fish',x:resting.x+80,y:resting.y,state:'flopping'});
 machine.resolve('new-bait','left','proximity');
 assert.ok(machine.body('left').velocity.x>0);assert.equal(machine.state('left').state,'running','a fish chase uses the running animation');assert.equal(machine.state('left').properties.facingDirection,1,'a subsequent chase turns the cat back toward its prey');
});

test('walls shield cats and an extinguished TNT fuse never frightens them',t=>{
 const {machine,step}=scene(t,[blast,cat('shielded',510),{id:'wall',type:'stoneWall',x:455,y:415,physics:{height:130}}]);
 step(100);assert.equal(machine.state('tnt').state,'exploded');assert.equal(machine.state('shielded').state,'idle');
 const wet=scene(t,[{...blast,state:'extinguished'},cat('dry-cat',510)]);wet.step(100);
 assert.equal(wet.machine.state('dry-cat').state,'idle');assert.equal(wet.machine.signal('cat.startled.dry-cat'),undefined);
});

test('explosion escape takes priority over fish attraction and configured mouse chasing',t=>{
 for(const kind of ['fish','mouse']){
  const extra=kind==='fish'?{fishChases:[{catId:'cat',fishId:'bait'}]}:{animalChases:[{catId:'cat',mouseId:'bait',exitId:'exit'}]};
  const {machine,step}=scene(t,[blast,cat('cat',290),{id:'bait',type:kind,x:340,y:456,state:kind==='fish'?'flopping':'waiting'},{id:'exit',type:'exit',x:800,y:450}],extra);
  step(41);assert.equal(machine.state('cat').state,'startled');
  step(Math.ceil(CAT_STARTLE_DURATION_MS/16)+10);
  assert.equal(machine.state('cat').state,'running');assert.ok(machine.body('cat').velocity.x<0,'the cat must flee left instead of chasing bait to the right');
 }
});

test('another nearby explosion restarts the shock animation and updates the escape direction',t=>{
 const {machine,step}=scene(t,[blast,cat('cat',510)]);step(10);
 machine.addGadget({id:'second',type:'tnt',x:machine.body('cat').position.x+100,y:456,state:'burning'});
 step(41);
 assert.equal(machine.state('second').state,'exploded');assert.equal(machine.state('cat').state,'startled');
 assert.equal(bodyAnimation(machine,'cat',0,true).frame,0);
 assert.equal(machine.state('cat').properties.blastFleeDirection,-1);
});
