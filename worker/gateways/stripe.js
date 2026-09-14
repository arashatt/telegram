/* Stripe, over its REST API and nothing else.

   No SDK: the Node library assumes a Node runtime and pulls in far more than a
   Worker should carry for two endpoints. A Checkout Session is one form-encoded
   POST, and the webhook is an HMAC — both are smaller written out than the
   dependency would be.

   The shape of the integration: we create a Checkout Session, send the payer to
   Stripe's hosted page, and learn that they paid from a *signed webhook*. The
   `success_url` they come back to is never trusted on its own — it is a URL the
   payer's browser visits, which means anybody can visit it. */

import { hmacSha256Hex, timingSafeEqual, seconds, upstream } from "./upstream.js";

const API = "https://api.stripe.com/v1";

export const id = "stripe";

/* Both keys, or the gateway is not offered. Without the webhook secret a
   payment could be started but never confirmed, which is worse than not
   offering the button: the money leaves the payer and the invoice stays open. */
export const configured = (env) => Boolean(env?.STRIPE_SECRET_KEY && env?.STRIPE_WEBHOOK_SECRET);

/* Stripe's `unit_amount` is in the currency's smallest unit, which is exactly
   what `amount_cents` holds — `shared/orderSchema.js` decides how many minor
   units a currency has, and Stripe agrees with ISO 4217 about all of them. */
function sessionForm(invoice, urls) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", urls.successUrl);
  body.set("cancel_url", urls.cancelUrl);
  /* Both carry the reference so a payment can be traced from Stripe's own
     dashboard back to an invoice here without a lookup table. */
  body.set("client_reference_id", invoice.reference);
  body.set("metadata[reference]", invoice.reference);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", String(invoice.currency).toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(invoice.amountCents));
  body.set("line_items[0][price_data][product_data][name]", invoice.title || invoice.reference);

  /* Stripe rejects an empty description rather than ignoring it. */
  const description = String(invoice.description ?? "").trim();
  if (description) {
    body.set("line_items[0][price_data][product_data][description]", description.slice(0, 400));
  }
  return body;
}

export async function start(env, invoice, urls) {
  if (!configured(env)) return { error: "not_configured" };
  if (!(invoice.amountCents > 0)) return { error: "amount" };

  const res = await upstream(`${API}/checkout/sessions`, {
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      /* Pinning the version keeps a future Stripe release from changing the
         reply shape under a Worker nobody is watching. */
      "stripe-version": "2024-06-20",
    },
    body: sessionForm(invoice, urls).toString(),
  });

  if (res.error) return { error: res.error, detail: res.detail };
  if (!res.ok || !res.data?.url || !res.data?.id) {
    return { error: "rejected", detail: res.data?.error?.message ?? `http ${res.status}` };
  }
  return { redirectUrl: String(res.data.url), gatewayRef: String(res.data.id) };
}

/* Stripe confirms by webhook, so there is nothing to read off the return
   redirect. The page the payer lands on just asks the API what the invoice
   says now. */
export const callbackRef = () => null;

/* ---- webhook signature ----

   The header is `t=<unix>,v1=<hex>[,v1=<hex>]`, signed over `${t}.${body}`.
   More than one `v1` appears while a signing secret is being rotated, so every
   candidate is checked rather than only the first. */

const TOLERANCE_SECONDS = 300;

export async function verifySignature(secret, rawBody, header, at = seconds()) {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (!header) return { ok: false, reason: "no_signature" };

  let timestamp = "";
  const candidates = [];
  for (const part of String(header).split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") candidates.push(value);
  }

  if (!timestamp || !candidates.length) return { ok: false, reason: "malformed_signature" };

  /* Without this a signature captured once could be replayed forever. The
     payments table would catch the duplicate, but a signature should not
     outlive its five minutes in the first place. */
  if (Math.abs(at - Number(timestamp)) > TOLERANCE_SECONDS) return { ok: false, reason: "stale" };

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  const matched = candidates.some((candidate) => timingSafeEqual(candidate, expected));
  return matched ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/* Which events mean what. Anything not named here is a Stripe event we did not
   ask for and must answer 200 to anyway, or Stripe retries it for days. */
const OUTCOMES = {
  "checkout.session.completed": "completed",
  "checkout.session.async_payment_succeeded": "paid",
  "checkout.session.async_payment_failed": "failed",
  "checkout.session.expired": "failed",
};

export async function settle(env, { rawBody, signature, at }) {
  const verified = await verifySignature(env?.STRIPE_WEBHOOK_SECRET, rawBody, signature, at ?? seconds());
  if (!verified.ok) return { status: "invalid", detail: verified.reason };

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: "invalid", detail: "malformed_body" };
  }

  const outcome = OUTCOMES[event?.type];
  if (!outcome) return { status: "ignored", detail: String(event?.type ?? "unknown") };

  const session = event?.data?.object ?? {};
  const gatewayRef = String(session.id ?? "");
  if (!gatewayRef) return { status: "invalid", detail: "no session id" };

  /* A completed session is only money when Stripe says it was paid. A
     bank-debit method completes the session immediately and pays days later,
     which is what `async_payment_succeeded` is for. */
  if (outcome === "completed" && session.payment_status !== "paid") {
    return { status: "ignored", gatewayRef, detail: `awaiting ${session.payment_status ?? "payment"}` };
  }

  return {
    status: outcome === "failed" ? "failed" : "paid",
    gatewayRef,
    reference: String(session.client_reference_id ?? session.metadata?.reference ?? ""),
    detail: outcome === "failed" ? String(event.type) : `stripe ${session.payment_intent ?? gatewayRef}`,
  };
}
