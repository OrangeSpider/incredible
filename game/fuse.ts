export type FusePoint={x:number;y:number};
export type FuseSegment={id:string;start:FusePoint;end:FusePoint;burnDurationMs?:number;samples?:number};
export type FuseSample={t:number;burned:boolean};

type SegmentState={definition:FuseSegment;burnAt:number[]};

const distance=(a:FusePoint,b:FusePoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const pointOn=(segment:FuseSegment,t:number):FusePoint=>({
  x:segment.start.x+(segment.end.x-segment.start.x)*t,
  y:segment.start.y+(segment.end.y-segment.start.y)*t,
});

/**
 * A fuse is sampled into closely spaced ignition points. Every ignition point
 * propagates in both directions. Active flame fronts may ignite any nearby
 * point on another fuse, so branches and crossings arise from geometry rather
 * than placement order.
 */
export class FuseNetwork{
  private readonly states=new Map<string,SegmentState>();
  private readonly fireRadius:number;
  private readonly flameLifetimeMs:number;

  constructor(segments:FuseSegment[],fireRadius=22,flameLifetimeMs=100){
    this.fireRadius=fireRadius;this.flameLifetimeMs=flameLifetimeMs;
    for(const definition of segments){
      const samples=Math.max(3,definition.samples??23);
      this.states.set(definition.id,{definition,burnAt:Array(samples).fill(Infinity)});
    }
  }

  private igniteIndex(state:SegmentState,index:number,now:number){
    const duration=state.definition.burnDurationMs??1200;
    const step=duration/(state.burnAt.length-1);
    for(let candidate=0;candidate<state.burnAt.length;candidate++){
      state.burnAt[candidate]=Math.min(state.burnAt[candidate],now+Math.abs(candidate-index)*step);
    }
  }

  ignite(id:string,t:number,now:number){
    const state=this.states.get(id);if(!state)return;
    const index=Math.round(Math.max(0,Math.min(1,t))*(state.burnAt.length-1));
    this.igniteIndex(state,index,now);
  }

  igniteNear(point:FusePoint,radius:number,now:number){
    for(const state of this.states.values()){
      let nearestIndex=0,nearestDistance=Infinity;
      for(let index=0;index<state.burnAt.length;index++){
        const t=index/(state.burnAt.length-1),candidateDistance=distance(point,pointOn(state.definition,t));
        if(candidateDistance<nearestDistance){nearestDistance=candidateDistance;nearestIndex=index}
      }
      if(nearestDistance<=radius)this.igniteIndex(state,nearestIndex,now);
    }
  }

  update(now:number){
    // A newly ignited branch can touch another branch in the same frame.
    for(let pass=0;pass<4;pass++){
      let changed=false;
      const flames:[string,FusePoint][]=[];
      for(const [id,state] of this.states)for(let index=0;index<state.burnAt.length;index++){
        const age=now-state.burnAt[index];
        if(age>=0&&age<=this.flameLifetimeMs)flames.push([id,pointOn(state.definition,index/(state.burnAt.length-1))]);
      }
      for(const [sourceId,flame] of flames)for(const [targetId,state] of this.states){
        if(targetId===sourceId)continue;
        let nearestIndex=0,nearestDistance=Infinity;
        for(let index=0;index<state.burnAt.length;index++){
          const candidateDistance=distance(flame,pointOn(state.definition,index/(state.burnAt.length-1)));
          if(candidateDistance<nearestDistance){nearestDistance=candidateDistance;nearestIndex=index}
        }
        if(nearestDistance<=this.fireRadius&&state.burnAt[nearestIndex]>now){this.igniteIndex(state,nearestIndex,now);changed=true}
      }
      if(!changed)break;
    }
  }

  hasAnyBurned(now:number){
    return[...this.states.values()].some(state=>state.burnAt.some(time=>time<=now));
  }

  burnTimeAt(id:string,t:number){
    const state=this.states.get(id);if(!state)return Infinity;
    return state.burnAt[Math.round(Math.max(0,Math.min(1,t))*(state.burnAt.length-1))];
  }

  hasBurnedEnd(id:string,now:number){return this.burnTimeAt(id,1)<=now}

  snapshot(id:string,now:number):{samples:FuseSample[];flames:number[]}{
    const state=this.states.get(id);if(!state)return{samples:[],flames:[]};
    const samples=state.burnAt.map((time,index)=>({t:index/(state.burnAt.length-1),burned:time<=now}));
    const active=state.burnAt.flatMap((time,index)=>{const age=now-time;return age>=0&&age<=this.flameLifetimeMs?[index]:[]});
    const flames:number[]=[];
    for(const index of active){
      const t=index/(state.burnAt.length-1),last=flames.at(-1);
      if(last===undefined||t-last>2/(state.burnAt.length-1))flames.push(t);else flames[flames.length-1]=(last+t)/2;
    }
    return{samples,flames};
  }
}
