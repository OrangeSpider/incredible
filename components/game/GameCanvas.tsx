"use client";

import { drawGadgetBody } from "./gadget-body-renderer";
import { createFireGadgetRenderer } from "./fire-gadget-renderer";
import { drawLoadRope, drawLoadRopePorts } from "./load-rope-renderer";
import { useEffect, useRef } from "react";
import Matter from "matter-js";
import type { PendingControlRope } from "@/game/control-ropes";
import { drawControlRopes } from "./control-rope-renderer";
import type { LevelDefinition, PlaceableGadgetType } from "@/engine/types";
import type { PlacedGadget, RopeNode, ScissorRope } from "./types";
import { placedConfigId } from "./types";
import { createCatalogSpriteRenderer } from "./catalog-sprite-renderer";
import { createFluidWaterRenderer } from "./fluid-water-renderer";
import { drawFields, drawConnections, drawConnectionPorts } from "./gadget-renderer";
import type { GadgetConnection } from "@/engine/types";

import { createSimulation } from "@/game/simulation-setup";

type GameCanvasProps = {
  level: LevelDefinition;
  placed: PlacedGadget[];
  ropePath: RopeNode[];
  scissorRopes: ScissorRope[];
  pendingScissor: PendingControlRope | null;
  ropeMode: boolean;
  selectedTool: PlaceableGadgetType | null;
  selectedId: number | null;
  connections: GadgetConnection[];
  selectedConnection: string | null;
  pendingConnection: string | null;
  selectedRope: string | null;
  running: boolean;
  attempt: number;
  onWin: () => void;
};

export default function GameCanvas({ level, placed, ropePath, scissorRopes, pendingScissor, ropeMode, selectedTool, selectedId, connections, selectedConnection, pendingConnection, selectedRope, running, attempt, onWin }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ROPE_ANCHOR = level.loadRope?.anchor;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const drawCatalogSprite = createCatalogSpriteRenderer();
    const drawFluidWater = createFluidWaterRenderer(canvas.width, canvas.height);
    const drawFireGadget = createFireGadgetRenderer(ctx);
    const {machine, runtime, placedById, bodyByPlacedId, routeAnalysis} = createSimulation({
      level, placed, connections, controlRopes: scissorRopes, ropePath, running, onWin,
    });
    const engine = machine.matter;
    const W = 900, H = 520;
    const waterBodies = machine.bodiesByType("water");
    const {moving: routeMoving, physicsPoints} = runtime.options.rope;
    const weight = runtime.options.bodies.weight;
    let raf=0,last=performance.now();
    const render = (now:number) => {
      const dt = Math.min(32, now-last); last=now;
      runtime.tick(now, dt);
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#f4e5c0";ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(66,94,96,.11)";ctx.lineWidth=1; for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()} for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      if (level.floor !== false) { ctx.fillStyle="#98612e";ctx.fillRect(0,480,W,40); }
      if (ROPE_ANCHOR) drawLoadRope(ctx, now, running, ROPE_ANCHOR, ropePath, placedById, bodyByPlacedId, routeMoving, weight, routeAnalysis);
      drawFields(ctx, machine);
      drawFluidWater.draw(ctx, waterBodies.map(body => ({ x: body.position.x, y: body.position.y, vx: body.velocity.x, vy: body.velocity.y })));
      drawConnections(ctx,machine,selectedConnection,now,running);
      for (const body of Matter.Composite.allBodies(engine.world)) drawGadgetBody(ctx, body, machine, now, running, drawCatalogSprite, drawFireGadget);
      if (!level.loadRope) drawControlRopes(ctx, runtime, [
        ...level.fixedGadgets,
        ...placed.map(part => ({ ...part, id: placedConfigId(part) })),
      ], pendingScissor, ropeMode, selectedRope);
      drawConnectionPorts(ctx,machine,pendingConnection,selectedTool,running);
      if (selectedRope === "pulley-rope" && !running) {
        const points = physicsPoints(); ctx.save(); ctx.strokeStyle = "#e5392c"; ctx.lineWidth = 5; ctx.setLineDash([7,5]); ctx.beginPath();
        points.forEach((point,index) => { if(index===0)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y); }); ctx.stroke(); ctx.restore();
      }
      if (ROPE_ANCHOR && ropeMode && !running) drawLoadRopePorts(ctx, ROPE_ANCHOR, placed, ropePath);
      ctx.fillStyle="#4b2b17";ctx.font="bold 15px system-ui";ctx.fillText(level.buildTip, 24, 32);
      raf=requestAnimationFrame(render);
    }; raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);runtime.dispose();machine.destroy()};
  },[level,placed,ropePath,scissorRopes,pendingScissor,ropeMode,selectedTool,selectedId,connections,selectedConnection,pendingConnection,selectedRope,running,attempt,onWin]);
  return <canvas ref={canvasRef} width={900} height={520} aria-label="Spielfeld der unglaublichen Maschine" />;
}
