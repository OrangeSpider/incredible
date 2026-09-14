type GameHeaderProps = {
  score: number;
  playerName: string;
  levelNumber: number;
  levelCount: number;
  onScores: () => void;
  onLevels: () => void;
  onLogout: () => void;
};

export default function GameHeader({ score, playerName, levelNumber, levelCount, onScores, onLevels, onLogout }: GameHeaderProps) {
  return (
    <header>
      <button className="score" onClick={onScores}><span>★</span><b>{score.toLocaleString("de-DE")}</b></button>
      <div className="brand"><small>PROFESSOR KNALLKOPFS</small><strong>Die Unglaubliche Maschine</strong></div>
      <button className="level-chip" onClick={onLevels}>LEVEL <b>{String(levelNumber).padStart(2, "0")}</b> / {levelCount}⌄</button>
      <button className="user" onClick={onLogout}>⚙ {playerName}⌄</button>
    </header>
  );
}
