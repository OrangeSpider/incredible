import { GADGET_CATALOG } from "@/engine/gadget-catalog";
import { interactionRows } from "@/engine/interaction-rules";

const waterNames: Record<string, string> = {
  collide: "fließt außen herum",
  float: "schwimmt",
  flee: "flieht vor Wasser",
  extinguish: "wird gelöscht",
  collect: "sammelt Wasser",
  ignore: "wird ignoriert",
};

export default function PhysicsHandbook({ onClose }: { onClose: () => void }) {
  const gadgets = Object.values(GADGET_CATALOG);
  const forceSources = gadgets.filter((gadget) => gadget.categories.includes("force-source"));
  const interactions = interactionRows();
  return (
    <div className="modal physics-modal" onClick={onClose}>
      <section onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <p className="eyebrow">PROFESSOR KNALLKOPFS</p>
        <h2>Physik-Handbuch</h2>
        <div className="handbook-scroll">
          <h3>Gadget-Katalog</h3>
          <p className="physics-intro">Diese Tabelle kommt direkt aus derselben Definition, aus der Körper, Bauteile und Animationen erzeugt werden.</p>
          <div className="interaction-table"><table>
            <thead><tr><th>Gadget</th><th>Kategorie</th><th>Masse</th><th>Schwerkraft</th><th>Wasser</th><th>Zustände / Animationen</th></tr></thead>
            <tbody>{gadgets.map((gadget) => <tr key={gadget.type}>
              <td><b>{gadget.displayName}</b><br /><small>{gadget.type}</small></td>
              <td>{gadget.categories.join(", ")}</td>
              <td>{gadget.physics.massKg} kg</td>
              <td>{gadget.physics.gravityScale === 0 ? "nein" : `${gadget.physics.gravityScale}×`}</td>
              <td>{waterNames[gadget.physics.waterReaction] ?? gadget.physics.waterReaction}</td>
              <td>{Object.keys(gadget.animations).join(" · ")}</td>
            </tr>)}</tbody>
          </table></div>
          <h3>Kraftquellen</h3>
          <div className="interaction-table"><table>
            <thead><tr><th>Gadget</th><th>Beschreibung</th><th>Kraft-Tags</th></tr></thead>
            <tbody>{forceSources.map((gadget) => <tr key={gadget.type}><td>{gadget.displayName}</td><td>{gadget.description}</td><td>{gadget.tags.join(", ")}</td></tr>)}</tbody>
          </table></div>
          <h3>Abstrakte Levelziele</h3>
          <p className="physics-intro">Ein Level prüft Signale und Zustände mit den Modi <b>event</b>, <b>all</b>, <b>any</b>, <b>state</b> oder <b>position</b>. Die Gadgets selbst kennen das konkrete Levelziel nicht.</p>
          <h3>Gadget-Interaktionen</h3>
          <div className="interaction-table"><table>
            <thead><tr><th>Quelle</th><th>Ziel</th><th>Auslöser</th><th>Regel</th><th>Stand</th></tr></thead>
            <tbody>{interactions.map((row, index) => <tr key={index}><td>{row.source}</td><td>{row.target}</td><td>{row.trigger}</td><td>{row.effect}</td><td><span className="status aktiv">{row.status}</span></td></tr>)}</tbody>
          </table></div>
        </div>
      </section>
    </div>
  );
}
