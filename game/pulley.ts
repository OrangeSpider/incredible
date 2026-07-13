export const LEVEL_FIVE_LOAD_KG=50;
export const BOWLING_PULL_KG=16;
export const LEVEL_FIVE_TARGET_Y=330;
export const PULLEY_GRAVITY_PX=260;

export type PulleyRouteKind="anchor"|"moving"|"fixed"|"pull";

export type PulleyRouteAnalysis={
  validPrefix:boolean;
  complete:boolean;
  movingPulleyCount:number;
  supportingStrands:number;
  next:"anchor"|"moving"|"fixed"|"moving-or-pull"|"complete";
};

/**
 * One continuous rope is reeved as
 * anchor -> moving -> fixed -> [moving -> fixed]... -> pull body.
 * The route, not the inventory, determines the supporting strands.
 */
export function analyzePulleyRoute(route:PulleyRouteKind[]):PulleyRouteAnalysis{
  if(route.length===0)return{validPrefix:true,complete:false,movingPulleyCount:0,supportingStrands:0,next:"anchor"};
  if(route[0]!=="anchor")return{validPrefix:false,complete:false,movingPulleyCount:0,supportingStrands:0,next:"anchor"};
  let movingPulleyCount=0,validPrefix=true,complete=false;
  for(let index=1;index<route.length;index++){
    const kind=route[index];
    if(index%2===1){
      if(kind==="moving")movingPulleyCount++;
      else if(kind==="pull"&&index===route.length-1&&index>=3)complete=true;
      else validPrefix=false;
    }else if(kind!=="fixed")validPrefix=false;
  }
  if(route.at(-1)==="pull"&&!complete)validPrefix=false;
  const next=!validPrefix?"anchor":complete?"complete":route.length===1?"moving":route.length%2===1?"moving-or-pull":"fixed";
  return{validPrefix,complete:validPrefix&&complete,movingPulleyCount,supportingStrands:movingPulleyCount*2,next};
}

/**
 * Generalized acceleration for an ideal rope. q grows when the pull body moves
 * down; the load then rises by q/N. A negative result means the load side wins.
 */
export function ropePullAcceleration(inputKg:number,loadKg:number,strands:number,gravity=PULLEY_GRAVITY_PX){
  if(strands<=0)return 0;
  const effectiveMass=inputKg+loadKg/(strands*strands);
  return gravity*(inputKg-loadKg/strands)/effectiveMass;
}

export const loadRiseFromPull=(pullDistance:number,strands:number)=>strands>0?Math.max(0,pullDistance)/strands:0;
