"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function PwaSupport() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [orientationDismissed, setOrientationDismissed] = useState(true);

  useEffect(() => {
    setInstalled(isStandalone());
    try { setOrientationDismissed(sessionStorage.getItem("orientation-hint-dismissed") === "1"); }
    catch { setOrientationDismissed(false); }

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const appInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);

    if ("serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      if (document.readyState === "complete") void register();
      else window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const dismissOrientation = () => {
    setOrientationDismissed(true);
    try { sessionStorage.setItem("orientation-hint-dismissed", "1"); } catch {}
  };

  return <>
    {!installed && installPrompt && <button className="pwa-install" onClick={() => void install()} aria-label="Spiel als App installieren">
      <span aria-hidden="true">⇩</span> App installieren
    </button>}
    {!orientationDismissed && <div className="orientation-hint" role="dialog" aria-modal="true" aria-labelledby="orientation-title">
      <section>
        <span className="orientation-phone" aria-hidden="true">▯</span>
        <h2 id="orientation-title">Bitte ins Querformat drehen</h2>
        <p>So ist das Spielfeld größer und die Bauteile lassen sich genauer platzieren.</p>
        <button onClick={dismissOrientation}>Trotzdem hochkant spielen</button>
      </section>
    </div>}
  </>;
}
