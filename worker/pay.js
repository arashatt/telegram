/* The payer's side of the wall.

   Everything here answers somebody who is not signed in and never will be: a
   person who was sent a link, and a gateway calling back about their payment.
   That is why it is its own module rather than another branch of
   worker/app.js, which assumes a session on every route.

   Two rules hold throughout:

     the token is the whole authorisation. Whoever holds it may read *one*
     invoice and pay it. The reply carries nothing else — not the customer,
     not their other invoices, not an email — because a link forwarded to the
     wrong person must leak nothing beyond the bill it was for.

     a redirect is not evidence. A payer arriving back at /pay has only told
     us what their browser was handed. An invoice moves to paid when Stripe's
     signed webhook says so, or when Zarinpal or Zibal confirm it on a verify
     call we made ourselves. */

import { isPayable, payerView } from "../shared/invoiceSchema.js";
import { text } from "../shared/orderSchema.js";
import { json, jsonPrivate, readBody, readRaw } from "./http.js";
import { clientKey, overLimit } from "./ratelimit.js";
import {
  ensureReady,
  getInvoiceByToken,
  hasDb,
  invoiceForPaymentRef,
  settlePaymentRecord,
  startPaymentRecord,
} from "./db.js";
import { callbackRef, gatewaysForInvoice, settlePayment, startPayment } from "./gateways/index.js";

const PREFIX = "/api/pay";
const STRIPE_WEBHOOK = "/api/webhooks/stripe";

export const isPayRoute = (pathname) =>
  pathname === PREFIX || pathname.startsWith(`${PREFIX}/`) || pathname === STRIPE_WEBHOOK;

const fail = (error, status, extra = {}) => jsonPrivate({ error, ...extra }, status);

/* The public origin this Worker is reached on, which is what a gateway sends
   the payer back to. Behind a proxy the request origin can be the internal
   one, so SITE_ORIGIN overrides it — the same reason TELEGRAM_REDIRECT_URI
   exists. */
export function siteOrigin(request, env) {
  const override = String(env?.SITE_ORIGIN ?? "").trim();
  if (override) {
    try {
      return new URL(override).origin;
    } catch {
      /* Unusable override, fall through to the request's own origin —
         /api/health warns about the shape rather than failing a payment. */
    }
  }
  return new URL(request.url).origin;
}

/* Where the payer lands, always back on their own invoice. `r` says what just
   happened so the page has something to say while it re-reads the real status
   from the API, which is the only thing it trusts. */
const payPage = (origin, token, outcome) =>
  `${payUrl(origin, token)}&r=${outcome}`;

/* The link the studio sends a customer. Built here so the shape of a payment
   URL is decided in one place, whoever is asking for it. */
export const payUrl = (origin, token) => `${origin}/pay?t=${encodeURIComponent(token)}`;

const seeOther = (location) => new Response(null, { status: 303, headers: { location } });

/* ---- reading one invoice ---- */

async function handleRead(env, db, url) {
  const invoice = await getInvoiceByToken(db, url.searchParams.get("t"));
  /* The same answer for a malformed token, a token that never existed and one
     that was since deleted. Anything finer is a way to probe for valid ones. */
  if (!invoice) return fail("not_found", 404);

  const lang = url.searchParams.get("lang") === "fa" ? "fa" : "en";
  return jsonPrivate({
    invoice: payerView(invoice, { gateways: gatewaysForInvoice(env, invoice), lang }),
  });
}

/* ---- starting a payment ---- */

async function handleStart(request, env, db) {
  const { body, tooLarge, invalid } = await readBody(request);
  if (tooLarge) return fail("payload_too_large", 413);
  if (invalid) return fail("invalid_json", 400);

  const invoice = await getInvoiceByToken(db, body?.token);
  if (!invoice) return fail("not_found", 404);
  /* A draft was never sent, a void one was withdrawn, and a paid one is
     already settled. None of the three should take money. */
  if (!isPayable(invoice.status)) return fail("not_payable", 409, { status: invoice.status });

  const gateway = text(body?.gateway, 20);
  const offered = gatewaysForInvoice(env, invoice);
  /* Checked against what this invoice actually offers rather than against the
     list of modules: a caller must not be able to name a gateway the page
     never showed them, least of all one that settles a different currency. */
  if (!offered.includes(gateway)) return fail("gateway_unavailable", 422, { gateways: offered });

  const origin = siteOrigin(request, env);
  /* The token the payer presented, not one read back out of the row: an
     invoice loaded for reading deliberately does not carry its own token, and
     building the return URLs from `invoice.token` would send them to
     `/pay?t=undefined` after a successful payment. */
  const token = invoice.reference && body.token;
  const started = await startPayment(env, {
    gateway,
    invoice,
    urls: {
      returnUrl: `${origin}/api/pay/return/${gateway}`,
      successUrl: payPage(origin, token, "done"),
      cancelUrl: payPage(origin, token, "cancelled"),
    },
  });

  if (started.error) {
    console.error(`Payment could not be started on ${gateway}:`, started.detail ?? started.error);
    return fail("gateway_error", 502, { gateway, reason: started.error });
  }

  /* Written before the payer leaves, which is what makes the callback
     meaningful: an authority or a session id that is not in this table is not
     a payment we started. */
  await startPaymentRecord(db, invoice, gateway, started.gatewayRef);
  return jsonPrivate({ ok: true, redirectUrl: started.redirectUrl });
}

/* ---- coming back from Zarinpal or Zibal ---- */

async function handleReturn(request, env, db, url, gateway) {
  const origin = siteOrigin(request, env);
  const ref = callbackRef(gateway, url.searchParams);
  /* No reference at all: there is no invoice to send them back to, so the page
     has to say so without one. */
  if (!ref) return seeOther(`${origin}/pay?r=unknown`);

  const invoice = await invoiceForPaymentRef(db, gateway, ref);
  if (!invoice) return seeOther(`${origin}/pay?r=unknown`);

  const outcome = await settlePayment(env, { gateway, invoice, query: url.searchParams });

  /* "pending" is the gateway being unreachable, not the payer being declined.
     Nothing is written: the money may well have moved, and the same authority
     can still be verified on a later attempt. Writing it off as failed here
     would make an invoice that was actually paid unpayable. */
  if (outcome.status === "pending" || outcome.status === "invalid") {
    console.error(`${gateway} callback unresolved:`, outcome.detail);
    return seeOther(payPage(origin, invoice.token, outcome.status));
  }

  await settlePaymentRecord(db, {
    gateway,
    gatewayRef: outcome.gatewayRef ?? ref,
    ok: outcome.status === "paid",
    detail: outcome.detail,
  });

  return seeOther(payPage(origin, invoice.token, outcome.status));
}

/* ---- Stripe's webhook ----

   Not rate-limited by IP. The signature is the gate, verifying one is cheap,
   and dropping a genuine event to protect against an expensive one would be
   the wrong trade — Stripe retries for days, but a 429 storm during a busy
   hour is a backlog nobody is watching.

   Always 200 once the signature checks out, including for events we ignore:
   a non-2xx tells Stripe to send it again, forever. */
async function handleStripeWebhook(request, env, db) {
  const { raw, tooLarge } = await readRaw(request);
  if (tooLarge) return json({ error: "payload_too_large" }, 413);

  const outcome = await settlePayment(env, {
    gateway: "stripe",
    rawBody: raw,
    signature: request.headers.get("stripe-signature") ?? "",
  });

  /* The only 400 here. A body that is not signed by our own webhook secret is
     not from Stripe and nothing is written for it. */
  if (outcome.status === "invalid") {
    console.error("Stripe webhook rejected:", outcome.detail);
    return json({ error: "invalid_signature" }, 400);
  }
  if (outcome.status === "ignored") return json({ ok: true, ignored: outcome.detail });

  const settled = await settlePaymentRecord(db, {
    gateway: "stripe",
    gatewayRef: outcome.gatewayRef,
    ok: outcome.status === "paid",
    detail: outcome.detail,
  });

  /* A replay reaches here and settles nothing, which is the unique index on
     (gateway, gateway_ref) doing its job. Reported as ok, because from
     Stripe's side the event has been handled — twice. */
  return json({ ok: true, settled: settled.settled, reason: settled.reason });
}

/* ---- dispatch ---- */

export async function handlePay(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  if (!hasDb(env)) return fail("payments_not_configured", 503);
  const db = env.DB;

  try {
    await ensureReady(db);
  } catch (err) {
    console.error("Payment schema could not be applied:", err.message);
    return fail("schema_unavailable", 503);
  }

  if (url.pathname === STRIPE_WEBHOOK) {
    if (request.method !== "POST") return fail("method_not_allowed", 405);
    return handleStripeWebhook(request, env, db);
  }

  const segments = url.pathname.slice(PREFIX.length).split("/").filter(Boolean);

  /* The callback is exempt: it is a gateway's redirect, arriving at whatever
     rate a busy afternoon produces, and a 429 there strands a payer who has
     already paid. */
  const [head, second] = segments;
  if (head !== "return" && (await overLimit(env.AUTH_LIMIT, clientKey(request)))) {
    return fail("rate_limited", 429);
  }

  if (!head) {
    if (request.method !== "GET") return fail("method_not_allowed", 405);
    return handleRead(env, db, url);
  }
  if (head === "start") {
    if (request.method !== "POST") return fail("method_not_allowed", 405);
    return handleStart(request, env, db);
  }
  if (head === "return" && second) return handleReturn(request, env, db, url, second);

  return fail("not_found", 404);
}
