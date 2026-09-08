import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, dirFor } from "../i18n.js";
import { prefersPersian } from "../lang.js";
import { SessionContext, displayName, useTelegramSession } from "../session.js";
import { PlaneGlyph, MoonIcon } from "../components/Icons.jsx";
import { DashContext, translator } from "./copy.js";
import { get, post } from "./api.js";
import Orders from "./Orders.jsx";
import Catalog from "./Catalog.jsx";
import Report from "./Report.jsx";
import Settings from "./Settings.jsx";
import "./dashboard.css";

/* The shop owner's dashboard: the thing /instagram promises is behind the
   automation — "every DM and order is written to your store, your team reads
   it in a dashboard, and a weekly report says what actually sold".

   Its own shell rather than App.jsx's, because it shares nothing with the
   marketing pages but the sign-in and the design tokens. It keeps the base
   accent on purpose: this is the product, not the pitch for it, and a shop
   selling on Telegram would open the same screens.

   No router. Four panels and a tab bar is the whole navigation, and a fresh
   load starting on Orders is the right default every time. */

const TABS = [
  ["orders", "tabOrders"],
  ["catalog", "tabCatalog"],
  ["report", "tabReport"],
  ["settings", "tabSettings"],
];

const initialLang = () => (prefersPersian() ? "fa" : DEFAULT_LANG);

const initialTheme = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

function TabIcon({ name }) {
  const paths = {
    orders: "M4 7h16M4 12h16M4 17h10",
    catalog: "M4 6h16v12H4zM4 10h16M9 6v12",
    report: "M5 19V9M12 19V5M19 19v-7",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 12h2M18 12h2M12 4v2M12 18v2",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export default function Dashboard() {
  const [lang, setLang] = useState(initialLang);
  const [theme, setTheme] = useState(initialTheme);
  const [tab, setTab] = useState("orders");
  const [state, setState] = useState({ status: "loading" });

  const session = useTelegramSession();
  const t = useMemo(() => translator(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
    document.documentElement.dataset.theme = theme;
    document.title = t("title");
  }, [lang, theme, t]);

  /* One loader, re-run whenever the signed-in user changes or something asks
     for a refresh — so signing in, signing out, or creating a shop swaps the
     whole screen without a page load.

     `live` rather than an AbortController because the answer, not the
     request, is what must not outlive the effect: a slow reply arriving after
     a newer one would otherwise overwrite it. */
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    get("/api/app/session")
      .then((data) => {
        if (live) setState({ status: "ready", ...data });
      })
      .catch((err) => {
        if (live) setState({ status: "error", code: err.code });
      });
    return () => {
      live = false;
    };
  }, [session.user, reloads]);

  const shops = state.shops ?? [];
  const [shopId, setShopId] = useState(null);
  /* The chosen shop, or the only one there is. Derived rather than stored, so
     it cannot go stale when a membership is removed while the tab is open. */
  const shop = shops.find((s) => s.shopId === shopId) ?? shops[0] ?? null;

  const context = useMemo(() => ({ t, lang }), [t, lang]);

  const chrome = (
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
  );

  let body = null;

  if (state.status === "loading") {
    body = <p className="dash__note">{t("loading")}</p>;
  } else if (state.status === "error" && state.code === "database_not_configured") {
    body = (
      <div className="dash__card">
        <h2>{t("dbMissingTitle")}</h2>
        <p>{t("dbMissingBody")}</p>
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <div className="dash__card">
        <p>{t("errNetwork")}</p>
        <button type="button" className="pill" onClick={reload}>
          {t("retry")}
        </button>
      </div>
    );
  } else if (!state.user) {
    body = (
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
  } else if (!shop) {
    body = <NoShop t={t} user={state.user} admin={state.admin} onCreated={reload} />;
  }

  return (
    <DashContext.Provider value={context}>
      <SessionContext.Provider value={session}>
        <div className="dash" data-theme={theme}>
          <header className="dash__bar">
            <div className="dash__barinner">
              <div className="dash__identity">
                <span className="dash__mark" aria-hidden="true">
                  <PlaneGlyph size={15} />
                </span>
                {shop ? (
                  shops.length > 1 ? (
                    <select
                      className="dash__shoppick"
                      value={shop.shopId}
                      onChange={(event) => setShopId(event.target.value)}
                      aria-label={t("shopSection")}
                    >
                      {shops.map((option) => (
                        <option key={option.shopId} value={option.shopId}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="dash__shopname" dir="auto">
                      {shop.name}
                    </span>
                  )
                ) : (
                  <span className="dash__shopname">{t("title")}</span>
                )}
              </div>

              {chrome}
            </div>

          </header>

          {/* Outside the header on purpose. The bar carries a backdrop-filter,
              and any such ancestor becomes the containing block for a
              position: fixed descendant — which pinned the bottom tab bar to
              the bottom of the *header* instead of the viewport, laying it
              across the controls. */}
          {shop && (
            <nav className="dash__tabs" aria-label={t("title")}>
              {TABS.map(([id, key]) => (
                <button
                  key={id}
                  type="button"
                  className="dash__tab"
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => setTab(id)}
                >
                  <TabIcon name={id} />
                  <span>{t(key)}</span>
                </button>
              ))}
            </nav>
          )}

          <main className="dash__main">
            {body}
            {shop && !body && (
              <>
                {tab === "orders" && <Orders shop={shop} />}
                {tab === "catalog" && <Catalog shop={shop} />}
                {tab === "report" && <Report shop={shop} />}
                {tab === "settings" && (
                  <Settings shop={shop} user={state.user} onChanged={reload} />
                )}
              </>
            )}
          </main>

          {state.user && (
            <footer className="dash__foot">
              <span dir="ltr">
                {state.user.username ? `@${state.user.username}` : displayName(state.user)}
              </span>
              <button type="button" className="dash__link" onClick={session.signOut}>
                {t("signOut")}
              </button>
            </footer>
          )}
        </div>
      </SessionContext.Provider>
    </DashContext.Provider>
  );
}

/* Signed in, but on no shop. For the studio's own accounts that is a shop
   waiting to be created; for everybody else it is an id to send them. */
function NoShop({ t, user, admin, onCreated }) {
  const [name, setName] = useState("");
  const [igHandle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (event) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await post("/api/app/shops", null, { name, igHandle });
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dash__card">
      <h2>{t("noShopTitle")}</h2>
      <p>{t("noShopBody")}</p>
      <p className="dash__idrow">
        <span>{t("yourId")}</span>
        <code dir="ltr">{user.id}</code>
      </p>

      {admin && (
        <form className="dash__form" onSubmit={create}>
          <h3>{t("createShop")}</h3>
          <label className="dash__field">
            <span>{t("createShopName")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="dash__field">
            <span>{t("createShopHandle")}</span>
            <input
              value={igHandle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={40}
              dir="ltr"
            />
          </label>
          <button type="submit" className="pill" disabled={busy || !name.trim()}>
            {busy ? t("saving") : t("create")}
          </button>
        </form>
      )}
    </div>
  );
}
