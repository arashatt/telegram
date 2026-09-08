/* The dashboard's vocabulary, shared by the Worker and the browser for the
   same reason shared/formSchema.js is: the allowed values and the validation
   rules exist once, so the UI and the API cannot disagree about what a valid
   order or product is.

   Imported by the ingest endpoint too, which is the one place untrusted input
   from outside the browser arrives. */

/* ---- money ----

   Always integer minor units with a currency beside them. Floats do not add
   up, and a total that is a cent out is a support ticket. */

export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "TRY"];
export const DEFAULT_CURRENCY = "USD";

export const currencyId = (value) =>
  CURRENCIES.includes(String(value ?? "").toUpperCase())
    ? String(value).toUpperCase()
    : DEFAULT_CURRENCY;

/* Intl does the symbol, the separators and the decimal count — including the
   currencies that have none. `lang` only picks the numerals and grouping. */
export function formatMoney(cents, currency = DEFAULT_CURRENCY, lang = "en") {
  const amount = Number(cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US", {
      style: "currency",
      currency: currencyId(currency),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyId(currency)}`;
  }
}

/* Accepts what a person types — "40", "40.50", "$40.50", "۴۰" — and returns
   cents, or null when it is not a number at all. Rounding is done once, here,
   so no caller has to decide. */
export function parseMoney(input) {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  const normalized = String(input ?? "")
    /* Persian and Arabic-Indic digits, so a Persian keyboard is not a
       validation error. */
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  if (!normalized || !/^-?\d*\.?\d*$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/* ---- order status ----

   Deliberately short. Every extra state is one the shop has to keep truthful
   by hand, and this is a dashboard for a person answering DMs, not a
   warehouse system. */

export const ORDER_STATUSES = ["new", "confirmed", "shipped", "done", "cancelled"];
export const DEFAULT_STATUS = "new";

export const ORDER_STATUS_LABELS = {
  new: { en: "New", fa: "جدید" },
  confirmed: { en: "Confirmed", fa: "تأیید شده" },
  shipped: { en: "Shipped", fa: "ارسال شد" },
  done: { en: "Done", fa: "تکمیل شد" },
  cancelled: { en: "Cancelled", fa: "لغو شد" },
};

export const statusId = (value) =>
  ORDER_STATUSES.includes(value) ? value : DEFAULT_STATUS;

export const statusLabel = (value, lang = "en") =>
  ORDER_STATUS_LABELS[statusId(value)][lang === "fa" ? "fa" : "en"];

/* Only these count as money that arrived. A cancelled order is not revenue,
   and a new one is not yet — the report says so rather than flattering the
   number. */
export const EARNED_STATUSES = ["confirmed", "shipped", "done"];

/* ---- events ----

   The automation writes one row per thing that happened. `dm_in` and `dm_out`
   are what make a reply time measurable; without both, "reply times" on the
   Instagram page is a claim with nothing behind it. */

export const EVENT_TYPES = ["comment", "dm_in", "dm_out", "order", "handoff"];

export const EVENT_LABELS = {
  comment: { en: "Comment", fa: "کامنت" },
  dm_in: { en: "Message in", fa: "پیام دریافتی" },
  dm_out: { en: "Reply out", fa: "پاسخ ارسالی" },
  order: { en: "Order", fa: "سفارش" },
  handoff: { en: "Passed to a person", fa: "ارجاع به اپراتور" },
};

export const eventId = (value) => (EVENT_TYPES.includes(value) ? value : null);

export const eventLabel = (value, lang = "en") =>
  EVENT_LABELS[eventId(value) ?? "comment"][lang === "fa" ? "fa" : "en"];

/* ---- limits ----

   Everything written to the database is capped here rather than at each call
   site, so the ingest endpoint and the dashboard form agree. */

export const LIMITS = {
  shopName: 80,
  igHandle: 40,
  title: 120,
  sku: 40,
  customer: 64,
  note: 500,
  ref: 64,
  sourcePost: 120,
  keyword: 40,
  label: 60,
  qty: 9999,
  items: 50,
  payload: 4000,
};

/* Trims, caps, and turns anything that is not a string into "". Used on every
   field that reaches the database. */
export function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/* An Instagram handle as people actually type it: with or without the @, and
   never with the punctuation that would make it a different handle.

   Lower-cased because Instagram's are: @Nadia.K and @nadia.k are one person,
   and if they were two rows here then repeat customers would be miscounted and
   a reply time would be measured against the wrong thread. */
export function handle(value) {
  const raw = text(value, LIMITS.customer).replace(/^@+/, "");
  const cleaned = raw.replace(/[^A-Za-z0-9._]/g, "").toLowerCase();
  return cleaned ? `@${cleaned}` : "";
}

export function integer(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/* ---- validation ---- */

/* Returns a field -> code map, empty when the product is fine. Codes rather
   than sentences: the browser translates them, the Worker only rejects. */
export function validateProduct(input) {
  const errors = {};
  const title = text(input?.title, LIMITS.title);
  if (title.length < 2) errors.title = "required";

  const price = parseMoney(input?.price);
  if (price === null) errors.price = "number";
  else if (price < 0) errors.price = "negative";

  const stock = input?.stock;
  if (stock !== undefined && stock !== null && stock !== "" && parseMoney(stock) === null) {
    errors.stock = "number";
  }
  return errors;
}

/* The ingest endpoint's shape. Anything absent gets a defensible default
   rather than a rejection — an automation that reports an order with no
   line items has still reported an order, and losing it would be worse than
   storing it thin. */
export function normalizeIngestOrder(input) {
  const items = Array.isArray(input?.items) ? input.items.slice(0, LIMITS.items) : [];
  const lines = items
    .map((item) => ({
      sku: text(item?.sku, LIMITS.sku),
      title: text(item?.title, LIMITS.title),
      qty: integer(item?.qty ?? 1, { min: 1, max: LIMITS.qty }),
      unitPriceCents: parseMoney(item?.price ?? item?.unitPrice) ?? 0,
    }))
    .filter((item) => item.title || item.sku);

  return {
    ref: text(input?.ref, LIMITS.ref),
    customer: handle(input?.customer),
    status: statusId(input?.status),
    /* Null when the automation did not say, and left null here on purpose:
       a line that names only a SKU has no price until the catalog has been
       consulted, which is a database question. upsertOrder totals the lines
       once each one's price is resolved. A declared total still wins — the
       automation may know about shipping or a discount that never appears
       as a line. */
    declaredTotalCents: parseMoney(input?.total),
    sourcePost: text(input?.post ?? input?.sourcePost, LIMITS.sourcePost),
    keyword: text(input?.keyword, LIMITS.keyword),
    note: text(input?.note, LIMITS.note),
    items: lines,
  };
}
