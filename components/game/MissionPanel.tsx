import type { LevelDefinition } from "@/engine/types";

export default function MissionPanel({ level }: { level: LevelDefinition }) {
  return (
    <section className="mission">
      <span>ZIEL</span>
      <b>{level.objective}</b>
      <em>Hinweis: {level.hint}</em>
    </section>
  );
}
