export type GadgetType=
  |"ball"|"tennisBall"|"ramp"|"belt"|"fan"|"trampoline"|"pulley"|"movingPulley"|"rope"|"needle"|"mouse"|"gear"|"cannon"|"fuse"|"bucket"|"seesaw"
  |"hamsterWheel"|"conveyor"|"exit"|"balloon"|"candle"|"targetRing"|"basket"|"weight"|"cat"|"gearSource"|"gearTarget"|"cannonTarget"
  |"steelBeam"|"woodWall"|"stoneWall"|"payloadBall"|"fishBowl"|"fish"|"scissor"|"water"|"cannonball"|"rocket";

export type PlaceableGadgetType=Extract<GadgetType,"ball"|"tennisBall"|"ramp"|"belt"|"fan"|"trampoline"|"pulley"|"movingPulley"|"rope"|"needle"|"mouse"|"gear"|"cannon"|"fuse"|"bucket"|"seesaw">;

export type GadgetCategory="dynamic"|"fixed"|"animal"|"fluid"|"force-source"|"force-transfer"|"connector"|"trigger"|"target"|"fire"|"container"|"surface";
export type BodyShape="circle"|"rectangle"|"compound"|"sensor"|"none";
export type WaterReaction="collide"|"float"|"flee"|"extinguish"|"collect"|"ignore";
export type FireReaction="none"|"ignite"|"extinguish-source"|"explode"|"melt";
export type ImpactReaction="bounce"|"roll"|"stop"|"break"|"close"|"transfer"|"trigger"|"none";

export type PhysicalProperties={
  shape:BodyShape;
  width?:number;
  height?:number;
  radius?:number;
  massKg:number;
  density:number;
  friction:number;
  staticFriction:number;
  airFriction:number;
  restitution:number;
  gravityScale:number;
  isStatic:boolean;
  isSensor:boolean;
  inertiaLocked?:boolean;
  maxSpeed?:number;
  buoyancyForce?:number;
  impactThreshold?:number;
  waterReaction:WaterReaction;
  fireReaction:FireReaction;
  impactReaction:ImpactReaction;
};

export type SpriteAnimation={
  kind:"sprite";
  asset:string;
  row:number;
  frames:number;
  columns:number;
  frameDurationMs:number;
  width:number;
  height:number;
  anchorX?:number;
  anchorY?:number;
  loop:boolean;
};

export type CanvasAnimation={
  kind:"canvas";
  renderer:string;
  frames?:number;
  frameDurationMs?:number;
  loop?:boolean;
};

export type GadgetAnimation=SpriteAnimation|CanvasAnimation;

export type GadgetDefinition={
  type:GadgetType;
  displayName:string;
  icon:string;
  description:string;
  categories:GadgetCategory[];
  tags:string[];
  physics:PhysicalProperties;
  appearance:{renderer:string;color?:string;outline?:string};
  joint?:{kind:"pivot";localX:number;localY:number;stiffness:number;damping:number};
  defaultState:string;
  animations:Record<string,GadgetAnimation>;
  defaultRotation?:number;
  rotatable:boolean;
  removable:boolean;
};

export type GadgetPhysicsOverride=Partial<PhysicalProperties>;

export type GadgetInstanceConfig={
  id:string;
  type:GadgetType;
  x:number;
  y:number;
  rotation?:number;
  state?:string;
  role?:string;
  tags?:string[];
  collisionLabel?:string;
  physics?:GadgetPhysicsOverride;
  properties?:Record<string,string|number|boolean>;
};

export type InventoryEntry={type:PlaceableGadgetType;count:number};

export type LegacyGoalSpec={
  mode:"event"|"all"|"any"|"state"|"position";
  event?:string;
  conditions?:Array<{signal:string;operator:"occurred"|"equals"|"above"|"below";value?:string|number|boolean}>;
};

/** A selector matches every supplied field. At least one field is required by validation. */
export type GoalSelector={id?:string;type?:GadgetType;tag?:string;role?:string};
export type GoalEntity={id:string;type:GadgetType;tags?:readonly string[];role?:string;state?:string;x?:number;y?:number};
export type GoalEvent={name:string;sourceId?:string;targetId?:string};
export type GoalComparison="equals"|"above"|"below"|"atLeast"|"atMost";
export type EntityPredicate=
  |{kind:"state";state:string}
  |{kind:"position";axis:"x"|"y";operator:GoalComparison;value:number};
export type ComposableGoalSpec=
  |{kind:"signal";name:string;operator?:"occurred"|GoalComparison;value?:string|number|boolean}
  |{kind:"event";name:string;source?:GoalSelector;target?:GoalSelector}
  |{kind:"state";selector:GoalSelector;state:string}
  |{kind:"position";selector:GoalSelector;axis:"x"|"y";operator:GoalComparison;value:number}
  |{kind:"contact";source:GoalSelector;target:GoalSelector}
  |{kind:"zone";entity:GoalSelector;zone:GoalSelector}
  |{kind:"all"|"any";goals:ComposableGoalSpec[]}
  |{kind:"count";selector:GoalSelector;where?:EntityPredicate;operator:"atLeast"|"atMost"|"exactly";value:number}
  |{kind:"never";goal:ComposableGoalSpec;afterMs?:number;until?:ComposableGoalSpec};
export type GoalSpec=LegacyGoalSpec|ComposableGoalSpec;

export type LevelDefinition={
  schemaVersion:1|2;
  id:string;
  number:number;
  scene:string;
  title:string;
  objective:string;
  hint:string;
  buildTip:string;
  successText:string;
  inventory:InventoryEntry[];
  fixedGadgets:GadgetInstanceConfig[];
  initialPlacements?:GadgetInstanceConfig[];
  systems:string[];
  goal:GoalSpec;
};

export type GadgetRuntimeState={
  id:string;
  type:GadgetType;
  state:string;
  role?:string;
  properties:Record<string,string|number|boolean>;
};
