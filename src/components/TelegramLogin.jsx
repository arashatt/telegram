import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.js";

/* The bot whose sign-in button this renders. Not a secret — it is visible in
   the widget markup every visitor loads — so it is a plain default rather
   than a build variable, and pointing the site at a different bot only means
   setting VITE_TELEGRAM_BOT_USERNAME. Blank it and no button is rendered,
   instead of one that cannot work. */
const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "auth_mebot";
const WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";

export default function TelegramLogin({ onVerified }) {
  const { t, lang } = useI18n();
  const holder = useRef(null);
  const [failed, setFailed] = useState(false);

  /* The payload Telegram hands back is signed but unverified here — only the
     Worker holds the bot token, so it decides whether to believe it. */
  const handleAuth = useCallback(
    async (payload) => {
      setFailed(false);
      try {
        const res = await fetch("/api/telegram/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth: payload }),
        });
        if (!res.ok) throw new Error(`Verification failed (${res.status})`);
        const data = await res.json();
        if (!data?.user) throw new Error("No user in response");
        onVerified(data.user, payload);
      } catch {
        setFailed(true);
      }
    },
    [onVerified]
  );

  useEffect(() => {
    const node = holder.current;
    if (!BOT_USERNAME || !node) return undefined;

    // The widget invokes a global by name, so publish one just for this mount
    // and take it away again on cleanup.
    const callback = `onTelegramAuth_${Math.random().toString(36).slice(2, 10)}`;
    window[callback] = handleAuth;

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "medium");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${callback}(user)`);
    script.setAttribute("data-lang", lang);
    node.appendChild(script);

    return () => {
      delete window[callback];
      node.replaceChildren();
    };
  }, [handleAuth, lang]);

  if (!BOT_USERNAME) return null;

  return (
    <div className="tglogin">
      <div className="tglogin__row">
        <span className="tglogin__title">{t("telegramLoginTitle")}</span>
        <div ref={holder} className="tglogin__widget" />
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
