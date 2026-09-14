import { useCallback, useEffect, useState } from "react";
import { CURRENCIES, currencyId, formatMoney } from "../../shared/orderSchema.js";
import {
  formatInvoiceAmount,
  invoiceStatusLabel,
  isPayable,
} from "../../shared/invoiceSchema.js";
import { get, post } from "./api.js";
import { useDash } from "./copy.js";
import { count, relativeTime } from "./format.js";

/* Who has asked for what, and what they owe for it.

   The studio's own screen rather than a shop's: a brief is an enquiry
   addressed to the studio, and the invoice raised against it is the studio's
   too. It is a tab here because this is where the studio already is, but it is
   the only panel that does not take a shop id — the Worker gates it on
   ADMIN_TELEGRAM_IDS instead of on membership. */

function StatusPill({ status, lang }) {
  return (
    <span className="cust__status" data-status={status}>
      {invoiceStatusLabel(status, lang)}
    </span>
  );
}

/* The brief backlog, which until now had an API and no screen. Only appears
   when there is something wrong, and it says what rather than only how many. */
function Backlog() {
  const { t, lang } = useDash();
  const [counts, setCounts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    get("/api/app/briefs?limit=1")
      .then((data) => {
        if (live) setCounts(data.counts);
      })
      .catch(() => {
        /* The banner is an extra; its absence is not worth an error. */
      });
    return () => {
      live = false;
    };
  }, []);

  const retry = async () => {
    setBusy(true);
    try {
      const data = await post("/api/app/briefs/retry", null, {});
      setResult({ sent: data.sent, failed: data.failed });
      setCounts(data.counts);
    } finally {
      setBusy(false);
    }
  };

  if (!counts?.undelivered) return null;

  return (
    <div className="cust__alarm" role="status">
      <h2>{t("backlogTitle", { n: count(counts.undelivered, lang) })}</h2>
      <p>{t("backlogBody")}</p>
      {result && (
        <p className="dash__note">
          {t("backlogResult", { sent: count(result.sent, lang), failed: count(result.failed, lang) })}
        </p>
      )}
      <button type="button" className="pill" onClick={retry} disabled={busy}>
        {busy ? t("backlogSending") : t("backlogRetry")}
      </button>
    </div>
  );
}

export default function Customers() {
  const { t, lang } = useDash();
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ key: null, customers: [] });
  const [open, setOpen] = useState(null);
  const [reloads, setReloads] = useState(0);

  /* Typing is debounced into `search` so a name is one request rather than
     one per keystroke. */
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const key = `${search}|${reloads}`;

  useEffect(() => {
    let live = true;
    const path = search ? `/api/app/customers?q=${encodeURIComponent(search)}` : "/api/app/customers";
    get(path)
      .then((data) => {
        if (live) setState({ key, customers: data.customers ?? [] });
      })
      .catch(() => {
        if (live) setState({ key, customers: [], failed: true });
      });
    return () => {
      live = false;
    };
  }, [key, search]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const loading = state.key !== key;

  return (
    <section className="cust">
      <Backlog />

      <label className="cust__search">
        <span className="dash__sr">{t("customersSearch")}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("customersSearch")}
          maxLength={80}
          dir="auto"
        />
      </label>

      {loading && <p className="dash__note">{t("loading")}</p>}

      {!loading && state.customers.length === 0 && (
        <div className="dash__card dash__card--empty">
          <h2>{t("customersEmpty")}</h2>
          <p>{t("customersEmptyBody")}</p>
        </div>
      )}

      <ul className="cust__list">
        {state.customers.map((customer) => (
          <li key={customer.id}>
            <button type="button" className="cust__row" onClick={() => setOpen(customer.id)}>
              <span className="cust__who" dir="auto">
                {customer.name || customer.email || customer.telegram || "—"}
              </span>
              <span className="cust__contact" dir="ltr">
                {customer.email || customer.telegram || t("custNoContact")}
              </span>
              <span className="cust__tally">
                <span>
                  {customer.briefs === 1
                    ? t("custBrief1")
                    : t("custBriefsN", { n: count(customer.briefs, lang) })}
                </span>
                {customer.awaiting > 0 && (
                  <span className="cust__awaiting">
                    {t("custAwaiting", { n: count(customer.awaiting, lang) })}
                  </span>
                )}
              </span>
              <span
                className="cust__paid"
                data-empty={customer.paid.length === 0 ? "" : undefined}
                dir="ltr"
              >
                {customer.paid.length === 0
                  ? "—"
                  : customer.paid
                      .map((total) => formatInvoiceAmount(total.cents, total.currency, lang))
                      .join(" · ")}
              </span>
              <time className="cust__when" dateTime={new Date(customer.lastAt).toISOString()}>
                {relativeTime(customer.lastAt, lang)}
              </time>
            </button>
          </li>
        ))}
      </ul>

      {open && <CustomerSheet id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </section>
  );
}

/* One customer: everything they have asked for, everything they have been
   billed, and the form that turns the first into the second. */
function CustomerSheet({ id, onClose, onChanged }) {
  const { t, lang } = useDash();
  const [data, setData] = useState(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let live = true;
    get(`/api/app/customers/${id}`)
      .then((detail) => {
        if (live) setData(detail);
      })
      .catch(() => {
        if (live) setData({ customer: null, briefs: [], invoices: [] });
      });
    return () => {
      live = false;
    };
  }, [id, reloads]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = useCallback(() => {
    setReloads((n) => n + 1);
    onChanged();
  }, [onChanged]);

  const customer = data?.customer;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={customer?.name ?? ""}>
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label={t("close")} />
      <div className="sheet__panel">
        {!data && <p className="dash__note">{t("loading")}</p>}

        {customer && (
          <>
            <header className="sheet__head">
              <div>
                <h2 dir="auto">{customer.name || customer.email || "—"}</h2>
                <p className="sheet__ref" dir="ltr">
                  {[customer.email, customer.telegram, customer.phone].filter(Boolean).join(" · ") ||
                    t("custNoContact")}
                </p>
              </div>
              {customer.subject && <span className="cust__status" data-status="paid">{t("custSignedIn")}</span>}
            </header>

            <h3 className="sheet__title">{t("custBriefs")}</h3>
            {data.briefs.length === 0 ? (
              <p className="dash__note">{t("custNoBriefs")}</p>
            ) : (
              <ul className="cust__briefs">
                {data.briefs.map((brief) => (
                  <li key={brief.id}>
                    <span dir="auto">{brief.botName || brief.summary || brief.reference}</span>
                    <span className="cust__briefmeta">
                      <span dir="ltr">{brief.reference}</span>
                      <time dateTime={new Date(brief.createdAt).toISOString()}>
                        {relativeTime(brief.createdAt, lang)}
                      </time>
                      {!brief.deliveredAt && (
                        <span className="cust__status" data-status="void">
                          {t("custUndelivered")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="sheet__title">{t("custInvoices")}</h3>
            {data.invoices.length === 0 ? (
              <p className="dash__note">{t("custNoInvoices")}</p>
            ) : (
              <ul className="cust__invoices">
                {data.invoices.map((invoice) => (
                  <InvoiceRow key={invoice.id} invoice={invoice} onChanged={refresh} />
                ))}
              </ul>
            )}

            <RaiseInvoice customer={customer} briefs={data.briefs} onRaised={refresh} />
          </>
        )}

        <button type="button" className="pill pill--ghost sheet__close" onClick={onClose}>
          {t("close")}
        </button>
      </div>
    </div>
  );
}

/* One invoice, expandable into its link and the attempts made against it.
   Collapsed by default: a customer with a dozen invoices should be a list, not
   a dozen forms. */
function InvoiceRow({ invoice, onChanged }) {
  const { t, lang } = useDash();
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const openDetail = async () => {
    if (detail) {
      setDetail(null);
      return;
    }
    setDetail(await get(`/api/app/invoices/${invoice.reference}`).catch(() => null));
  };

  const move = async (status) => {
    setBusy(true);
    try {
      await post(`/api/app/invoices/${invoice.reference}`, null, { status });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard
      ?.writeText(detail.payUrl)
      .then(() => setCopied(true))
      /* Refusing clipboard access is normal; the link is on screen to select. */
      .catch(() => {});
  };

  return (
    <li>
      <button type="button" className="cust__invoice" onClick={openDetail}>
        <span dir="auto">{invoice.title}</span>
        <span dir="ltr">{formatInvoiceAmount(invoice.amountCents, invoice.currency, lang)}</span>
        <StatusPill status={invoice.status} lang={lang} />
      </button>

      {detail && (
        <div className="cust__invoicebody">
          <p className="dash__idrow">
            <span>{t("invoiceLink")}</span>
            <code dir="ltr">{detail.payUrl}</code>
            <button type="button" className="dash__link" onClick={copy}>
              {copied ? t("copied") : t("copy")}
            </button>
          </p>
          <p className="dash__note">{t("invoiceLinkNote")}</p>

          {detail.gateways?.length === 0 && (
            <p className="dash__note dash__note--warn">{t("invoiceNoGateway")}</p>
          )}

          {detail.payments?.length > 0 && (
            <ul className="cust__payments">
              {detail.payments.map((payment) => (
                <li key={payment.gatewayRef}>
                  <span dir="ltr">{payment.gateway}</span>
                  <span className="cust__status" data-status={payment.status === "paid" ? "paid" : payment.status === "failed" ? "void" : "sent"}>
                    {payment.status === "paid"
                      ? t("payPaid")
                      : payment.status === "failed"
                        ? t("payFailed")
                        : t("payStarted")}
                  </span>
                  <time dateTime={new Date(payment.createdAt).toISOString()}>
                    {relativeTime(payment.createdAt, lang)}
                  </time>
                </li>
              ))}
            </ul>
          )}

          {invoice.status === "paid" ? (
            <p className="dash__note">{t("invoicePaidNote")}</p>
          ) : (
            <div className="sheet__moves">
              {invoice.status === "draft" && (
                <button
                  type="button"
                  className="chip chip--action"
                  disabled={busy}
                  onClick={() => move("sent")}
                >
                  {t("invoiceMarkSent")}
                </button>
              )}
              {isPayable(invoice.status) && (
                <button
                  type="button"
                  className="chip chip--action"
                  disabled={busy}
                  onClick={() => move("void")}
                >
                  {t("invoiceVoid")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* The bespoke bit: somebody read a brief, decided what it is worth, and says
   so here. Nothing is derived from a catalogue because there is no catalogue —
   every one of these is a different piece of work. */
function RaiseInvoice({ customer, briefs, onRaised }) {
  const { t, lang } = useDash();
  const [form, setForm] = useState(() => ({
    title: "",
    description: "",
    amount: "",
    currency: customer.lang === "fa" ? "IRR" : "USD",
    briefReference: "",
    send: true,
  }));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [raised, setRaised] = useState(null);

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      const data = await post("/api/app/invoices", null, {
        customerId: customer.id,
        title: form.title,
        description: form.description,
        amount: form.amount,
        currency: form.currency,
        briefReference: form.briefReference || undefined,
        status: form.send ? "sent" : "draft",
      });
      setRaised(data);
      setForm((prev) => ({ ...prev, title: "", description: "", amount: "" }));
      onRaised();
    } catch (err) {
      setErrors(err.body?.errors ?? { title: "required" });
    } finally {
      setBusy(false);
    }
  };

  const errorFor = (field) =>
    errors[field] === "required"
      ? t("errRequired")
      : errors[field] === "number"
        ? t("errNumber")
        : errors[field] === "positive"
          ? t("errNegative")
          : null;

  return (
    <form className="dash__form" onSubmit={submit}>
      <h3 className="sheet__title">{t("invoiceNew")}</h3>

      <label className="dash__field">
        <span>{t("invoiceFor")}</span>
        <input
          value={form.title}
          onChange={(event) => set("title", event.target.value)}
          maxLength={120}
          dir="auto"
        />
        {errorFor("title") && <em className="dash__error">{errorFor("title")}</em>}
      </label>

      <label className="dash__field">
        <span>{t("invoiceDetail")}</span>
        <textarea
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          maxLength={1000}
          rows={2}
          dir="auto"
        />
      </label>

      <div className="cust__money">
        <label className="dash__field">
          <span>{t("invoiceAmount")}</span>
          <input
            value={form.amount}
            onChange={(event) => set("amount", event.target.value)}
            inputMode="decimal"
            dir="ltr"
          />
          {errorFor("amount") && <em className="dash__error">{errorFor("amount")}</em>}
        </label>

        <label className="dash__field">
          <span>{t("invoiceCurrency")}</span>
          <select value={form.currency} onChange={(event) => set("currency", event.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* The one place the Rial/Toman difference can bite somebody typing a
          number, so it says so where the number is typed. */}
      {currencyId(form.currency) === "IRR" && <p className="dash__note">{t("invoiceRial")}</p>}

      {briefs.length > 0 && (
        <label className="dash__field">
          <span>{t("invoiceAgainst")}</span>
          <select
            value={form.briefReference}
            onChange={(event) => set("briefReference", event.target.value)}
          >
            <option value="">{t("invoiceAgainstNone")}</option>
            {briefs.map((brief) => (
              <option key={brief.id} value={brief.reference}>
                {brief.botName || brief.reference}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="dash__check">
        <input
          type="checkbox"
          checked={form.send}
          onChange={(event) => set("send", event.target.checked)}
        />
        <span>{t("invoiceSendNow")}</span>
      </label>

      <button type="submit" className="pill" disabled={busy}>
        {busy ? t("invoiceRaising") : t("invoiceRaise")}
      </button>

      {raised && (
        <p className="dash__idrow">
          <span dir="ltr">{raised.invoice.reference}</span>
          <code dir="ltr">{raised.payUrl}</code>
          <span dir="ltr">
            {formatMoney(raised.invoice.amountCents, raised.invoice.currency, lang)}
          </span>
        </p>
      )}
    </form>
  );
}
