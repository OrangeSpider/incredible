import { gadgetSize, resizeHandles } from "@/engine/gadget-geometry";
import type { GadgetInstanceConfig } from "@/engine/types";

export default function GadgetSelection({ gadget }: { gadget: GadgetInstanceConfig }) {
  const size = gadgetSize(gadget);
  return <svg className="editor-overlay gadget-selection" viewBox="0 0 900 520" aria-hidden="true">
    <g transform={`translate(${gadget.x} ${gadget.y}) rotate(${(gadget.rotation ?? 0) * 180 / Math.PI})`}>
      <rect className="selection" x={-size.width / 2 - 6} y={-size.height / 2 - 6} width={size.width + 12} height={size.height + 12} rx="5" />
    </g>
    {resizeHandles(gadget).map((point, index) => <g key={index} transform={`translate(${point.x} ${point.y})`}><circle className="resize-handle" r="9" /><path d="M-4 0H4M0-4V4" /></g>)}
  </svg>;
}
