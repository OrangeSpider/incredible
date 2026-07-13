import Matter from "matter-js";

export const SEESAW_WIDTH=232.5;
export const SEESAW_HEIGHT=18;
export const SEESAW_END_INSET=10;

export type SeesawAssembly={plank:Matter.Body;pivot:Matter.Constraint};
export type SeesawRope={anchor:{x:number;y:number};side:-1|1;constraint:Matter.Constraint;startLength:number};

export function createSeesaw(x:number,y:number,angle:number):SeesawAssembly{
  const plank=Matter.Bodies.rectangle(x,y,SEESAW_WIDTH,SEESAW_HEIGHT,{
    angle,label:"seesaw",density:.0032,friction:.7,frictionStatic:.85,restitution:.08,chamfer:{radius:5},
  });
  const pivot=Matter.Constraint.create({
    pointA:{x,y},bodyB:plank,pointB:{x:0,y:0},length:0,stiffness:1,damping:.16,label:"seesawPivot",
  });
  return{plank,pivot};
}

export function seesawEndpoint(plank:Matter.Body,side:-1|1){
  const localX=side*(SEESAW_WIDTH/2-SEESAW_END_INSET);
  return{x:plank.position.x+Math.cos(plank.angle)*localX,y:plank.position.y+Math.sin(plank.angle)*localX};
}

export function createSeesawRope(plank:Matter.Body,anchor:{x:number;y:number}):SeesawRope{
  const relativeX=(anchor.x-plank.position.x)*Math.cos(plank.angle)+(anchor.y-plank.position.y)*Math.sin(plank.angle);
  const side: -1|1=relativeX<0?-1:1;
  const pointB={x:side*(SEESAW_WIDTH/2-SEESAW_END_INSET),y:0};
  const endpoint=seesawEndpoint(plank,side);
  const startLength=Math.max(36,Math.hypot(anchor.x-endpoint.x,anchor.y-endpoint.y));
  const constraint=Matter.Constraint.create({pointA:anchor,bodyB:plank,pointB,length:startLength,stiffness:.72,damping:.12,label:"seesawRope"});
  return{anchor,side,constraint,startLength};
}

export function shortenSeesawRope(rope:SeesawRope,elapsedMs:number){
  rope.constraint.length=Math.max(34,rope.startLength-elapsedMs*.045);
}

export function applySeesawImpact(engine:Matter.Engine,plank:Matter.Body,impactBody:Matter.Body){
  const impactSide=Math.sign(impactBody.position.x-plank.position.x)||1;
  const angularKick=Math.min(.24,Math.max(.08,Math.abs(impactBody.velocity.y)*.018));
  Matter.Body.setAngularVelocity(plank,-impactSide*angularKick);
  let accelerated=0;
  for(const candidate of Matter.Composite.allBodies(engine.world)){
    if(candidate.isStatic||candidate===impactBody||candidate===plank)continue;
    const dx=candidate.position.x-plank.position.x,dy=candidate.position.y-plank.position.y;
    const localX=dx*Math.cos(plank.angle)+dy*Math.sin(plank.angle);
    if(Math.sign(localX)===-impactSide&&Math.abs(localX)<SEESAW_WIDTH*.9&&Math.abs(dy)<120){
      Matter.Body.setVelocity(candidate,{x:-impactSide*1.1,y:-Math.min(16,10+Math.abs(impactBody.velocity.y)*.65)});
      accelerated++;
    }
  }
  return accelerated;
}
