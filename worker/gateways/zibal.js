/* Zibal, over its v1 REST API.

   Same three steps as Zarinpal with different spellings: request a trackId,
   send the payer to /start/{trackId}, verify on the way back. Zibal's verify
   returns the amount it actually took, which is checked against the invoice —
   a reply about somebody else's payment must not settle this one. */

import { jsonHeaders, upstream } from "./upstream.js";
import { rialAmount } from "./rial.js";

const API = "https://gateway.zibal.ir";

export const id = "zibal";

export const configured = (env) => Boolean(env?.ZIBAL_MERCHANT);

/* Zibal returns `result: 100` for success and a numeric code with a `message`
   otherwise. */
const complaint = (body) => `result ${body?.result ?? "?"}: ${body?.message ?? "unknown error"}`;

export async function start(env, invoice, urls) {
  if (!configured(env)) return { error: "not_configured" };
  const amount = rialAmount(invoice);
  if (amount === null) return { error: "currency" };

  const res = await upstream(`${API}/v1/request`, {
    headers: jsonHeaders,
    body: JSON.stringify({
      merchant: env.ZIBAL_MERCHANT,
      amount,
      callbackUrl: urls.returnUrl,
      description: (invoice.title || invoice.reference).slice(0, 200),
      orderId: invoice.reference,
    }),
  });

  if (res.error) return { error: res.error, detail: res.detail };
  const data = res.data ?? {};
  if (Number(data.result) !== 100 || !data.trackId) {
    return { error: "rejected", detail: complaint(data) };
  }
  return { redirectUrl: `${API}/start/${data.trackId}`, gatewayRef: String(data.trackId) };
}

export const callbackRef = (query) => {
  const trackId = String(query?.get?.("trackId") ?? "").trim();
  return trackId || null;
};

export async function settle(env, { invoice, query }) {
  const trackId = callbackRef(query);
  if (!trackId) return { status: "invalid", detail: "no trackId" };

  if (String(query.get("success") ?? "") !== "1") {
    const code = String(query.get("status") ?? "");
    return { status: "failed", gatewayRef: trackId, detail: `cancelled (status ${code || "none"})` };
  }

  const amount = rialAmount(invoice);
  if (amount === null) return { status: "invalid", gatewayRef: trackId, detail: "currency" };

  const res = await upstream(`${API}/v1/verify`, {
    headers: jsonHeaders,
    body: JSON.stringify({ merchant: env.ZIBAL_MERCHANT, trackId: Number(trackId) }),
  });

  /* As with Zarinpal: unreachable is not declined, and neither is a 500. */
  if (res.error || !res.ok) {
    return { status: "pending", gatewayRef: trackId, detail: res.detail ?? res.error ?? `http ${res.status}` };
  }

  const data = res.data ?? {};
  const result = Number(data.result);
  /* 100 verified now, 201 already verified — a refreshed return page. */
  if (result !== 100 && result !== 201) {
    return { status: "failed", gatewayRef: trackId, detail: complaint(data) };
  }

  /* Zibal tells us what it took. If that is not what the invoice says, this
     reply is about something else and settling on it would mark an invoice
     paid for the wrong money. */
  if (data.amount != null && Number(data.amount) !== amount) {
    return { status: "failed", gatewayRef: trackId, detail: `amount mismatch (${data.amount})` };
  }

  return {
    status: "paid",
    gatewayRef: trackId,
    detail: `zibal ref ${data.refNumber ?? "—"}${result === 201 ? " (already verified)" : ""}`,
  };
}
