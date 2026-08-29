import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.js";

const POPUP = { width: 520, height: 680 };
const POLL_MS = 400;

/* Sign-in runs in a popup rather than a full-page redirect: the conversation
   and half-filled form live only in memory, and navigating away would lose
   them. The popup posts back to this window and closes itself. */
export default function TelegramLogin({ onVerified }) {
  const { t } = useI18n();
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  /* Pure I/O, no state of its own: one call answers both whether sign-in is
     configured at all and whether this visitor already has a session cookie.
     Callers decide what to do with the answer. */
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/telegram/me", { credentials: "same-origin" });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let live = true;
    fetchSession().then((data) => {
      if (!live || !data) return;
      setAvailable(Boolean(data.configured));
      if (data.user) onVerified(data.user);
    });
    return () => {
      live = false;
      stopPolling();
    };
  }, [fetchSession, onVerified, stopPolling]);

  useEffect(() => {
    async function onMessage(event) {
      // Only this origin can tell us a sign-in happened.
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "telegram-auth") return;

      stopPolling();
      setPending(false);
      if (!event.data.ok) {
        setFailed(true);
        return;
      }
      const data = await fetchSession();
      if (data?.user) onVerified(data.user);
      else setFailed(true);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fetchSession, onVerified, stopPolling]);

  function startSignIn() {
    setFailed(false);
    setPending(true);

    const left = window.screenX + Math.max(0, (window.outerWidth - POPUP.width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - POPUP.height) / 2);
    const popup = window.open(
      "/api/auth/telegram/start",
      "telegram-signin",
      `width=${POPUP.width},height=${POPUP.height},left=${left},top=${top}`
    );

    if (!popup) {
      // Popup blocked — fall back to a full redirect rather than dead-ending.
      window.location.href = "/api/auth/telegram/start";
      return;
    }

    popupRef.current = popup;
    stopPolling();
    // A visitor who closes the window without finishing sends no message, so
    // the button has to notice on its own.
    pollRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        stopPolling();
        setPending(false);
      }
    }, POLL_MS);
  }

  if (!available) return null;

  return (
    <div className="tglogin">
      <div className="tglogin__row">
        <span className="tglogin__title">{t("telegramLoginTitle")}</span>
        <button
          type="button"
          className="tglogin__button"
          onClick={startSignIn}
          disabled={pending}
        >
          <TelegramGlyph />
          {pending ? t("telegramLoginPending") : t("telegramLoginAction")}
        </button>
      </div>
      <p className="field__hint">{t("telegramLoginHint")}</p>
      {failed && (
        <p className="field__error" role="alert">
          {t("telegramLoginFailed")}
        </p>
      )}
    </div>
  );
}

function TelegramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}
