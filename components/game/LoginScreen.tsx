type LoginScreenProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onLogin: () => void;
};

export default function LoginScreen({ draft, onDraftChange, onLogin }: LoginScreenProps) {
  return (
    <main className="login">
      <section className="login-card">
        <div className="professor">⚙</div>
        <p className="eyebrow">WERKSTATTZUGANG</p>
        <h1>Die Unglaubliche<br /><span>Maschine</span></h1>
        <p>Ein Name genügt. Kein Passwort, kein Papierkram – Professor Knallkopf vertraut dir.</p>
        <label>
          Dein Spielername
          <input
            autoFocus
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onLogin()}
            placeholder="z. B. Stefan"
          />
        </label>
        <button onClick={onLogin}>Werkstatt betreten <b>→</b></button>
      </section>
    </main>
  );
}
