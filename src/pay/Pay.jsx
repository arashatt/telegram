import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, dirFor } from "../i18n.js";
import { prefersPersian } from "../lang.js";
import { MoonIcon, PlaneGlyph } from "../components/Icons.jsx";
import {
  formatInvoiceAmount,
  gatewayLabel,
  invoiceStatusLabel,
} from "../../shared/invoiceSchema.js";
import { currencyId, formatMoney } from "../../shared/orderSchema.js";
import { AccountContext, translator } from "../account/copy.js";
import "../dashboard/dashboard.css";
import "../account/account.css";

/* One invoice, for whoever holds the link.

   No sign-in and nothing to sign in to: the token in the URL is the entire
   authorisation, and the API answers it with the bill and nothing else — no
   customer, no other invoice, no email. A link forwarded to the wrong person
   leaks the price of one piece of work, which is the most a payment link can
   be allowed to cost.

   `?t=` rather than /pay/<token> on purpose: the asset router already serves
   this page for /pay by its trailing-slash rule, and a path segment would need
   new routing config for no gain.

   The redirect a payer comes back on is never believed. `?r=` only decides
   what to say while this page re-reads the real status from the API, which is
   the only thing that knows whether money moved. */

const initialLang = () => (prefersPersian() ? "fa" : DEFAULT_LANG);

const initialTheme = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const params = () => new URLSearchParams(window.location.search);

/* Coming back from a gateway that confirms by webhook, the payment can settle
   a second or two after the payer lands here. Re-reading a few times is the
   difference between "Paid, thank you" and an invoice that still says it is
   owed while the money is already gone. */
const SETTLING = { tries: 5, waitMs: 2000 };

export default function Pay() {
  const [lang, setLang] = useState(initialLang);
  const [theme, setTheme] = useState(initialTheme);
  const [state, setState] = useState({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  const [going, setGoing] = useState(null);

  const t = useMemo(() => translator(lang), [lang]);
  const token = useMemo(() => params().get("t") ?? "", []);
  const returned = useMemo(() => params().get("r") ?? "", []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
    document.documentElement.dataset.theme = theme;
    document.title = t("payTitle");
  }, [lang, theme, t]);

  /* The language is deliberately not part of this key. Everything on this page
     is formatted in the browser, so switching to Persian must not blank the
     invoice and fetch it again — somebody mid-payment watching the amount
     disappear has every reason to distrust the page. */
  const key = `${token}|${reloads}`;

  useEffect(() => {
    if (!token) {
      return undefined;
    }
    let live = true;
    let timer = null;
    let tries = 0;

    const read = () => {
      fetch(`/api/pay?t=${encodeURIComponent(token)}`, { credentials: "omit" })
        .then(async (res) => {
          if (!live) return;
          if (!res.ok) {
            setState({ key, status: "missing" });
            return;
          }
          const { invoice } = await res.json();
          setState({ key, status: "ready", invoice });

          /* Only while we have a reason to expect a change. A payer who just
             came back from a gateway is the whole case; anybody else reading
             an open invoice gets one request. */
          const settling = returned === "done" || returned === "paid" || returned === "pending";
          if (settling && invoice.status !== "paid" && tries < SETTLING.tries) {
            tries += 1;
            timer = setTimeout(read, SETTLING.waitMs);
          }
        })
        .catch(() => {
          if (live) setState({ key, status: "offline" });
        });
    };

    read();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [key, token, returned]);

  const start = useCallback(
    async (gateway) => {
      setGoing(gateway);
      try {
        const res = await fetch("/api/pay/start", {
          method: "POST",
          credentials: "omit",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, gateway }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
        setGoing(null);
        setReloads((n) => n + 1);
      } catch {
        setGoing(null);
      }
    },
    [token]
  );

  const status = state.key === key ? state.status : token ? "loading" : "missing";

  return (
    <AccountContext.Provider value={{ t, lang }}>
      <div className="dash acct acct--pay" data-theme={theme}>
        <header className="dash__bar">
          <div className="dash__barinner">
            <div className="dash__identity">
              <span className="dash__mark" aria-hidden="true">
                <PlaneGlyph size={15} />
              </span>
              <span className="dash__shopname">{t("payTitle")}</span>
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
          {status === "loading" && <p className="dash__note">{t("loading")}</p>}

          {status === "missing" && (
            <Message title={t("payNotFound")} body={t("payNotFoundBody")} />
          )}

          {status === "offline" && (
            <Message title={t("errNetwork")} body="">
              <button type="button" className="pill" onClick={() => setReloads((n) => n + 1)}>
                {t("retry")}
              </button>
            </Message>
          )}

          {status === "ready" && (
            <Invoice
              invoice={state.invoice}
              lang={lang}
              t={t}
              returned={returned}
              going={going}
              onPay={start}
              onRefresh={() => setReloads((n) => n + 1)}
            />
          )}
        </main>
      </div>
    </AccountContext.Provider>
  );
}

function Message({ title, body, children }) {
  return (
    <div className="dash__card dash__card--gate">
      <h2 dir="auto">{title}</h2>
      {body && <p dir="auto">{body}</p>}
      {children}
    </div>
  );
}

function Invoice({ invoice, lang, t, returned, going, onPay, onRefresh }) {
  const paid = invoice.status === "paid";
  const rial = currencyId(invoice.currency) === "IRR";

  return (
    <article className="pay">
      <div className="pay__card">
        <p className="pay__label">{t("payFor")}</p>
        <h1 className="pay__title" dir="auto">
          {invoice.title}
        </h1>
        {invoice.description && (
          <p className="pay__detail" dir="auto">
            {invoice.description}
          </p>
        )}

        <p className="pay__amount" dir="ltr">
          {formatInvoiceAmount(invoice.amountCents, invoice.currency, lang)}
        </p>
        {/* What the bank statement will say, when that is a different number
            from the one above. Nobody should be surprised by a factor of ten. */}
        {rial && (
          <p className="dash__note">
            {t("payTomanNote", { rial: formatMoney(invoice.amountCents, "IRR", lang) })}
          </p>
        )}

        <p className="pay__meta">
          <span>{t("payReference")}</span>
          <code dir="ltr">{invoice.reference}</code>
          <span className="cust__status" data-status={invoice.status}>
            {invoiceStatusLabel(invoice.status, lang)}
          </span>
        </p>
      </div>

      {paid && <Message title={t("payDone")} body={t("payDoneBody")} />}

      {!paid && invoice.status === "void" && (
        <Message title={t("payVoid")} body={t("payVoidBody")} />
      )}

      {!paid && invoice.status === "draft" && (
        <Message title={t("payDraft")} body={t("payDraftBody")} />
      )}

      {!paid && invoice.payable && (
        <>
          {returned === "failed" && <Message title={t("payFailed")} body={t("payFailedBody")} />}
          {returned === "cancelled" && (
            <Message title={t("payCancelled")} body={t("payCancelledBody")} />
          )}
          {(returned === "pending" || returned === "invalid") && (
            <Message title={t("payPending")} body={t("payPendingBody")}>
              <button type="button" className="pill pill--ghost" onClick={onRefresh}>
                {t("payRefresh")}
              </button>
            </Message>
          )}
          {returned === "done" && (
            <p className="dash__note" role="status">
              {t("payChecking")}
            </p>
          )}

          {invoice.gateways.length === 0 ? (
            <Message title={t("payNoGateway")} body={t("payNoGatewayBody")} />
          ) : (
            <section className="pay__methods">
              <h2>{t("payChoose")}</h2>
              {invoice.gateways.map((gateway) => (
                <button
                  key={gateway}
                  type="button"
                  className="pill pill--lg pay__method"
                  disabled={Boolean(going)}
                  onClick={() => onPay(gateway)}
                >
                  {going === gateway
                    ? t("payGoing", { gateway: gatewayLabel(gateway, lang) })
                    : gatewayLabel(gateway, lang)}
                </button>
              ))}
              <p className="dash__note">{t("paySafe")}</p>
            </section>
          )}
        </>
      )}
    </article>
  );
}
