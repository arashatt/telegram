import { useI18n } from "../i18n.js";
import { displayName, useSession } from "../session.js";

/* The header control: available the moment someone lands, not buried behind a
   conversation. Renders nothing when sign-in is not configured, so an
   unconfigured deploy shows no button that cannot work. */
export default function SignIn() {
  const { t } = useI18n();
  const session = useSession();

  if (!session?.configured) return null;

  if (session.user) {
    return (
      <div className="signin signin--on">
        <TelegramGlyph />
        <span className="signin__who" dir="ltr">
          {session.user.username ? `@${session.user.username}` : displayName(session.user)}
        </span>
        <button type="button" className="signin__out" onClick={session.signOut}>
          {t("signOut")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="signin__button"
      onClick={session.signIn}
      disabled={session.pending}
    >
      <TelegramGlyph />
      {session.pending ? t("telegramLoginPending") : t("telegramLoginAction")}
    </button>
  );
}

export function TelegramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}
