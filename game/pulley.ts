export const PULLEY_EFFICIENCY=0.85;
export const LEVEL_FIVE_LOAD_KG=50;
export const BOWLING_PULL_KG=16;
export const LEVEL_FIVE_TARGET_Y=330;

/** A moving pulley contributes two rope sections that support the load. */
export const supportingStrands=(movingPulleyCount:number)=>Math.max(0,Math.floor(movingPulleyCount))*2;

/** Constant rope length: the free end travels N times as far as the load. */
export const loadRiseFromPull=(pullDistance:number,strands:number)=>strands>0?Math.max(0,pullDistance)/strands:0;

export const availableLiftKg=(inputKg:number,strands:number,efficiency=PULLEY_EFFICIENCY)=>Math.max(0,inputKg)*Math.max(0,strands)*Math.max(0,efficiency);

export const canLift=(inputKg:number,loadKg:number,strands:number,efficiency=PULLEY_EFFICIENCY)=>availableLiftKg(inputKg,strands,efficiency)>=loadKg;
