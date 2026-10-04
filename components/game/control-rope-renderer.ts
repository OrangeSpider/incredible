import { localPort } from "../../engine/gadget-ports.ts";
import { bodyPoint } from "../../engine/gadget-geometry.ts";
import { ropeDraftPoints, ropeDraftUsesPort, controlRopeKey, ropePorts, type PendingControlRope, type Point } from "../../game/control-ropes.ts";
import type { MachineRuntime } from "../../game/machine-runtime.ts";
import type { GadgetInstanceConfig } from "../../engine/types.ts";

function strokeRope(ctx: CanvasRenderingContext2D, points: readonly Point[], slack: number, guides = false, blocked = false) {
  if (points.length < 2) return;
  ctx.save(); ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = blocked ? "#bd4435" : "#65462b"; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const next = points[index + 2];
    if (guides && next) {
      const entry = Math.atan2(previous.y - point.y, previous.x - point.x), exit = Math.atan2(next.y - point.y, next.x - point.x);
      const cross = (previous.x - point.x) * (next.y - point.y) - (previous.y - point.y) * (next.x - point.x);
      ctx.lineTo(point.x + Math.cos(entry) * 30, point.y + Math.sin(entry) * 30);
      ctx.arc(point.x, point.y, 30, entry, exit, cross > 0);
      return;
    }
    ctx.quadraticCurveTo((previous.x + point.x) / 2, (previous.y + point.y) / 2 + slack, point.x, point.y);
  });
  ctx.stroke(); ctx.strokeStyle = "#d7b784"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.restore();
}

export function drawControlRopes(ctx: CanvasRenderingContext2D, runtime: MachineRuntime, configs: GadgetInstanceConfig[], pending: PendingControlRope | null, ropeMode: boolean, selectedRope: string | null = null) {
  const { machine, now, running } = runtime;
  for (const rope of runtime.controlRopes.ropes) {
    const points = runtime.controlRopes.points(rope.definition) ?? rope.points;
    const target = machine.body(rope.definition.targetId);
    const config=machine.config(rope.definition.targetId);
    const handle=config&&localPort(config,rope.definition.targetPortId,"target");
    if (target && config?.type === "scissor" && handle) points[0] = bodyPoint(target, {x:handle.local.x-rope.progress*22,y:handle.local.y});
    // A control rope stays attached after operating its handle. The moved handle
    // merely gives the rope some slack; no segment is discarded from the route.
    strokeRope(ctx, points, rope.triggered ? 8 : 8 * (1 - rope.progress), true, rope.blocked || selectedRope === controlRopeKey(rope.definition));
    if (rope.blocked && !rope.triggered) {
      ctx.save(); ctx.fillStyle = "#b53f2d"; ctx.font = "bold 13px system-ui";
      ctx.fillText("Seil blockiert – über eine Rolle um die Mauer führen", 215, 58); ctx.restore();
    }
    for (const {gadgetId:id} of rope.definition.guides) {
      const body = machine.body(id); if (!body) continue;
      ctx.save(); ctx.translate(body.position.x, body.position.y);
      const source = points.at(-1)!;
      ctx.rotate((source.x + source.y) / 30);
      ctx.strokeStyle = "#fff0b0"; ctx.lineWidth = 3;
      for (let spoke = 0; spoke < 4; spoke++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(22, 0); ctx.stroke(); }
      ctx.restore();
    }
  }
  for (const config of configs) {
    if (config.type !== "scissor") continue;
    const closed = machine.state(config.id)?.state === "closed";
    const balloon = machine.body(String(config.properties?.balloon ?? ""));
    if (balloon) {
      strokeRope(ctx, [ { x: balloon.position.x, y: balloon.position.y + 27 }, closed ? { x: balloon.position.x + Math.sin(now / 170) * 7, y: balloon.position.y + 59 } : bodyPoint(machine.body(config.id)!, { x: 0, y: -12 }) ], closed ? 6 : 0);
    }
    if (closed && (machine.stateAgeMs(config.id) ?? 0) < 450) {
      ctx.save(); ctx.fillStyle = "#aa3f2b"; ctx.font = "bold 14px system-ui"; ctx.fillText("SCHNAPP!", (machine.body(config.id)?.position.x??config.x) - 32, (machine.body(config.id)?.position.y??config.y) - 48); ctx.restore();
    }
  }
  if (!ropeMode || running) return;
  if (pending) {
    strokeRope(ctx, ropeDraftPoints(pending,configs), 8);
  }
  for (const port of ropePorts(configs)) {
    const connected = runtime.controlRopes.ropes.some(rope => rope.definition.targetId === port.gadgetId && rope.definition.targetPortId === port.portId);
    const active = ropeDraftUsesPort(pending,port);
    ctx.save(); ctx.fillStyle = active ? "#db9a25" : connected ? "#bd6241" : "#2f9b67";
    ctx.strokeStyle = "#fff6d7"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(port.x, port.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = "bold 10px system-ui"; ctx.fillStyle = "#4b2b17"; ctx.fillText(connected && port.kind === "target" ? "AUSWÄHLEN" : port.label, port.x + 13, port.y - 12); ctx.restore();
  }
}
