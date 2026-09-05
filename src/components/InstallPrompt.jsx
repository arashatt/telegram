import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "../i18n.js";
import { BubbleMark, CameraMark, CloseGlyph, ShareGlyph } from "./Icons.jsx";
import {
  canInstall,
  isIosSafari,
  isStandalone,
  promptInstall,
  rememberDismissed,
  subscribeInstallable,
  wasDismissed,
} from "../pwa.js";
import "./InstallPrompt.css";

/* Chrome's own infobar was suppressed in pwa.js, so this is what replaces it.

   It waits before appearing. Chrome only fires beforeinstallprompt once it
   believes the visitor is engaged, but iOS gives no such signal, and asking
   somebody to install a page they have not read yet is how a banner gets
   dismissed forever. Long enough to have scrolled the demo, short enough to
   still be on the page. */
const APPEAR_MS = 8000;

export default function InstallPrompt() {
  const { t, platform } = useI18n();

  /* Read from the module store rather than mirrored into state: the event can
     land before this component ever mounts. */
  const installable = useSyncExternalStore(subscribeInstallable, canInstall, () => false);

  /* Both derived once, in a lazy initializer, so nothing has to be corrected
     from an effect afterwards. */
  const [gone, setGone] = useState(() => isStandalone() || wasDismissed());
  const [ios] = useState(isIosSafari);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), APPEAR_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    rememberDismissed();
    setGone(true);
  }, []);

  const install = useCallback(() => {
    /* Whatever they choose, the captured event is spent — pwa.js drops it and
       the store update takes the banner away on its own. */
    promptInstall().then((outcome) => {
      if (outcome === "accepted") setGone(true);
    });
  }, []);

  if (gone || !ready) return null;
  /* Nothing to offer: not Chrome-installable, and not the one iOS browser
     with an Add to Home Screen menu. */
  if (!installable && !ios) return null;

  return (
    <div className="install" role="region" aria-labelledby="install-title">
      <span className="install__disc" aria-hidden="true">
        {platform === "instagram" ? <CameraMark size={17} stroke="#fff" /> : <BubbleMark size={17} />}
      </span>

      <div className="install__text">
        <p className="install__title" id="install-title" dir="auto">
          {t(ios ? "installIosTitle" : "installTitle")}
        </p>
        <p className="install__body" dir="auto">
          {ios && <ShareGlyph size={13} />}
          {t(ios ? "installIosBody" : "installBody")}
        </p>
      </div>

      {/* iOS has no programmatic install, so there is deliberately no button
          to press there — only the instruction and a way to close. */}
      {!ios && (
        <button type="button" className="pill install__go" onClick={install}>
          {t("installAction")}
        </button>
      )}

      <button
        type="button"
        className="install__close"
        onClick={dismiss}
        aria-label={t("installDismiss")}
      >
        <CloseGlyph size={13} />
      </button>
    </div>
  );
}
