import { drawCartoonArtwork } from "./cartoon-artwork.ts";
import { bodyPoint } from "../../engine/gadget-geometry.ts";
import type Matter from "matter-js";
import type { MachinePhysicsEngine } from "../../engine/physics-engine.ts";
import { machinePlugin } from "../../engine/body-factory.ts";
import { GADGET_CATALOG } from "../../engine/gadget-catalog.ts";
import { gadgetPorts, gadgetPortKey } from "../../game/gadget-connections.ts";
import { drawConveyor, drawDriveBelt, driveBeltGeometry, GENERATOR_DRIVE_CENTER } from "../../game/drive.ts";
import { drawFan, drawWindmill, drawMagnifier } from "./gadget-motion-renderer.ts";

export function drawMouseHole(ctx: CanvasRenderingContext2D, x: number, floorY: number, width = 52, height = 58) {
  ctx.save(); ctx.translate(x, floorY); ctx.lineWidth = 5; ctx.strokeStyle = "#aa7950";
  ctx.fillStyle = "#38291f"; ctx.beginPath(); ctx.moveTo(-width / 2, 0); ctx.lineTo(-width / 2, -height + width / 2);
  ctx.arc(0, -height + width / 2, width / 2, Math.PI, 0); ctx.lineTo(width / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#171b1c"; ctx.beginPath(); ctx.ellipse(2, -7, width * .4, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#7a5437"; ctx.lineWidth = 2;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * (width / 2 + 5), -22); ctx.lineTo(side * (width / 2 + 15), -27); ctx.lineTo(side * (width / 2 + 10), -38); ctx.stroke(); }
  ctx.restore();
}

export function drawGadget(ctx: CanvasRenderingContext2D, body: Matter.Body, machine: MachinePhysicsEngine, now: number, running: boolean): boolean {
  const plugin = machinePlugin(body); if (!plugin) return false;
  const { type, instanceId: id } = plugin, state = machine.state(id)?.state, age = machine.stateAgeMs(id) ?? 0;
  ctx.lineWidth = 3; ctx.strokeStyle = "#173f50";
  if (drawCartoonArtwork(ctx, body, machine, now, running)) return true;
  if (type === "balloon") {
    if (state === "popped") return true;
    ctx.fillStyle = material(ctx,"#f69a7b","#b83a42"); ctx.beginPath(); ctx.ellipse(0, 0, 22, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fbe5d8"; ctx.beginPath(); ctx.ellipse(-7, -9, 5, 9, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#6e5842"; ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(0, 57); ctx.stroke();
  } else if (type === "targetRing" || type === "cannonTarget") {
    const radius = machine.config(id)?.physics?.radius ?? GADGET_CATALOG[type].physics.radius ?? 45;
    ctx.strokeStyle = "#733b2d"; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();ctx.strokeStyle=material(ctx,"#f19b66","#b93422");ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle="#ffe4a6";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,radius-2,Math.PI,Math.PI*1.75);ctx.stroke();
    if (type === "cannonTarget") { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, radius / 2, 0, Math.PI * 2); ctx.stroke(); }
  } else if (type === "exit") {
    drawMouseHole(ctx, 0, 30, 52, 58);
  } else if (type === "payloadBall") {
    ctx.fillStyle = material(ctx,"#f68a6b","#a22d2c"); ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();ctx.fillStyle="#ffc783";ctx.beginPath();ctx.ellipse(-5,-6,5,2,-.5,0,Math.PI*2);ctx.fill();
  } else if (type === "scissor") {
    const progress=state==="closed"?Math.min(1,age/260):Number(machine.state(id)?.properties["handleProgress:handle"]??0),gap=27-22*progress;
    ctx.lineCap="round";ctx.strokeStyle="#334c56";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-gap,-32);ctx.lineTo(gap,27);ctx.moveTo(gap,-32);ctx.lineTo(-gap,27);ctx.stroke();ctx.strokeStyle="#c2d3cf";ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle=material(ctx,"#e99267","#a5392f");ctx.lineWidth=5;for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(side*gap,27,10,8,0,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle="#e6b856";ctx.strokeStyle="#684c2e";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.stroke();
  } else if (type === "conveyor") {
    drawConveyor(ctx, {centerX:0,centerY:0,width:Number(machine.config(id)?.physics?.width??270),now,running:running&&state==="running",direction:Number(machine.state(id)?.properties.direction??1)<0?-1:1});
  } else if (type === "basket") {
    const config = machine.config(id), w = Number(config?.physics?.width ?? 100), h = Number(config?.physics?.height ?? 90);
    ctx.strokeStyle = "#7b4927"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-w/2,-h/2); ctx.lineTo(-w/2+6,h/2-6); ctx.quadraticCurveTo(0,h/2+6,w/2-6,h/2-6); ctx.lineTo(w/2,-h/2); ctx.stroke();
    ctx.strokeStyle = material(ctx,"#e6b970","#a07037"); ctx.lineWidth = 3;
    for(let x=-w/2+15;x<w/2-5;x+=15){ctx.beginPath();ctx.moveTo(x,-h/2+6);ctx.lineTo(x*.8,h/2-3);ctx.stroke();}
    for(let y=-h/2+18;y<h/2-8;y+=14){const inset=(y+h/2)/h*6;ctx.beginPath();ctx.moveTo(-w/2+inset,y);ctx.lineTo(w/2-inset,y);ctx.stroke();}
    ctx.fillStyle = "#704524"; ctx.font = "bold 10px system-ui"; ctx.fillText("ZIELKORB",-27,h/2+20);
  } else if (type === "basketball") {
    ctx.fillStyle = material(ctx, "#ffb963", "#ba612b"); ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#714525"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(19, 0); ctx.moveTo(0, -19); ctx.lineTo(0, 19); ctx.stroke();
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 18, 0, 14, 19, 0, Math.PI / 2, Math.PI * 1.5, side === 1); ctx.stroke(); }
  } else if (type === "flashlight" || type === "socketFlashlight") {
    ctx.fillStyle = material(ctx, "#ed9171", "#973c31"); ctx.beginPath(); ctx.roundRect(-38, -14, 63, 28, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#dfb651"; ctx.beginPath(); ctx.moveTo(20, -15); ctx.lineTo(38, -22); ctx.lineTo(38, 22); ctx.lineTo(20, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = state === "on" ? "#fff1a7" : "#bcc8c4"; ctx.fillRect(33, -17, 6, 34);
    if (type === "flashlight") drawButton(ctx, 0, -18, state === "on");
  } else if (type === "lamp" || type === "socketLamp") {
    ctx.fillStyle = material(ctx, "#94b4b9", "#344e5c"); ctx.beginPath(); ctx.roundRect(-28, 23, 56, 9, 4); ctx.fill(); ctx.stroke(); ctx.fillRect(-4, -9, 8, 33);
    ctx.fillStyle = state === "on" ? "#ffe481" : "#c4cecb"; ctx.beginPath(); ctx.arc(0, -20, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#817044"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(-9, -22); ctx.lineTo(9, -22); ctx.lineTo(6, -7); ctx.stroke();
    if (type === "lamp") drawButton(ctx, -24, -32, state === "on");
  } else if (type === "fan" || type === "socketFan" || type === "switchFan") {
    const active = state === "running";
    drawFan(ctx, Number(machine.state(id)?.properties.rotorAngle ?? 0), active, machine.timeMs);
    if (type === "switchFan") drawButton(ctx, 0, -30, active);
  } else if (type === "magnifier") {
    drawMagnifier(ctx, state === "focusing", machine.timeMs);
    if (!running) { ctx.strokeStyle = "#d78837"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(90, 0); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(90, 0, 7, 0, Math.PI * 2); ctx.stroke(); ctx.font = "10px system-ui"; ctx.fillStyle = "#81542f"; ctx.fillText("BRENNPUNKT", 57, -14); }
  } else if (type === "generator") {
    ctx.fillStyle = "#58747e"; ctx.beginPath(); ctx.roundRect(-42, -29, 84, 58, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#d7b766"; ctx.beginPath(); ctx.arc(GENERATOR_DRIVE_CENTER.x, GENERATOR_DRIVE_CENTER.y, 21, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(GENERATOR_DRIVE_CENTER.x, GENERATOR_DRIVE_CENTER.y); ctx.rotate(state === "running" && running ? now / 110 : 0); ctx.strokeStyle = "#785329"; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.moveTo(0, -15); ctx.lineTo(0, 15); ctx.stroke(); ctx.restore();
    ctx.fillStyle = state === "running" ? "#80cf73" : "#ba4c3b"; ctx.beginPath(); ctx.arc(28, -16, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = "bold 10px system-ui"; ctx.fillStyle = "#fff3c8"; ctx.fillText("GEN", -21, 25);
  } else if (type === "tnt") {
    if (state === "exploded") {
      if (age < 520) { const radius = 20 + age * .28; ctx.fillStyle = `rgba(237,105,35,${1 - age / 520})`; ctx.beginPath();
        for (let i = 0; i < 24; i++) { const r = radius * (i % 2 ? .7 : 1), angle = i / 24 * Math.PI * 2; ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r); } ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(238,175,58,${1 - age / 520})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 30 + age * .3, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      for (let stick = -1; stick <= 1; stick++) { ctx.fillStyle = material(ctx, "#ef8771", "#a52f28"); ctx.beginPath(); ctx.roundRect(stick * 20 - 10, -20, 20, 40, 6); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = "#6d4c30"; ctx.fillRect(-34, -10, 68, 5); ctx.fillRect(-34, 8, 68, 5);
      ctx.strokeStyle = state === "extinguished" ? "#568caa" : "#6b4930"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-2, -20); ctx.quadraticCurveTo(-9, -33, -18, -28); ctx.stroke();
      if (state === "burning") drawSpark(ctx, -18 + Math.min(1, age / 650) * 16, -28 + Math.min(1, age / 650) * 8, now);
      ctx.font = "bold 12px system-ui"; ctx.fillStyle = "#fff1c1"; ctx.fillText("TNT", -13, 5);
    }
  } else if (type === "detonator") {
    const pressed = state === "spent";
    ctx.fillStyle = material(ctx, "#e1a16b", "#823b25"); ctx.beginPath(); ctx.roundRect(-23, -5, 46, 41, 5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#526e78"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, pressed ? -13 : -33); ctx.moveTo(-23, pressed ? -13 : -33); ctx.lineTo(23, pressed ? -13 : -33); ctx.stroke();
    ctx.strokeStyle = "#b4944f"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(23, 20); ctx.lineTo(40, 20); ctx.stroke();
    if (pressed && age < 160) drawSpark(ctx, 40, 20, now);
  } else if (type === "windmill") {
    drawWindmill(ctx, Number(machine.state(id)?.properties.rotorAngle ?? 0), state === "running");
  } else if (type === "boxingGlove") {
    const extension = state === "spent" ? Math.sin(Math.min(1, age / 400) * Math.PI) * 82 : 0;
    ctx.fillStyle = "#617b83"; ctx.fillRect(-36, -22, 15, 44); ctx.strokeRect(-36, -22, 15, 44);
    ctx.strokeStyle = "#a38a60"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-21, 0);
    for (let i = 0; i <= 10; i++) ctx.lineTo(-18 + i * (32 + extension) / 10, i % 2 ? -9 : 9); ctx.stroke();
    ctx.fillStyle = material(ctx, "#f79575", "#a52f31"); ctx.beginPath(); ctx.roundRect(2 + extension, -21, 34, 42, [15, 17, 17, 8]); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#f48b71"; ctx.beginPath(); ctx.moveTo(12 + extension, -13); ctx.lineTo(27 + extension, -13); ctx.stroke();
    ctx.fillStyle = state === "ready" ? "#f2c553" : "#777c76"; ctx.beginPath(); ctx.arc(-34, 0, 6, 0, Math.PI * 2); ctx.fill();
  } else if (type === "trampoline") {
    ctx.strokeStyle = "#526e78"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-54, 2); ctx.lineTo(-60, 29); ctx.lineTo(-45, 29); ctx.moveTo(54, 2); ctx.lineTo(60, 29); ctx.lineTo(45, 29); ctx.stroke();
    ctx.fillStyle = "#388b94"; ctx.beginPath(); ctx.ellipse(0, 0, 64, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#243f4b"; ctx.beginPath(); ctx.ellipse(0, -2, 48, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#d5c99c"; ctx.lineWidth = 2;
    for (let spring = -54; spring <= 54; spring += 12) { ctx.beginPath(); ctx.moveTo(spring, -4); ctx.lineTo(spring * .85, 0); ctx.lineTo(spring, 4); ctx.stroke(); }
  } else return false;
  const supply = GADGET_CATALOG[type].electrical?.supply;
  if (supply === "socket" || supply === "generator") {
    ctx.fillStyle = "#fff0c3"; ctx.strokeStyle = "#526e78"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(28, 12, 16, 16, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#273e48"; for (const x of [33, 39]) { ctx.beginPath(); ctx.arc(x, 20, 2, 0, Math.PI * 2); ctx.fill(); }
  }
  return true;
}

function drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean) {
  ctx.fillStyle = on ? "#55b76e" : "#df493b"; ctx.strokeStyle = "#684c36"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 9, y - 4, 18, 8, 3); ctx.fill(); ctx.stroke();
}
function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, now: number) {
  ctx.strokeStyle = "#ed992d"; ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4 + now / 230; ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * 3, y + Math.sin(angle) * 3); ctx.lineTo(x + Math.cos(angle) * 11, y + Math.sin(angle) * 11); ctx.stroke(); }
}

export function drawFields(ctx: CanvasRenderingContext2D, machine: MachinePhysicsEngine) {
  ctx.save();
  for (const light of machine.mechanics.lights) {
    const glow = ctx.createRadialGradient(light.x, light.y, 8, light.x, light.y, light.radius);
    glow.addColorStop(0, "rgba(255,217,72,.32)"); glow.addColorStop(1, "rgba(255,227,127,0)"); ctx.fillStyle = glow;
    ctx.beginPath();
    if (light.angle === undefined) ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
    else { ctx.moveTo(light.x, light.y); ctx.arc(light.x, light.y, light.radius, light.angle - .28, light.angle + .28); ctx.closePath(); }
    ctx.fill();
  }
  for (const focus of machine.mechanics.focuses) {
    const lens = machine.body(focus.lensId)!;
    const clock = machine.timeMs, pulse = .5 + .5 * Math.sin(clock / 160);
    ctx.fillStyle = `rgba(252,199,67,${.14 + pulse * .12})`; ctx.strokeStyle = "rgba(230,151,31,.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); const a = bodyPoint(lens, { x: 0, y: -28 }), b = bodyPoint(lens, { x: 0, y: 28 });
    ctx.moveTo(a.x, a.y); ctx.lineTo(focus.point.x, focus.point.y); ctx.lineTo(b.x, b.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,242,172,.8)";
    for (const start of [a, b]) {
      const progress = (clock % 650) / 650;
      ctx.beginPath(); ctx.arc(start.x + (focus.point.x - start.x) * progress, start.y + (focus.point.y - start.y) * progress, 2, 0, Math.PI * 2); ctx.fill();
    }
    const glow = ctx.createRadialGradient(focus.point.x, focus.point.y, 1, focus.point.x, focus.point.y, 12 + pulse * 4);
    glow.addColorStop(0, "rgba(255,245,172,.95)"); glow.addColorStop(.3, "rgba(244,159,45,.75)"); glow.addColorStop(1, "rgba(244,159,45,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(focus.point.x, focus.point.y, 12 + pulse * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawConnections(ctx: CanvasRenderingContext2D, machine: MachinePhysicsEngine, selected: string | null, now: number, running: boolean) {
  for (const connection of machine.connections) {
    const points = machine.mechanics.connectionPoints(connection.id); if (points.length !== 2) continue;
    const active = machine.state(connection.sourceId)?.state === "running";
    if (connection.kind === "belt") {
      const [source, target] = points;
      drawDriveBelt(ctx, driveBeltGeometry(source, target, source.radius, target.radius), now, running && active);
    }
    else {
      ctx.save(); ctx.strokeStyle = selected === connection.id ? "#e5392c" : "#3c4e59"; ctx.lineWidth = selected === connection.id ? 7 : 5;
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); ctx.lineTo(points[1].x, points[1].y); ctx.stroke();
      ctx.strokeStyle = active ? "#e9bd42" : "#94a8ad"; ctx.lineWidth = 2; ctx.setLineDash([5, 9]); ctx.lineDashOffset = running && active ? -now / 30 : 0; ctx.stroke(); ctx.restore();
    }
    if (selected === connection.id && connection.kind === "belt") { ctx.save(); ctx.strokeStyle = "#e5392c"; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); ctx.lineTo(points[1].x, points[1].y); ctx.stroke(); ctx.restore(); }
  }
}

export function drawConnectionPorts(ctx: CanvasRenderingContext2D, machine: MachinePhysicsEngine, pending: string | null, tool: string | null, running: boolean) {
  if (running || (tool !== "wire" && tool !== "belt")) return;
  const configs = machine.entities().map(entity => ({ ...machine.config(entity.id)!, x: entity.x, y: entity.y, rotation: machine.body(entity.id)?.angle ?? 0 }));
  for (const port of gadgetPorts(configs).filter(port => tool === "wire" ? port.kind !== "drive" : port.kind === "drive")) {
    ctx.save(); ctx.fillStyle = pending === gadgetPortKey(port) ? "#d39731" : "#359c73"; ctx.strokeStyle = "#fff5d3"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(port.x, port.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#4d3728"; ctx.font = "bold 10px system-ui"; ctx.fillText(port.label, port.x + 13, port.y - 9); ctx.restore();
  }
}

function material(ctx:CanvasRenderingContext2D,light:string,dark:string){const paint=ctx.createLinearGradient(-10,-30,12,30);paint.addColorStop(0,light);paint.addColorStop(1,dark);return paint;}
