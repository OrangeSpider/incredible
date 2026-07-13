export const LEVEL_FIVE_LOAD_KG=50;
export const BOWLING_PULL_KG=16;
export const LEVEL_FIVE_TARGET_Y=350;
export const LEVEL_FIVE_INITIAL_WEIGHT_Y=430;
export const LEVEL_FIVE_WEIGHT_HEIGHT=70;
export const PULLEY_GRAVITY_PX=260;
export const PULLEY_DAMPING_PER_SECOND=1.15;

export type PulleyRouteKind="anchor"|"moving"|"fixed"|"pull";
export type DynamicGroup="static"|"ball"|"block";
export type RopePoint={x:number;y:number;group:DynamicGroup};

export type PulleyRouteAnalysis={
  tensioned:boolean;
  open:boolean;
  movingPulleyCount:number;
  supportingStrands:number;
};

/**
 * Any route is legal. It becomes taut only when one end is fixed and the
 * opposite end is the pulling body. Moving pulleys count only when the rope
 * actually passes around them, i.e. while they are internal route nodes.
 */
export function analyzePulleyRoute(route:PulleyRouteKind[]):PulleyRouteAnalysis{
  const first=route[0],last=route.at(-1),tensioned=route.length>=2&&((first==="anchor"&&last==="pull")||(first==="pull"&&last==="anchor"));
  const movingPulleyCount=route.slice(1,-1).filter(kind=>kind==="moving").length;
  return{tensioned,open:!tensioned,movingPulleyCount,supportingStrands:movingPulleyCount*2};
}

export function ropeGeometry(points:RopePoint[]){
  let length=0;const ball={x:0,y:0},block={x:0,y:0};
  const add=(group:DynamicGroup,x:number,y:number)=>{if(group==="ball"){ball.x+=x;ball.y+=y}else if(group==="block"){block.x+=x;block.y+=y}};
  for(let index=0;index<points.length-1;index++){
    const a=points[index],b=points[index+1],dx=a.x-b.x,dy=a.y-b.y,distance=Math.max(1,Math.hypot(dx,dy)),ux=dx/distance,uy=dy/distance;length+=distance;add(a.group,ux,uy);add(b.group,-ux,-uy);
  }
  return{length,ballGradient:ball,blockGradient:block};
}

/** Position correction for a mass-weighted, inextensible but non-pushing rope. */
export function ropeConstraintCorrection(points:RopePoint[],restLength:number,ballMass:number,blockMass:number){
  const geometry=ropeGeometry(points),stretch=Math.max(0,geometry.length-restLength),ballNorm=geometry.ballGradient.x**2+geometry.ballGradient.y**2,blockNorm=geometry.blockGradient.x**2+geometry.blockGradient.y**2,denominator=ballNorm/ballMass+blockNorm/blockMass;
  if(stretch===0||denominator<1e-9)return{stretch:0,ball:{x:0,y:0},block:{x:0,y:0},...geometry};
  return{stretch,ball:{x:-stretch*geometry.ballGradient.x/(ballMass*denominator),y:-stretch*geometry.ballGradient.y/(ballMass*denominator)},block:{x:-stretch*geometry.blockGradient.x/(blockMass*denominator),y:-stretch*geometry.blockGradient.y/(blockMass*denominator)},...geometry};
}

/** Rope friction, axle friction and air drag represented as viscous damping. */
export function dampPulleyVelocity(velocity:{x:number;y:number},seconds:number,damping=PULLEY_DAMPING_PER_SECOND){
  const factor=Math.exp(-Math.max(0,damping)*Math.max(0,seconds)),x=velocity.x*factor,y=velocity.y*factor;return{x:Math.abs(x)<.18?0:x,y:Math.abs(y)<.18?0:y};
}

export const loadRiseFromPull=(pullDistance:number,strands:number)=>strands>0?Math.max(0,pullDistance)/strands:0;

/** The visible top edge of the load, not its hidden centre point, reaches the target. */
export const pulleyTargetReached=(weightCenterY:number,targetY=LEVEL_FIVE_TARGET_Y,weightHeight=LEVEL_FIVE_WEIGHT_HEIGHT)=>weightCenterY-weightHeight/2<=targetY;
