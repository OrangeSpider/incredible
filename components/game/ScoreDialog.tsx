export type ScoreEntry = { name: string; score: number };

export default function ScoreDialog({ scores, onClose }: { scores: ScoreEntry[]; onClose: () => void }) {
  return (
    <div className="modal" onClick={onClose}>
      <section onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <p className="eyebrow">WERKSTATTHALLE</p>
        <h2>Bestenliste</h2>
        {scores.length ? scores.map((score, index) => (
          <div className="rank" key={`${score.name}-${index}`}>
            <b>{index + 1}</b><span>{score.name}</span><strong>{score.score.toLocaleString("de-DE")}</strong>
          </div>
        )) : <p className="empty">Noch ist die Tafel jungfräulich. Bring zuerst eine Maschine zum Laufen!</p>}
      </section>
    </div>
  );
}
