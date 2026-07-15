type GameToolbarProps = {
  attempt: number;
  running: boolean;
  canRemove: boolean;
  canRotate: boolean;
  undoLabel?: string;
  canUndo?: boolean;
  onReset: () => void;
  onRemove: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onToggleMachine: () => void;
  onPhysics: () => void;
  onEditor: () => void;
  onLevels: () => void;
  onUndo?: () => void;
  levelNumber: number;
  levelCount: number;
};

export default function GameToolbar(props: GameToolbarProps) {
  return (
    <footer aria-label="Maschinensteuerung">
      <div><span>VERSUCH</span><b>{props.attempt + 1}</b></div>
      <button className="reset" onClick={props.onReset}><i>↻</i><span>ZURÜCKSETZEN</span></button>
      <button className="delete" onClick={props.onRemove} disabled={props.running || !props.canRemove}><i>×</i><span>ENTFERNEN</span></button>
      {props.undoLabel && <button className="reset" onClick={props.onUndo} disabled={props.running || !props.canUndo}><i>↩</i><span>{props.undoLabel}</span></button>}
      <button className="reset" onClick={props.onRotateLeft} disabled={props.running || !props.canRotate}><i>↶</i><span>LINKS DREHEN</span></button>
      <button className="reset" onClick={props.onRotateRight} disabled={props.running || !props.canRotate}><i>↷</i><span>RECHTS DREHEN</span></button>
      <button className={props.running ? "stop" : "start"} onClick={props.onToggleMachine}>
        <span>{props.running ? "MASCHINE ABBRECHEN" : "MASCHINE STARTEN"}</span><i>{props.running ? "■" : "▶"}</i>
      </button>
      <button className="levels" onClick={props.onPhysics}><i>⚙</i><span>PHYSIK</span></button>
      <button className="levels" onClick={props.onEditor}><i>✎</i><span>EDITOR</span></button>
      <button className="levels" onClick={props.onLevels}><i>☷</i><span>LEVEL {props.levelNumber}/{props.levelCount}</span></button>
    </footer>
  );
}
