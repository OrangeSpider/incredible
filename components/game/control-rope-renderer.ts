import { attachmentPoint, handleOffset, ropePorts, type PendingControlRope, type Point } from "../../game/control-ropes.ts";
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
    if (target && machine.state(rope.definition.targetId)?.type === "scissor") points[0] = attachmentPoint(target.position, target.angle, { x: 27 - rope.progress * 22, y: 27 });
    if (rope.triggered) {
      // The operated handle lets go; the free cable end hangs from its first guide.
      const pivot = points[1];
      strokeRope(ctx, [{ x: pivot.x + Math.sin(now / 180) * 8, y: pivot.y + 36 }, ...points.slice(1)], 10, true);
    } else strokeRope(ctx, points, 8 * (1 - rope.progress), true, rope.blocked || selectedRope === rope.definition.targetId);
    if (rope.blocked && !rope.triggered) {
      ctx.save(); ctx.fillStyle = "#b53f2d"; ctx.font = "bold 13px system-ui";
      ctx.fillText("Seil blockiert – über eine Rolle um die Mauer führen", 215, 58); ctx.restore();
    }
    for (const id of rope.definition.guides) {
      const body = machine.body(id); if (!body) continue;
      ctx.save(); ctx.translate(body.position.x, body.position.y);
      const source = points.at(-1)!;
      ctx.rotate((source.x + source.y) / 30);
      ctx.strokeStyle = "#fff0b0"; ctx.lineWidth = 3;
      for (let spoke = 0; spoke < 4; spoke++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(22, 0); ctx.stroke(); }
      ctx.restore();
    }
  }
  for (const config of runtime.level.fixedGadgets) {
    if (config.type === "basket") {
      const w = Number(config.physics?.width ?? 100), h = Number(config.physics?.height ?? 90);
      ctx.save(); ctx.strokeStyle = "#7b4927"; ctx.lineWidth = 8; ctx.beginPath();
      ctx.moveTo(config.x - w / 2, config.y - h / 2); ctx.lineTo(config.x - w / 2 + 6, config.y + h / 2 - 6);
      ctx.quadraticCurveTo(config.x, config.y + h / 2 + 6, config.x + w / 2 - 6, config.y + h / 2 - 6);
      ctx.lineTo(config.x + w / 2, config.y - h / 2); ctx.stroke();
      ctx.font = "bold 12px system-ui"; ctx.fillStyle = "#6b391e"; ctx.fillText("ZIELKORB", config.x - 31, 509); ctx.restore();
    }
    if (config.type !== "scissor") continue;
    const closed = machine.state(config.id)?.state === "closed";
    const progress = closed ? Math.min(1, (machine.stateAgeMs(config.id) ?? 0) / 260) : runtime.controlRopes.ropes.find(rope => rope.definition.targetId === config.id)?.progress ?? 0;
    const balloon = machine.body(String(config.properties?.balloon ?? ""));
    if (balloon) {
      strokeRope(ctx, [ { x: balloon.position.x, y: balloon.position.y + 27 }, closed ? { x: balloon.position.x + Math.sin(now / 170) * 7, y: balloon.position.y + 59 } : { x: config.x, y: config.y - 12 } ], closed ? 6 : 0);
    }
    ctx.save(); ctx.translate(config.x, config.y); ctx.rotate(config.rotation ?? 0); ctx.lineCap = "round";
    const gap = 27 * (1 - progress) + 5 * progress;
    ctx.strokeStyle = "#647a80"; ctx.lineWidth = 8; ctx.beginPath();
    ctx.moveTo(-gap, -32); ctx.lineTo(gap, 27); ctx.moveTo(gap, -32); ctx.lineTo(-gap, 27); ctx.stroke();
    ctx.strokeStyle = "#d8e7e9"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "#bb4435"; ctx.lineWidth = 5;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * gap, 27, 10, 8, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "#eab34e"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (closed && (machine.stateAgeMs(config.id) ?? 0) < 450) {
      ctx.save(); ctx.fillStyle = "#aa3f2b"; ctx.font = "bold 14px system-ui"; ctx.fillText("SCHNAPP!", config.x - 32, config.y - 48); ctx.restore();
    }
  }
  if (!ropeMode || running) return;
  if (pending) {
    const target = machine.body(pending.targetId), type = machine.state(pending.targetId)?.type;
    if (target && type) strokeRope(ctx, [attachmentPoint(target.position, target.angle, handleOffset(type)), ...pending.guides.flatMap(id => { const body = machine.body(id); return body ? [{ ...body.position }] : []; })], 8);
  }
  for (const port of ropePorts(configs)) {
    const connected = runtime.controlRopes.ropes.some(rope => rope.definition.targetId === port.gadgetId);
    const active = pending?.targetId === port.gadgetId || pending?.guides.includes(port.gadgetId);
    ctx.save(); ctx.fillStyle = active ? "#db9a25" : connected ? "#bd6241" : "#2f9b67";
    ctx.strokeStyle = "#fff6d7"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(port.x, port.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = "bold 10px system-ui"; ctx.fillStyle = "#4b2b17"; ctx.fillText(connected && port.kind === "target" ? "AUSWÄHLEN" : port.label, port.x + 13, port.y - 12); ctx.restore();
  }
}
