/* The vocabulary of getting paid, shared by the Worker and the browser for the
   same reason shared/orderSchema.js is: the allowed values and the validation
   rules exist once, so the screens and the API cannot disagree about what a
   valid invoice is.

   Deliberately separate from orderSchema.js. A shop's Instagram orders and the
   studio's invoices are different things that happen to both involve money, and
   folding them together would mean every change to one had to be checked
   against the other. */

import {
  LIMITS as MONEY_LIMITS,
  currencyId,
  formatMoney,
  parseMoney,
  text,
} from "./orderSchema.js";

/* ---- invoice status ----

   Four states, and only four. Anything finer — partly paid, overdue, in
   dispute — is a state somebody has to keep truthful by hand, and this is a
   studio of a few people invoicing bespoke work, not an accounts department. */

export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"];
export const DEFAULT_INVOICE_STATUS = "draft";

export const INVOICE_STATUS_LABELS = {
  draft: { en: "Draft", fa: "پیش‌نویس" },
  sent: { en: "Awaiting payment", fa: "در انتظار پرداخت" },
  paid: { en: "Paid", fa: "پرداخت شد" },
  void: { en: "Cancelled", fa: "لغو شد" },
};

export const invoiceStatusId = (value) =>
  INVOICE_STATUSES.includes(value) ? value : DEFAULT_INVOICE_STATUS;

export const invoiceStatusLabel = (value, lang = "en") =>
  INVOICE_STATUS_LABELS[invoiceStatusId(value)][lang === "fa" ? "fa" : "en"];

/* Only a sent invoice can be paid. A draft has not been shown to anybody and a
   void one was withdrawn, so a payment against either is a bug somewhere
   upstream rather than money to keep. */
export const isPayable = (status) => invoiceStatusId(status) === "sent";

/* ---- gateways ----

   Which gateway a payer is offered follows the language of the page they are
   reading, not their address or their card: the Iranian gateways exist for
   Persian-speaking customers, and the English site never mentions them.

   Whether a gateway is actually *configured* is a Worker question — it needs
   the keys — so this only says which ones are appropriate. worker/gateways
   intersects the two. */

export const GATEWAYS = ["stripe", "zarinpal", "zibal"];

export const GATEWAY_LABELS = {
  stripe: { en: "Card payment", fa: "پرداخت با کارت بین‌المللی" },
  zarinpal: { en: "Zarinpal", fa: "زرین‌پال" },
  zibal: { en: "Zibal", fa: "زیبال" },
};

export const gatewayId = (value) => (GATEWAYS.includes(value) ? value : null);

export const gatewayLabel = (value, lang = "en") =>
  GATEWAY_LABELS[gatewayId(value) ?? "stripe"][lang === "fa" ? "fa" : "en"];

export const gatewaysForLang = (lang) =>
  lang === "fa" ? ["zarinpal", "zibal"] : ["stripe"];

/* The currency each language is invoiced in by default. Overridable per
   invoice; this is only what the form starts on. */
export const currencyForLang = (lang) => (lang === "fa" ? "IRR" : "USD");

/* ---- limits ---- */

export const LIMITS = {
  title: 120,
  description: 1000,
  reference: 32,
  name: 120,
  email: MONEY_LIMITS.customer,
  note: 500,
  gatewayRef: 120,
  detail: 300,
};

/* ---- validation ----

   Field -> code, empty when the invoice is fine. Codes rather than sentences:
   the browser translates them, the Worker only rejects. */
export function validateInvoice(input) {
  const errors = {};
  if (text(input?.title, LIMITS.title).length < 2) errors.title = "required";

  const currency = currencyId(input?.currency);
  const amount = parseMoney(input?.amount, currency);
  if (amount === null) errors.amount = "number";
  else if (amount <= 0) errors.amount = "positive";

  return errors;
}

/* What the payer's page is allowed to know. Everything else about an invoice —
   who it is for, which brief it came from, what else they have bought — stays
   on the studio's side of the wall, because the token in a payment link is
   held by whoever was sent it and nothing more. */
export function payerView(invoice, { gateways = [], lang = "en" } = {}) {
  return {
    reference: invoice.reference,
    title: invoice.title,
    description: invoice.description,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    status: invoice.status,
    paidAt: invoice.paidAt ?? null,
    dueAt: invoice.dueAt ?? null,
    payable: isPayable(invoice.status),
    gateways,
    lang,
  };
}

/* ---- Toman, for reading only ----

   An IRR amount is stored and charged in Rial, because that is what ISO 4217
   means and what both Iranian gateways take. But nobody in Iran says "two and a
   half million Rial" — they say "۲۵۰٬۰۰۰ تومان". So Persian screens divide by
   ten to *show* the number, and nothing else ever does.

   The full argument for this split is in worker/gateways/rial.js. */

export const RIAL_PER_TOMAN = 10;

export function formatToman(rial, lang = "fa") {
  const toman = Math.round(Number(rial ?? 0) / RIAL_PER_TOMAN);
  const locale = lang === "fa" ? "fa-IR" : "en-US";
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(toman);
  } catch {
    return String(toman);
  }
}

/* What a payer should read, which depends on the currency rather than only on
   the language: an IRR invoice reads in Toman with the word attached, and every
   other currency goes through the ordinary formatter. */
export function formatInvoiceAmount(amountCents, currency, lang = "en") {
  if (currencyId(currency) === "IRR") {
    return `${formatToman(amountCents, lang)} ${lang === "fa" ? "تومان" : "Toman"}`;
  }
  return formatMoney(amountCents, currency, lang);
}
