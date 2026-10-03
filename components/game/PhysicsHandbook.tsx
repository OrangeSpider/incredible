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
          <h3>Seile, Rollen und Wippen</h3>
          <p className="physics-intro">Wähle das Seil und klicke zuerst einen Scherengriff oder Torriegel. Klicke anschließend auf die gewünschten Rollen und zuletzt auf eine Kugel, einen Ballonknoten oder eines der beiden Wippenenden.</p>
          <p className="physics-intro">Ein Seil zieht erst, wenn sein Verlauf länger wird und es sich spannt. Soll das steigende Wippenende ziehen, führe das Seil über eine Rolle unter diesem Ende. Ein schlaffes Seil drückt nicht. Rote Seile kreuzen eine Mauer und brauchen einen anderen Verlauf.</p>
          <p className="physics-intro">Nach dem Verbinden wechselst du automatisch zu „Bearbeiten“. Du kannst die Bauteile weiter verschieben und drehen. Zum Lösen klicke auf das Seil oder seinen verbundenen Griff und danach auf „Entfernen“. Das Seil kommt ins Inventar zurück. Escape bricht den begonnenen Verlauf ab.</p>
          <p className="physics-intro">Lastseile verwenden den im Level angegebenen Festpunkt und das zugeordnete Gewicht. Eine Route verbindet eine Lastgruppe mit genau einer Zugkugel. Der Verlauf und die tatsächlichen Massen bestimmen den Zug.</p>
          <h3>Strom, Licht und Stoß</h3>
          <p className="physics-intro">Taschenlampe und Knopflampe haben eine Batterie. Ein mechanischer Treffer auf den roten Knopf schaltet sie ein. Die Steckdosenvarianten von Lampe und Ventilator benötigen eine Leitung vom Generator: Wähle „Stromleitung“, klicke STROM und dann STECKDOSE. Ein Stoß startet den Generator. Zum Zurückgeben die Leitung auswählen und „Entfernen“ drücken.</p>
          <p className="physics-intro">Die Lupe bündelt nahes Licht 90 Pixel vor der Linse. Ihr Brennpunkt entzündet nach kurzer Erwärmung einen Docht oder eine Lunte. Drehe die Lupe, um den Brennpunkt auszurichten; Wände blockieren Licht und Wind.</p>
          <p className="physics-intro">Direktes Feuer an der kurzen TNT-Lunte zündet die Explosion. Wasser löscht sie vorher. Der Sprengzünder erzeugt bei einem Stoß von oben einen kurzen Funken rechts unten. Der Boxhandschuh reagiert einmal auf einen Treffer an der Rückseite und schlägt nach vorne. Ein Windrad dreht sich im Luftstrom; ein Riemen verbindet seine ANTRIEB-Anschlüsse mit Zahnrad oder Laufband.</p>
          <h3>Gadget-Katalog</h3>
          <p className="physics-intro">Diese Tabelle kommt aus den Gadget-Definitionen. Reaktionsbeschreibungen sind Hinweise; die tatsächlich ausgeführten Wirkungen stehen bei den Interaktionen. Physik-Overrides verändern konkrete Körperparameter und Stoßschwellen.</p>
          <div className="interaction-table"><table>
            <thead><tr><th>Gadget</th><th>Kategorie</th><th>Masse</th><th>Schwerkraft</th><th>Wasser (Beschreibung)</th><th>Zustände / Animationen</th></tr></thead>
            <tbody>{gadgets.map((gadget) => <tr key={gadget.type}>
              <td><b>{gadget.displayName}</b><br /><small>{gadget.type}</small></td>
              <td>{gadget.categories.join(", ")}</td>
              <td>{gadget.physics.massKg} kg</td>
              <td>{gadget.physics.gravityScale === 0 ? "nein" : `${gadget.physics.gravityScale}×`}</td>
              <td>{waterNames[gadget.reactions?.water ?? "collide"] ?? gadget.reactions?.water ?? "collide"}</td>
              <td>{Object.keys(gadget.animations).join(" · ")}</td>
            </tr>)}</tbody>
          </table></div>
          <h3>Kraftquellen</h3>
          <div className="interaction-table"><table>
            <thead><tr><th>Gadget</th><th>Beschreibung</th><th>Kraft-Tags</th></tr></thead>
            <tbody>{forceSources.map((gadget) => <tr key={gadget.type}><td>{gadget.displayName}</td><td>{gadget.description}</td><td>{gadget.tags.join(", ")}</td></tr>)}</tbody>
          </table></div>
          <h3>Abstrakte Levelziele</h3>
          <p className="physics-intro">Ein Level prüft Zustände, Positionen, Bewegung, Zielbereiche, Kontakte, Ereignisse und Signale. Ziele können mit <b>all</b> und <b>any</b> kombiniert werden; <b>count</b> zählt passende Objekte, <b>never</b> prüft ein Verbot bis zum Abschluss. Die Gadgets selbst kennen das konkrete Levelziel nicht.</p>
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
