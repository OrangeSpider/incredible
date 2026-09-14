import Matter from "matter-js";

export const SEESAW_WIDTH=232.5;
export const SEESAW_HEIGHT=18;
export const SEESAW_MAX_ANGLE=22*Math.PI/180;

export type SeesawAssembly={plank:Matter.Body;pivot:Matter.Constraint};

export function createSeesaw(x:number,y:number,angle:number):SeesawAssembly{
  const plank=Matter.Bodies.rectangle(x,y,SEESAW_WIDTH,SEESAW_HEIGHT,{
    angle,label:"seesaw",density:.0032,friction:.7,frictionStatic:.85,restitution:.08,chamfer:{radius:5},
  });
  const pivot=Matter.Constraint.create({
    pointA:{x,y},bodyB:plank,pointB:{x:0,y:0},length:0,stiffness:1,damping:.16,label:"seesawPivot",
  });
  return{plank,pivot};
}

export function applySeesawImpact(engine:Matter.Engine,plank:Matter.Body,impactBody:Matter.Body){
  const impactSide=Math.sign(impactBody.position.x-plank.position.x)||1;
  const angularKick=Math.min(.24,Math.max(.08,Math.abs(impactBody.velocity.y)*.018));
  // Matter.js dreht bei positiven Winkeln im Uhrzeigersinn. Ein Treffer links
  // braucht daher eine negative Drehung: links abwärts, rechts aufwärts.
  Matter.Body.setAngularVelocity(plank,impactSide*angularKick);
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

export function limitSeesawRotation(plank:Matter.Body){
  if(plank.angle>SEESAW_MAX_ANGLE){Matter.Body.setAngle(plank,SEESAW_MAX_ANGLE);if(plank.angularVelocity>0)Matter.Body.setAngularVelocity(plank,0)}
  if(plank.angle<-SEESAW_MAX_ANGLE){Matter.Body.setAngle(plank,-SEESAW_MAX_ANGLE);if(plank.angularVelocity<0)Matter.Body.setAngularVelocity(plank,0)}
}
