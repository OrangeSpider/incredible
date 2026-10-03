import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {createScenario,loadLevel} from './helpers/machine-scenario.mjs';
const level = gadgets => ({...loadLevel(20),floor:false,systems:['scissors','seesaw','catapult','seesaw-launch','trampoline'],fixedGadgets:gadgets,goal:{kind:'signal',name:'never'}});
const contact=(machine,a,b)=>Matter.Events.trigger(machine.matter,'collisionStart',{pairs:[{bodyA:machine.body(a),bodyB:machine.body(b),collision:{normal:{x:0,y:1}}}]});

test('independent cannon ignition registers each projectile for type, tag and id selectors',()=>{
  const s=createScenario(level([
    {id:'a',type:'cannon',x:100,y:200},{id:'b',type:'cannon',x:500,y:200},
    {id:'fire-a',type:'candle',x:82,y:208,properties:{flameOffsetY:-50}},
    {id:'fire-b',type:'candle',x:482,y:208,state:'unlit',properties:{flameOffsetY:-50}},
  ]));
  s.step(110);
  assert.equal(s.machine.state('a').state,'firing');assert.equal(s.machine.state('b').state,'idle');
  assert.equal(s.machine.bodiesByType('cannonball').length,1);
  s.machine.setState('fire-b','burning');s.step(150);
  assert.equal(s.machine.bodiesByType('cannonball').length,2);
  for(const selector of [{type:'cannonball'},{tag:'projectile'},{id:'b:shot'}])assert.equal(s.machine.goalReached({kind:'state',selector,state:'flying'}),true);
  assert.equal(s.machine.goalReached({kind:'state',selector:{tag:'unknown-projectile'},state:'flying'}),false);
  assert.equal(s.machine.signal('cannon.fired.a'),true);assert.equal(s.machine.signal('cannon.fired.b'),true);
  s.step(100);assert.equal(s.machine.bodiesByType('cannonball').length,2);
  s.runtime.dispose();s.machine.destroy();
});

test('wet fuse stops only its own flame propagation',()=>{
  const s=createScenario(level([
    {id:'wet',type:'fuse',x:100,y:100,state:'extinguished'},
    {id:'dry',type:'fuse',x:500,y:100,state:'burning'},
    {id:'gun',type:'cannon',x:573,y:142},
  ]));s.step(200);
  assert.equal(s.machine.state('wet').state,'extinguished');
  assert.equal(s.machine.mechanics.fuseSnapshot('wet').samples.some(p=>p.burned),false);
  assert.equal(s.machine.state('gun').state,'firing');
  s.runtime.dispose();s.machine.destroy();
});

test('combined trampoline, scissor and seesaw execute each effect once',()=>{
  const s=createScenario(level([
    {id:'ball',type:'ball',x:50,y:50},{id:'spring',type:'trampoline',x:50,y:100},
    {id:'cut',type:'scissor',x:50,y:100,properties:{balloon:'lift'}},
    {id:'lift',type:'balloon',x:150,y:50,state:'tethered',physics:{isStatic:true}},
    {id:'plank',type:'seesaw',x:150,y:100},
  ]));
  let bounce=0,close=0,release=0,plankKicks=0;
  const unsubscribe=s.machine.subscribe(e=>{if(e.type==='interaction'&&e.interaction.rule.effect==='bounce')bounce++;if(e.type==='state'&&e.instanceId==='cut')close++;if(e.type==='state'&&e.instanceId==='lift')release++;});
  const original=Matter.Body.setAngularVelocity;Matter.Body.setAngularVelocity=(body,v)=>{if(body===s.machine.body('plank'))plankKicks++;return original(body,v)};
  try{
    Matter.Body.setVelocity(s.machine.body('ball'),{x:0,y:5});contact(s.machine,'ball','spring');assert.equal(bounce,1);
    Matter.Body.setVelocity(s.machine.body('ball'),{x:0,y:5});contact(s.machine,'ball','cut');contact(s.machine,'ball','cut');
    assert.equal(close,1);assert.equal(release,1);assert.equal(s.machine.state('lift').state,'free');
    contact(s.machine,'ball','plank');assert.equal(plankKicks,1);
    // Calling a metadata-only spatial rule must not add a second kick.
    s.machine.resolve('ball','plank','state-change');assert.equal(plankKicks,1);
  }finally{Matter.Body.setAngularVelocity=original;unsubscribe();s.runtime.dispose();s.machine.destroy();}
});
