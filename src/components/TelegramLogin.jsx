import { useI18n } from "../i18n.js";
import { displayName, useSession } from "../session.js";
import { TelegramGlyph } from "./SignIn.jsx";

/* The in-form panel. It shares the page's single session rather than running
   its own — signing in from the header fills the form, and signing in here
   updates the header. */
export default function TelegramLogin() {
  const { t } = useI18n();
  const session = useSession();

  if (!session?.configured) return null;

  if (session.user) {
    return (
      <p className="tglogin__verified">
        <span aria-hidden="true">✓</span> {t("telegramSignedIn")}{" "}
        <strong dir="ltr">
          {session.user.username ? `@${session.user.username}` : displayName(session.user)}
        </strong>
      </p>
    );
  }

  return (
    <div className="tglogin">
      <div className="tglogin__row">
        <span className="tglogin__title">{t("telegramLoginTitle")}</span>
        <button
          type="button"
          className="tglogin__button"
          onClick={session.signIn}
          disabled={session.pending}
        >
          <TelegramGlyph />
          {session.pending ? t("telegramLoginPending") : t("telegramLoginAction")}
        </button>
      </div>
      <p className="field__hint">{t("telegramLoginHint")}</p>
      {session.failed && (
        <p className="field__error" role="alert">
          {t("telegramLoginFailed")}
        </p>
      )}
    </div>
  );
}
