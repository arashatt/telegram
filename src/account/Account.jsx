import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, dirFor } from "../i18n.js";
import { prefersPersian } from "../lang.js";
import { SessionContext, displayName, useTelegramSession } from "../session.js";
import { PlaneGlyph, MoonIcon } from "../components/Icons.jsx";
import { formatInvoiceAmount, invoiceStatusLabel } from "../../shared/invoiceSchema.js";
import { get } from "../dashboard/api.js";
import { relativeTime } from "../dashboard/format.js";
import { AccountContext, translator } from "./copy.js";
import "../dashboard/dashboard.css";
import "./account.css";

/* A customer's own page: what they have asked us to build, and what they owe
   for it.

   Its own entry rather than a mode of /app. A customer who opens the shop
   dashboard and is told "No shop yet" has been shown somebody else's product
   and then refused entry to it — which is the wrong thing entirely. This page
   knows exactly one person: whoever is signed in.

   Everything it shows comes from /api/app/mine, which reads only from the
   caller's own subject. There is no id in any request here for anybody to
   change. */

const initialLang = () => (prefersPersian() ? "fa" : DEFAULT_LANG);

const initialTheme = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export default function Account() {
  const [lang, setLang] = useState(initialLang);
  const [theme, setTheme] = useState(initialTheme);
  const [state, setState] = useState({ status: "loading" });

  const session = useTelegramSession();
  const t = useMemo(() => translator(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
    document.documentElement.dataset.theme = theme;
    document.title = t("title");
  }, [lang, theme, t]);

  /* One load, re-run whenever the signed-in user changes, so signing in swaps
     the whole page without a reload.

     /api/app/session first because it answers whether anybody is signed in
     *and* whether sign-in is configured at all — a signed-out visitor and a
     site with no sign-in are different screens and cannot be told apart from
     a 401. /api/app/mine follows only when there is somebody to ask about,
     and that call is also the one that adopts any earlier anonymous rows —
     briefs they sent before they ever signed in.

     The loading flag is a key mismatch rather than a setState at the top of
     the effect: a synchronous setState there is a cascading render, and this
     way a slow answer to a question nobody is asking any more can never
     overwrite the current one. */
  const key = `${session.user?.id ?? ""}`;

  useEffect(() => {
    let live = true;
    get("/api/app/session")
      .then(async (who) => {
        if (!who.user) return { key, status: "anon", configured: who.configured };
        return { key, status: "ready", configured: true, ...(await get("/api/app/mine")) };
      })
      .then((next) => {
        if (live) setState(next);
      })
      .catch((err) => {
        if (live) setState({ key, status: "error", code: err.code });
      });
    return () => {
      live = false;
    };
  }, [key]);

  const status = state.key === key ? state.status : "loading";

  const context = useMemo(() => ({ t, lang }), [t, lang]);

  return (
    <AccountContext.Provider value={context}>
      <SessionContext.Provider value={session}>
        <div className="dash acct" data-theme={theme}>
          <header className="dash__bar">
            <div className="dash__barinner">
              <div className="dash__identity">
                <span className="dash__mark" aria-hidden="true">
                  <PlaneGlyph size={15} />
                </span>
                <span className="dash__shopname">{t("title")}</span>
              </div>

              <div className="dash__tools">
                <button
                  type="button"
                  className="dash__icon"
                  onClick={() => setLang((value) => (value === "fa" ? "en" : "fa"))}
                >
                  {t("language")}
                </button>
                <button
                  type="button"
                  className="dash__icon"
                  onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
                  aria-label={t("theme")}
                >
                  <MoonIcon />
                </button>
              </div>
            </div>
          </header>

          <main className="dash__main">
            <Body state={state} status={status} session={session} t={t} lang={lang} />
          </main>

          {session.user && (
            <footer className="dash__foot">
              <span dir="ltr">
                {session.user.username ? `@${session.user.username}` : displayName(session.user)}
              </span>
              <button type="button" className="dash__link" onClick={session.signOut}>
                {t("signOut")}
              </button>
            </footer>
          )}
        </div>
      </SessionContext.Provider>
    </AccountContext.Provider>
  );
}

function Body({ state, status, session, t, lang }) {
  if (status === "loading") return <p className="dash__note">{t("loading")}</p>;

  if (status === "anon") {
    return (
      <div className="dash__card dash__card--gate">
        <h2>{t("signInTitle")}</h2>
        <p>{state.configured ? t("signInBody") : t("signInUnavailable")}</p>
        {state.configured && (
          <button
            type="button"
            className="pill pill--provider pill--lg"
            onClick={session.signIn}
            disabled={session.pending}
          >
            <PlaneGlyph />
            {session.pending ? t("signInPending") : t("signInAction")}
          </button>
        )}
        {session.failed && <p className="dash__error">{t("signInFailed")}</p>}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="dash__card">
        <p>{t("errNetwork")}</p>
      </div>
    );
  }

  const invoices = state.invoices ?? [];
  const briefs = state.briefs ?? [];
  /* Anything still owed goes first. On a page a customer opens because they
     were sent a bill, the bill is the reason they are here. */
  const owed = invoices.filter((invoice) => invoice.payUrl);

  return (
    <>
      {owed.length > 0 && (
        <section className="acct__owed">
          <h2>{t("invoices")}</h2>
          <ul className="acct__list">
            {owed.map((invoice) => (
              <li key={invoice.id}>
                <a className="acct__owedrow" href={invoice.payUrl}>
                  <span dir="auto">{invoice.title}</span>
                  <span className="acct__amount" dir="ltr">
                    {formatInvoiceAmount(invoice.amountCents, invoice.currency, lang)}
                  </span>
                  <span className="pill pill--sm">{t("payNow")}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>{t("briefs")}</h2>
        {briefs.length === 0 ? (
          <div className="dash__card dash__card--empty">
            <h3>{t("briefsEmpty")}</h3>
            <p>{t("briefsEmptyBody")}</p>
          </div>
        ) : (
          <ul className="acct__list">
            {briefs.map((brief) => (
              <li key={brief.id} className="acct__brief">
                <span className="acct__briefname" dir="auto">
                  {brief.botName || brief.summary || brief.reference}
                </span>
                <span className="acct__briefmeta">
                  <span dir="ltr">{brief.reference}</span>
                  <time dateTime={new Date(brief.createdAt).toISOString()}>
                    {relativeTime(brief.createdAt, lang)}
                  </time>
                  <span className="cust__status" data-status={brief.deliveredAt ? "paid" : "sent"}>
                    {brief.deliveredAt ? t("delivered") : t("pending")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invoices.length > owed.length && (
        <section>
          <h2>{t("invoices")}</h2>
          <ul className="acct__list">
            {invoices
              .filter((invoice) => !invoice.payUrl)
              .map((invoice) => (
                <li key={invoice.id} className="acct__invoice">
                  <span dir="auto">{invoice.title}</span>
                  <span dir="ltr">
                    {formatInvoiceAmount(invoice.amountCents, invoice.currency, lang)}
                  </span>
                  <span className="cust__status" data-status={invoice.status}>
                    {invoiceStatusLabel(invoice.status, lang)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {invoices.length === 0 && (
        <div className="dash__card dash__card--empty">
          <h3>{t("invoicesEmpty")}</h3>
          <p>{t("invoicesEmptyBody")}</p>
        </div>
      )}
    </>
  );
}
