import { useI18n } from "../i18n.js";
import { displayName, useSession } from "../session.js";
import { PlaneGlyph } from "./Icons.jsx";

/* The header control: available the moment someone lands, not buried behind a
   conversation. Renders nothing when sign-in is not configured, so an
   unconfigured deploy shows no button that cannot work. */
export default function SignIn() {
  const { t } = useI18n();
  const session = useSession();

  if (!session?.configured) return null;

  if (session.user) {
    return (
      <div className="signin--on">
        <PlaneGlyph size={15} />
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
      className="pill pill--provider"
      onClick={session.signIn}
      disabled={session.pending}
    >
      <PlaneGlyph />
      {session.pending ? t("telegramLoginPending") : t("telegramLoginAction")}
    </button>
  );
}
